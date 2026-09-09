# WorldGuess — Structure & Security Plan

How to organize the code so every new feature (flags, timer, multiplayer…) slots in without rewrites, and how to keep the leaderboard and rooms secure.

---

## 1. The big picture

```
┌─────────────────────────────┐
│  React app (Vite, TS)       │  ← what you have, restructured
│  Web now → PWA → Capacitor  │
└──────────────┬──────────────┘
               │ supabase-js
┌──────────────▼──────────────┐
│  Supabase (one service for  │
│  everything backend)        │
│  • Auth (Google/Apple/email)│
│  • Postgres + RLS           │
│  • Realtime (multiplayer)   │
│  • Edge Functions           │  ← answer checking & score submission (anti-cheat)
└─────────────────────────────┘
```

**Why Supabase instead of writing your own server:** auth, database, and realtime websockets are the three hardest things to build securely, and you'd need all three. Supabase gives you all of them with a generous free tier, and you write no server code except small Edge Functions. (Alternative if you ever outgrow it: Node + Socket.io — but you won't need that for a long time.)

---

## 2. Frontend structure (feature-folder layout)

Organize by *feature*, not by file type. Everything about flags lives in one folder; deleting or reworking a mode never touches the others.

```
src/
├── app/                      # app shell
│   ├── router.tsx            # react-router routes
│   ├── providers.tsx         # auth provider, query client
│   └── App.tsx
│
├── features/
│   ├── game/                 # ⭐ shared game engine (see §3)
│   │   ├── engine/           #    round state machine, scoring, timer
│   │   ├── components/       #    Timer, ScoreBar, RoundSummary, HintButton
│   │   └── types.ts          #    Question, RoundConfig, RoundResult
│   ├── globe-guess/          # globe mode (your current GlobeView, split up)
│   ├── flag-guess/           # flag mode
│   ├── famous-for/           # clue mode
│   ├── auth/                 # login page, useAuth hook, profile
│   ├── leaderboard/
│   ├── daily-challenge/
│   └── multiplayer/          # room create/join, lobby, live match
│
├── components/ui/            # generic Button, Modal, Card, Input
├── lib/
│   ├── supabase.ts           # single supabase client instance
│   ├── answerMatch.ts        # typo-tolerant, alias-aware answer comparison
│   └── utils.ts
├── data/
│   ├── countries.ts          # one canonical dataset (see §4)
│   ├── world.geojson         # bundled locally — do NOT fetch from a random GitHub URL
│   └── famousFor.ts          # clues dataset
├── hooks/                    # generic hooks (useCountdown, useLocalStorage)
├── types/                    # shared TS types
└── stores/                   # zustand stores (settings, session)
```

New libraries to add (all small, standard choices):
- `react-router` — pages/navigation
- `zustand` — client game state (simpler than Redux)
- `@tanstack/react-query` — server data (leaderboards, profiles) with caching
- `@supabase/supabase-js` — backend client
- `zod` — validate every payload crossing a boundary (API responses, room messages)

---

## 3. The key design idea: one game engine, many modes

Every mode is the same loop: *show a question → take an answer → check → score → next*. Only the **question renderer** differs (globe polygon vs flag image vs text clue). So build one engine and plug modes into it:

```ts
// features/game/types.ts
type Question = {
  id: string;
  countryCode: string;                       // ISO code is the canonical answer
  kind: "globe" | "flag" | "famous-for" | "find-on-globe";
  prompt: { flagUrl?: string; clue?: string; polygonId?: string };
};

type RoundConfig = {
  mode: GameMode;
  difficulty: "easy" | "medium" | "hard";
  timer: { type: "none" | "total" | "per-question" | "sudden-death"; seconds?: number };
  questionCount: number;
  continents?: Continent[];
};
```

The engine (a small state machine: `idle → question → feedback → summary`) handles timing, scoring, streaks, and hints identically for every mode. Benefits:

- Adding "Capitals mode" later = a new question renderer + dataset. One day of work, not a rewrite.
- **Multiplayer reuses the exact same engine** — the only difference is that questions arrive from the room channel instead of being generated locally.
- Timer/score/summary UI is built once.

Refactor step for the current code: `GlobeView.tsx` currently mixes rendering, game rules, and data fetching. Split it: globe rendering stays in `globe-guess/`, guess-checking and score move into the engine, and the geojson moves into `src/data/` (bundled locally — the current runtime fetch from a third-party GitHub repo can break or change under you at any time).

---

## 4. One canonical country dataset

Everything keys off ISO 3166 codes, never display names:

```ts
type Country = {
  code: string;              // "FR" — the one true identifier
  name: string;              // "France"
  aliases: string[];         // ["french republic"] — for answer matching
  continent: Continent;
  difficulty: "easy" | "medium" | "hard";   // drives level filtering
  isTerritory: boolean;      // hard mode includes these
  flagUrl: string;           // flagcdn.com serves these free by ISO code
  famousFor?: string[];      // clue strings
};
```

This kills a whole class of bugs (the geojson says "USA", the player types "United States", the flag API wants "us") and makes difficulty levels a simple filter.

---

## 5. Database schema (Postgres via Supabase)

```sql
profiles         (id → auth.users, username unique, avatar_url, country, created_at)
game_results     (id, user_id, mode, difficulty, score, correct_count, question_count,
                  duration_ms, created_at)          -- one row per finished round
daily_challenges (date pk, seed, question_ids jsonb)
daily_results    (user_id, date, score, results jsonb, unique(user_id, date))
rooms            (id, code unique, host_id, config jsonb,
                  status: lobby|playing|finished, created_at)
room_players     (room_id, user_id, score, unique(room_id, user_id))
friends          (user_id, friend_id, status: pending|accepted)
achievements     (id, key, name, description)
user_achievements(user_id, achievement_id, earned_at)
```

Leaderboards are just indexed queries over `game_results` (e.g. best score per user per mode per week) — start with a view, add a materialized view only if it ever gets slow.

---

## 6. Security

### 6.1 The #1 rule: never trust the client's score
The moment a leaderboard exists, someone will open DevTools and try `submitScore(999999)`. So:

- The client **never writes** to `game_results` directly.
- For ranked/daily/multiplayer games, an **Edge Function** runs the round: it deals the questions, checks each answer server-side, tracks time itself, and writes the final score. The client only sends answers.
- Casual/practice games can stay fully client-side (nothing to gain by cheating).
- Add plausibility checks in the function: impossible speed (200 answers in 10s), duplicate submissions, scores above the theoretical max → reject.
- Daily challenge: return one question at a time and don't reveal correct answers until the round is over — otherwise the answer key is sitting in the browser.

### 6.2 Row Level Security (RLS) — on for every table, no exceptions
The Supabase anon key ships in your JS bundle; **RLS policies are your actual security layer**:

```sql
-- examples
profiles:      anyone can read; users update only their own row
game_results:  readable by all (leaderboard); INSERT only via edge function (service role)
rooms:         players read rooms they're in; only host updates config/status
daily_results: users insert/read their own; one row per user per day (unique constraint)
```

Run Supabase's built-in security advisor regularly — it flags tables with RLS off or weak policies.

### 6.3 Multiplayer integrity
- Room codes: 6 chars from an unambiguous alphabet (no 0/O/1/I), random, expire after ~24h.
- The **server (edge function) is the referee**: it deals questions to the room and validates answers + timestamps. Clients only ever broadcast "player X locked in an answer" — never the correct answer, never their own claimed score.
- Validate every realtime message with `zod` before acting on it — other clients are untrusted input, same as user input.

### 6.4 Standard hygiene
- **Secrets**: only `VITE_SUPABASE_URL` + anon key in the client (they're designed to be public *when RLS is on*). Service-role key lives only in Edge Function env vars — never in the repo, never in the bundle. Add `.env` to `.gitignore` now.
- **Input validation**: usernames — length 3–20, restricted charset, uniqueness, and render as text (React escapes by default; never `dangerouslySetInnerHTML` with user content).
- **Rate limiting**: Supabase Auth has it built in; add simple per-user throttles in edge functions (e.g. max 30 score submissions/hour).
- **Dependencies**: `npm audit` in CI; Dependabot on GitHub.
- **Privacy** (needed once you add accounts + ads): a simple privacy policy, cookie consent for ads in the EU, and if kids might play — geography games attract them — avoid collecting anything beyond email, and make leaderboard usernames moderated or auto-generated.

---

## 7. Deployment

- **Frontend**: Vercel or Netlify (free tier, HTTPS automatic, deploys on every git push)
- **Backend**: Supabase cloud (free tier is plenty until you have real traffic)
- Put the repo on GitHub (it isn't a git repo yet) — you get CI, Dependabot, and deploy-on-push for free.

---

## 8. Migration path from today's code

1. `git init`, push to GitHub, set up Vercel deploy
2. Add react-router; turn Home's `startGame` console.log into real navigation
3. Create the canonical country dataset + local geojson; delete the runtime GitHub fetch
4. Extract the game engine from `GlobeView.tsx`; move globe rendering into `features/globe-guess/`
5. Build flag mode on the engine (proves the architecture works)
6. Add Supabase project + auth + `profiles`, `game_results` with RLS from day one
7. Everything after that follows the feature plan phases

---

## Accounts (Supabase) — as built

Project `worldguess`, org `Baghestani-Shaghayegh's Org`, region ap-northeast-1,
free tier ($0/month). Credentials live in `.env`, committed on purpose: the
publishable key only ever grants what row-level security allows.

### Schema

`public.profiles` — one row per signed-in player.

| Column | Notes |
|---|---|
| `id` | PK, FK to `auth.users`, cascades on delete |
| `username` | 3–16 of `[A-Za-z0-9_]`, unique on `lower(username)` |
| `country` | ISO 3166-1 alpha-2, matching `public/flags/<code>.svg`, nullable |
| `created_at` / `updated_at` | `updated_at` maintained by a trigger |

Rows are created by the app once the player picks a name, not by a signup
trigger — the name is theirs to choose.

RLS: anyone may read (a leaderboard has to name who is on it); only the owner
may insert or update their own row; nobody may delete (deleting the auth user
cascades).

### Two things still to do in the Supabase dashboard

Neither can be done from code, and both need your login:

1. **Auth → URL Configuration.** Set Site URL to the deployed site and add
   `http://localhost:5173` to the redirect allow-list. Until then a magic link
   bounces to `http://localhost:3000`.
2. **Auth → Emails / SMTP.** The built-in sender is rate-limited and meant for
   testing. Point it at Resend/Postmark/SES before real players sign up.

Google sign-in is a later addition: create OAuth credentials in Google Cloud,
paste them into Auth → Providers → Google, then add a button that calls
`supabase.auth.signInWithOAuth({ provider: "google" })`.

### Leaderboards

`public.scores` — one immutable row per posted run.

| Column | Notes |
|---|---|
| `user_id` | FK to `auth.users`, cascades on delete |
| `bucket` | the game's own record key: `europe`, `flag:easy@180`, `sudden:find:asia` |
| `points` / `found` / `total` / `ms` | the run, with sanity checks |
| `played_at` | server-set; clients cannot write this column |

A board is one bucket, so it compares like with like — same game type, map,
clock and rules. `public.leaderboard(board, since, limit_to)` returns each
player's *best* run, ranked by points, ties broken by the quicker run then by
whoever got there first. `since` is what makes a board weekly.

RLS: anyone reads; a signed-in player with a profile may insert their own runs
and nothing else. No update or delete policy — a posted run is history.

Two things worth knowing:

- **Backdating** was possible at first. `revoke insert (played_at)` looked
  right but does nothing: a column-level revoke cannot subtract from a
  table-level INSERT grant. The fix is to revoke the table grant and re-grant
  the allowed columns, which is what the schema now does, with a policy check
  on `played_at` behind it.
- **Scores are client-reported.** The browser computes the points and posts
  them, so a determined player can post a score they did not earn. Closing
  that means replaying the round server-side — worth doing if the boards ever
  matter enough to cheat on, not before.

### Multiplayer rooms

Three tables — `rooms`, `room_players`, `room_answers` — and the database is
the match. It holds the questions, which one is on screen, when it opened and
what everyone has scored; both browsers are readers of it. That is what keeps
two players in step without either being in charge.

Every write goes through a `security definer` function: `create_room`,
`join_room`, `start_match`, `submit_answer`, `time_up`, `rematch`,
`leave_room`. There are no insert/update/delete policies at all, so the rules
of a match live in one place instead of six. Select policies grant sight of a
room to its members only.

**Scoring** is decided server-side: 100 for knowing it, up to 100 more for
speed, 50 for beating the room to it. The clock is read from
`question_started_at` in the database, so being quick is worth points and
*claiming* to be quick is not — one of the few things here a client genuinely
cannot fake.

Three things worth knowing:

- **RLS recursed.** The `room_players` select policy asked `room_players` who
  was in the room, which ran its own policy, which asked again. Postgres
  refused every read on all three tables with "infinite recursion detected",
  and the RPCs hid it because `security definer` bypasses RLS. Membership now
  goes through `is_room_member()`, outside RLS.
- **Comparing to NULL is not a test.** In `start_match`, `host_id <> me` with
  a signed-out caller evaluates to NULL, which `IF` treats as false — so an
  anonymous caller fell straight past the host check. Every room function now
  asks whether there is a caller at all, first, and `anon` has no EXECUTE.
- **Correctness is still client-reported.** The browser decides whether a
  click was right; the server decides what that is worth. Same trade as the
  leaderboard, and the fix is the same one: replay the round server-side, if
  it ever matters enough.
