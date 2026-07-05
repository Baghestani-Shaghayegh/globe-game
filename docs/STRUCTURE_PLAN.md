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
