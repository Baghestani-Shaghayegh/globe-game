import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
