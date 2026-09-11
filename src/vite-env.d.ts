/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** AdSense publisher id, e.g. "ca-pub-…". Absent until the site is approved. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** The responsive ad unit the slots render. Absent alongside the id above. */
  readonly VITE_ADSENSE_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
