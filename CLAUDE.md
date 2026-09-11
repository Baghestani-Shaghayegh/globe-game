# WorldGuess — working notes

A browser geography game. React + TypeScript + Vite, react-globe.gl over
three.js, Tailwind v4, Supabase for accounts, leaderboards and multiplayer.

## How to report back

**After finishing anything — a feature, a fix, a refactor — show a table in the
conversation summarising what changed.** Sara asked for this explicitly. One
row per thing built or fixed, with what it does and whether it was verified.
Keep it in the chat; don't make an artifact for it.

Say plainly what was *not* verified. Several things here can only be tested on
Sara's machine (see Environment below), and claiming otherwise is worse than
admitting the gap.

## Branches

Develop on `develop`, promote to `main` when asked. Never push to `main`
without being asked — `main` is what deploys.

## Environment gotchas

- The sandbox's egress policy **blocks `*.supabase.co`** (403 on CONNECT). So
  anything needing a live Supabase round trip — sign-in, leaderboard reads,
  multiplayer realtime — cannot be tested from here. The Supabase MCP tools
  work, so schema, RLS and SQL functions *can* be tested properly.
- The git proxy refuses ref deletions, so remote branches must be deleted from
  the GitHub UI.
- After any dependency change, Sara needs `npm install` locally, and
  `rm -rf node_modules/.vite` if the dev server was running.
- The service worker is **off in `vite dev`** on purpose. To exercise offline
  or the update toast, `npm run build && npm run preview`.
- Ads and the cookie banner stay dark unless `VITE_ADSENSE_CLIENT` and
  `VITE_ADSENSE_SLOT` are set, which they are not in the repo. Set them on the
  command line to see either one.

## Conventions

- Every feature that stores anything guards `localStorage` in try/catch and
  starts fresh on a corrupt value.
- Derived features (badges, XP, practice) read the history the game already
  keeps rather than starting their own ledger, so switching them on never
  resets anyone.
- Verify by measuring, not asserting: pixel samples for colour, real distances
  for geography, seeded SQL for board rankings. Test data gets deleted after.
- `theme` in `lib/globeTheme.ts` is a live mutable object — the globes read it
  at render time, so a palette swap recolours everything without touching
  imports.
- Anything new that writes to `localStorage` must be added to `LOCAL_KEYS` in
  `lib/localData.ts`, or "clear my data" silently misses it. A test compares
  the list against every key the source writes, so forgetting fails the suite.
