# WorldGuess

A browser geography game. React + TypeScript + Vite, react-globe.gl over
three.js, Tailwind v4, Supabase for accounts, leaderboards and multiplayer.

## Deploying to Vercel

`vercel.json` is committed, so there is nothing to configure in the dashboard:
it sets the build command, the output directory, the single-page rewrite every
route past `/` depends on, and the cache headers.

From the repository root:

```sh
npx vercel login      # once, per machine
npx vercel            # a preview URL, safe to throw away
npx vercel --prod     # the URL to hand to other people
```

The production URL looks like `https://<project>.vercel.app` and works from
any machine. A custom domain can be attached later without changing anything
here.

### Two things to do before sharing the link

**Supabase Auth.** Sign-in redirects back to whatever URL Supabase has been
told to allow, so until the deploy URL is on that list anyone who tries to
sign in is bounced. In the Supabase dashboard, under **Authentication → URL
Configuration**, set the Site URL to the production URL and add
`https://<project>.vercel.app/**` to the redirect allow-list. Add the preview
URL too if testers will use one.

This has never been exercised end to end — the sandbox this was built in
blocks `*.supabase.co` — so click through a real sign-in once before handing
the link out.

**The contact address.** `CONTACT` in `src/pages/Privacy.tsx` is still
`privacy@worldguess.example`. Fine for testing, not for anything public.

### What does not need configuring

`.env` is committed on purpose and carries the Supabase URL and publishable
key, both of which are meant to be public — the publishable key only ever
grants what row-level security allows. Vercel picks them up from the build, so
no environment variables need setting.

AdSense stays dark: `VITE_ADSENSE_CLIENT` and `VITE_ADSENSE_SLOT` are empty, so
no ad code runs and the cookie banner never appears. That is what every build
should do until the site is approved.

### The rewrite is not optional

Every route other than `/` — `/daily`, `/leaderboard`, `/room/ABCD` — is
client-side. Without the rewrite in `vercel.json` they return 404 when opened
directly or refreshed, which is exactly what a tester following a link does.
The rewrite runs after the filesystem check, so real files are still served:
`/data/world.geojson`, `/sw.js` and the flags are not swallowed by it.

---

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
