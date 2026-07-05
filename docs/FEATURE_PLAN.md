# WorldGuess — Feature Plan

A phased plan: each phase is shippable on its own. Don't start a phase until the previous one is playable and stable — this keeps the game always working while it grows.

---

## Phase 1 — Core single-player game (no accounts needed)

Goal: make the existing game genuinely fun and complete before adding social features.

### 1.1 Game modes
| Mode | How it plays |
|------|--------------|
| **Globe Guess** (exists) | Click a highlighted country on the globe, type its name |
| **Flag Guess** | A flag is shown, player types (or picks) the country |
| **Famous For** | Clue like "Home of the Eiffel Tower" or "Famous for sushi and Mount Fuji" → guess the country |
| **Find the Country** (reverse mode) | Game says "Click on Mongolia" and the player must find it on the globe — great for learning |

### 1.2 Difficulty levels (apply to every mode)
- **Easy** — ~50 well-known countries (USA, France, Japan, Brazil…)
- **Medium** — all 195 UN-recognized countries (your current `recognizedCountries` list)
- **Hard** — countries + territories, dependencies, and islands (Greenland, Faroe Islands, Réunion, Guam…)
- Optional: **Continent filters** (only Europe, only Africa…) — very popular in geography games because it's how people actually study.

### 1.3 Timer & round options
- **Relaxed** — no timer, learn at your own pace
- **Timed round** — e.g. how many can you get in 3 minutes
- **Sudden death** — one wrong answer ends the run; score = streak length
- **Per-question timer** — 15 seconds per flag/clue (used later in multiplayer)

### 1.4 Scoring, hints, quality-of-life
- Points per correct answer, bonus for speed and streaks
- Hints that cost points: first letter, continent, zoom to region
- Forgiving answer matching: accept "USA" / "United States", ignore accents ("Türkiye" = "Turkiye"), allow small typos (Levenshtein distance ≤ 1–2)
- End-of-round summary screen: score, accuracy, which ones you missed (this is the learning moment — people love it)
- Fix: currently a wrong guess shows the answer in an `alert()` — replace with proper in-UI feedback and don't reveal the answer until the round ends

---

## Phase 2 — Accounts, leaderboard, daily challenge

Goal: give players a reason to come back every day.

### 2.1 Accounts (Supabase Auth)
- Sign in with Google / Apple / email magic link (no passwords to manage)
- Guest play always allowed — only require sign-in to *save* scores
- Profile: username, avatar, country flag of the player

### 2.2 Leaderboards
- Global + **weekly** leaderboard per mode & difficulty (weekly reset matters — a global all-time board gets frozen at the top and new players give up)
- Friends leaderboard once friends exist (Phase 3)
- Personal stats page: accuracy per continent, most-missed countries, play streak

### 2.3 Daily Challenge ⭐ (the single biggest retention feature)
- One shared challenge per day for everyone (same 10 countries/flags, same order — generated from the date as a seed)
- Everyone can compare results → shareable result card ("WorldGuess #142 — 9/10 🟩🟩🟩🟥…") like Wordle. This is free viral marketing.
- Daily streak counter ("🔥 12-day streak") — the #1 habit mechanic

---

## Phase 3 — Multiplayer rooms

Goal: play with friends. Start small: 2 players, one mode.

### 3.1 Private rooms
- Host creates a room → gets a 6-character code / share link
- Friend joins with the code, host picks mode + difficulty + rounds, presses start
- Both see the same questions simultaneously; faster correct answer gets more points
- Live opponent progress ("Sara answered! ✓") + end-of-match result screen with rematch button
- Built on Supabase Realtime channels (see structure plan) — no separate game server needed at this scale
- Later: up to 8 players per room, spectator mode, public quick-match

---

## Phase 4 — Retention & progression

- **Achievements/badges**: "All of Europe", "50 flags in a row", "Speed demon"
- **XP & levels**: every game gives XP; levels unlock cosmetic globe themes (night mode globe, satellite texture, colors)
- **Practice weak spots**: "You keep missing Central Asia — practice these 8 countries" (spaced repetition — this turns the game into a study tool, which is a huge audience: students, quiz-bowl kids, geography teachers)
- Push/email notification for daily challenge (opt-in only)

---

## Phase 5 — Monetization (only after you have regular players)

Order matters: retention first, money second. Ads on a game with 50 users earns cents; the same ads with 50k users is real money.

### Ads (first, easiest)
- Web: Google AdSense — banner on menu/results screens only. **Never** interrupt gameplay.
- Mobile (later, via Capacitor): AdMob — optional *rewarded* ads work best ("watch an ad → get 3 hints"), players choose them voluntarily.

### Subscription / Premium (~$2–4/month or small one-time purchase)
- Remove ads
- Detailed stats & practice-weak-spots mode
- Cosmetic globe themes
- Larger multiplayer rooms
- Keep the core game 100% free — geography games live or die on player count.

---

## Platform: website vs. mobile app → **Website first, then wrap it**

Recommendation: **stay web-first**, and get both later almost for free:

1. **Now**: make the site fully responsive + a **PWA** (installable from the browser, home-screen icon, works offline for practice modes). Zero app-store fees, instant updates, shareable links — and shareable links are what make the daily challenge spread.
2. **Later** (when you have players): wrap the *same* React codebase with **Capacitor** to publish to the App Store / Play Store. One codebase, three platforms.
3. Building a separate native mobile app now would double your work for the same game. Not worth it before you have an audience.

One caveat: test the 3D globe on real phones early — three.js can be heavy on low-end devices. Have a 2D map fallback (or flag/clue modes, which don't need the globe at all) for weak devices.

---

## Idea backlog — more ways to make the game interesting

Not scheduled into phases; pull from here whenever the game needs freshness. Roughly ordered by impact-for-effort.

### New quiz content (cheap to add once the game engine exists)
- **Outline/shape quiz** — show a country's silhouette, guess the country (one of the most popular geography quiz formats anywhere)
- **Capitals mode** — capital → country and country → capital
- **Border pathfinding** (like the game *Travle*) — "get from Spain to India" by naming a chain of bordering countries; extremely replayable
- **Name-them-all sprint** — "name as many countries as you can in 10 minutes", globe fills in as you type (Sporcle's most-played quiz of all time is exactly this)
- **Higher/lower** — "Which has more people: Vietnam or Germany?" — works for population, area, GDP; fast and addictive
- **Landmark photo mode** — photo of Machu Picchu → guess Peru (needs curated images)
- **Audio modes** — guess by national anthem or by spoken language sample (very shareable clips)
- **Themed packs** — currencies, US states, world rivers, "flags that look alike" (Chad vs Romania…)

### Competition & community
- **Weekly tournament / seasons** — everyone plays the same gauntlet, rankings reset each season with badges for top finishers
- **Ranked duels with ELO** — 1v1 quick-match with a visible rating; gives hardcore players a ladder to climb
- **Custom quiz creator** — players build & share their own quiz (own link); user-generated content = content you don't have to make
- **Classroom mode** — teacher hosts a live quiz for their class, Kahoot-style, sees results per student. Teachers are a distribution channel: one teacher = 30 new players, every semester, forever.

### Collection & personality
- **Passport / country collection** — every country you've "mastered" (guessed correctly N times) gets a stamp in your passport; completionists will grind for all 195
- **Mastery map** — your personal globe colored by how well you know each country (green = mastered, red = keeps beating you)
- **Globe cosmetics** — unlockable themes: night lights, satellite, vintage map, low-poly (pairs with XP/premium)

### Reach
- **Localization** — the game is mostly country names + short strings; translating the UI into Spanish/Portuguese/German/French multiplies the audience cheaply
- **Offline practice** (PWA) — practice modes work with no connection; great for commutes and school wifi

---

## Suggested build order (realistic solo-dev sequence)

1. Routing + game engine refactor (see structure plan) — foundations
2. Flag mode + difficulty levels + timer + scoring/summary screen → **launch this**
3. Supabase auth + leaderboard + daily challenge → **tell people about it**
4. Famous For mode (needs a curated clue dataset — start with ~100 countries × 3 clues)
5. Multiplayer rooms
6. Achievements, XP, practice mode
7. PWA polish → ads → Capacitor mobile apps → premium
