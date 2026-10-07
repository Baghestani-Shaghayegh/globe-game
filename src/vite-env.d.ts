/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** AdSense publisher id, e.g. "ca-pub-…". Absent until the site is approved. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** The responsive ad unit the slots render. Absent alongside the id above. */
  readonly VITE_ADSENSE_SLOT?: string;
  /** "1" shows the Share it on row (TikTok, Instagram, YouTube) in the video panel. */
  readonly VITE_SHOW_POSTING?: string;
  /** "1" lets the YouTube compose step connect and post directly. */
  readonly VITE_YOUTUBE_DIRECT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
