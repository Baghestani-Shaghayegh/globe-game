import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt", not "autoUpdate": autoUpdate reloads the page the moment a
      // new build lands, and a reload in the middle of a timed round costs the
      // player that round. The new version waits, and a toast offers it.
      registerType: "prompt",
      // The manifest is hand-written and linked from index.html; the plugin is
      // here for the service worker only.
      manifest: false,
      injectRegister: null,
      workbox: {
        // Most of the game runs off the player's own device, so the shell and
        // the map are worth having offline: the daily challenge is seeded from
        // the date, and records, practice and badges are all local.
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}", "data/*.geojson"],
        // The flags match the svg pattern above, and precaching all 1.7 MB of
        // them would make a first visit pay for 170 files to see six. They are
        // cached on use instead, by the rule below.
        // og.png is the link-preview image: 560 KB that only ever leaves the
        // server for a social-media crawler. The app itself never loads it.
        globIgnores: ["**/flags/**", "og.png"],
        // The three.js bundle is 2.3 MB, over Workbox's 2 MiB default. Without
        // this the one file the game cannot start without is the one file left
        // out of the cache.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // 170-odd flags, 1.7 MB in total, and a given player sees a handful.
        // Cached as they are used rather than all downloaded up front.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/flags/"),
            handler: "CacheFirst",
            options: {
              cacheName: "worldguess-flags",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
        // A single-page app: any unknown path is the app, not a 404 — except
        // Supabase and ad traffic, which must never be answered from a cache.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /supabase/, /googlesyndication/],
      },
      devOptions: {
        // Off in development: a service worker caching a dev server is a
        // reliable way to spend an afternoon debugging a stale file.
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
  },
});
