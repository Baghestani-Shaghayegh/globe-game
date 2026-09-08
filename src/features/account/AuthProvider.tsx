import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { accountsEnabled, supabase } from "../../lib/supabase";
import { getProfile, type Profile } from "../../lib/profiles";

type AuthState = {
  /** Still working out whether anyone is signed in. */
  loading: boolean;
  session: Session | null;
  /** Null while signed out, and null for a signed-in player who hasn't named
   *  themselves yet — which is what the account page asks for. */
  profile: Profile | null;
  /** Re-reads the profile after it's been edited. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Context = createContext<AuthState>({
  loading: false,
  session: null,
  profile: null,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(accountsEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session);
    });

    // Fires for the initial session, magic-link returns, refreshes and sign-out.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      setProfile(await getProfile(userId));
    } catch {
      // A profile that won't load shouldn't lock anyone out of the game.
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!accountsEnabled) return;
    void load();
  }, [load]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      refresh: load,
      signOut: async () => {
        await supabase?.auth.signOut();
        setProfile(null);
      },
    }),
    [loading, session, profile, load]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(Context);
}
