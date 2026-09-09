import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * An auth failure that came back on the URL, read before anything else runs.
 *
 * A failed sign-in returns as `?error=` (the PKCE flow) or `#error=` (the
 * older one). The client below clears that hash the moment it starts, so by
 * the time a component mounts it is already gone — capturing it here, above
 * createClient, is the only place it can still be seen.
 */
function readUrlAuthError(): string | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    query.get("error_description") ??
    hash.get("error_description") ??
    query.get("error") ??
    hash.get("error")
  );
}

export const urlAuthError = readUrlAuthError();

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Whether accounts are wired up at all. A fork without Supabase credentials
 * still plays the whole game — everything is stored in the browser — so the
 * sign-in parts of the UI hide themselves rather than breaking.
 */
export const accountsEnabled = Boolean(url && key);

export const supabase: SupabaseClient | null = accountsEnabled
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Magic links come back with the session in the URL fragment.
        detectSessionInUrl: true,
      },
    })
  : null;
