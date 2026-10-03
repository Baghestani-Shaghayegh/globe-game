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

**End every reply — not just finished work, every one — with a three-line
status block in a code block.** Sara asked for this explicitly too. Short, one
line each, in this exact shape:

```
✅ Done: <what this reply finished, in a few words>
⬜ Left: <what remains, items separated by · >
👉 You: <the one next thing Sara should do or decide>
```

If nothing is left, say so on the Left line rather than dropping it. The You
line is a single concrete action — a decision to make, something to test on
her machine, a reply to send — never a vague "let me know".

## References

Sites Sara has pointed at are listed in `docs/REFERENCES.md`, each with what
it is for. Read it before planning new features or a redesign, and add to it
whenever she shares another one.

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
- The recorded country and capital names in `public/voice` are made by
  `npm run voices`, which needs `GOOGLE_TTS_API_KEY` (Google Cloud
  Text-to-Speech). Without clips the lessons fall back to the device's voice.
  Pronunciations to force live in `scripts/voice/lexicon.tsv`; Sara reviews
  the clips on the unlinked `/voices` page.
- Replays (`lib/replay*.ts`) record a round's moves, not the screen, and
  render the 9:16 video in the browser with Mediabunny. The sandbox's
  Chromium has no H.264 encoder, so videos made here are WebM (VP9); real
  Chrome and Safari make MP4. Posted replays live in the `replays` table,
  one per score, readable by anyone, writable only by the run's owner. Every
  game records: the six globe rounds, the daily hunt, Mystery, Connect and
  Which is bigger? (that one has no board, so it's watched and saved, not posted).
- Player feedback (the `/feedback` page, linked from the footer and Settings)
  lands in the `feedback` table: anyone can insert, nobody can read through
  the API. It keeps the message, the page it was sent from and an optional
  email; the browser type is deliberately not collected. Sara reads it in the Supabase dashboard (Table Editor → feedback);
  `handled` is hers to tick. A trigger stops floods at 30 per 10 minutes.
- Sharing a video goes through one panel (`features/replay/ShareVideo.tsx`):
  Share (the device's own menu, which lists every app installed, KakaoTalk
  included, on Macs as on phones), Download, and Post to TikTok / Instagram /
  YouTube. Only a browser with no share menu gets "Send the link" buttons
  instead (`lib/shareTargets.ts`); "Challenge a friend" follows the same rule. Posting is "save the video,
  copy the caption, open the upload page" until a platform approves the app;
  then its entry in `POSTING` flips to `"direct"` (the server route for it is
  still to build). `VITE_KAKAO_JS_KEY` (developers.kakao.com) only adds a Kakao
  button to that fallback row; it's optional and not set.
- Ads and the cookie banner stay dark unless `VITE_ADSENSE_CLIENT` and
  `VITE_ADSENSE_SLOT` are set, which they are not in the repo. Set them on the
  command line to see either one.

## Conventions

- The home page's Today's challenges block (the header strip and the four
  daily cards) is settled as of 3 October 2026. Sara asked for it to be left
  as it is: don't restyle it, or apply a new font to it, unless she asks.
- The site never names Sara. Player-facing text speaks as the game ("Every
  message is read"), not as a person; comments in the code are fine.
- Anything a player reads follows `docs/WRITING.md`: short, concrete, in the
  game's voice, and free of the patterns that make text read as AI-written.
- **Every commit message starts with a Conventional Commits prefix** — `feat:`,
  `fix:`, `refactor:`, `perf:`, `test:`, `chore:`, `docs:`. The repo has used
  them since the first commit; a stretch in the middle of September 2026 that
  doesn't is a lapse, not a change of mind.
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
- Clues (`data/clues.ts`) are five per country, best known first; Famous for
  reads them in that order and the Five clues daily reads them backwards. A
  clue never names the country, its people or its capital, and never makes a
  country famous for a war, a disaster or hardship. The tests catch most of
  it; the rest is read by hand.
- Anything new that writes to `localStorage` must be added to `LOCAL_KEYS` in
  `lib/localData.ts`, or "clear my data" silently misses it. A test compares
  the list against every key the source writes, so forgetting fails the suite.
