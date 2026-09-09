import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled, supabase, urlAuthError } from "../lib/supabase";
import {
  describeSaveError,
  hasUnsavedChanges,
  saveProfile,
  usernameFree,
  usernameProblem,
} from "../lib/profiles";
import { FLAG_CODE } from "../data/flags";
import { getCountryMeta } from "../data/countries";

/** Every country the game ships a flag for, by the name a player would look for. */
function flagOptions(): { code: string; name: string }[] {
  return Object.entries(FLAG_CODE)
    .map(([geoName, code]) => ({
      code,
      name: getCountryMeta(geoName).displayName,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>
        {children}
      </main>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40";

/** Google's four-colour G, inline so it can't be blocked or fail to load. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Whether the failure was Google simply not being switched on yet in the
 * Supabase dashboard. Worth its own message: the button looks broken, but the
 * fix is a setting rather than anything a player can do.
 */
function providerDisabled(message: string): boolean {
  return /provider is not enabled|unsupported provider/i.test(message);
}

/**
 * The failure a sign-in came back with, in words worth reading. It is captured
 * at startup rather than looked up here — see `urlAuthError`.
 */
function oauthErrorFromUrl(): string | null {
  if (!urlAuthError) return null;
  return providerDisabled(urlAuthError)
    ? "Google sign-in isn't switched on for this site yet. Use your email instead."
    : urlAuthError;
}

/** The signed-out half: ask for an email, send a link, say so. */
function SignIn() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(oauthErrorFromUrl);
  const [goingToGoogle, setGoingToGoogle] = useState(false);

  // Having read the failure, take it off the address bar: a reload shouldn't
  // re-raise an error the player has already seen and moved past. Only an
  // error URL is cleared — a magic link arrives carrying its tokens in the
  // same place, and supabase-js needs to read them before anyone wipes them.
  useEffect(() => {
    if (oauthErrorFromUrl()) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Sends the browser to Google and back. On success the page navigates away,
  // so there is nothing to reset — only a failure returns here.
  const withGoogle = async () => {
    if (!supabase || goingToGoogle) return;
    setGoingToGoogle(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (error) {
      setError(
        providerDisabled(error.message)
          ? "Google sign-in isn't switched on for this site yet. Use your email below."
          : error.message,
      );
      setGoingToGoogle(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || sending) return;
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-zinc-100">Check your email.</p>
        <p className="mt-2 text-sm text-zinc-400">
          A sign-in link is on its way to{" "}
          <span className="text-zinc-200">{sentTo}</span>. Open it on this
          device and you'll land back here, signed in.
        </p>
        <button
          onClick={() => setSentTo(null)}
          className="mt-4 text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={withGoogle}
        disabled={goingToGoogle}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg bg-white py-2.5 text-sm font-medium text-[#1f1f1f] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <GoogleMark />
        {goingToGoogle ? "Taking you to Google…" : "Continue with Google"}
      </button>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wider text-zinc-600">
          or
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={submit}>
        <label htmlFor="email" className="block text-sm text-zinc-400">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`mt-1.5 ${inputClass}`}
        />
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="mt-4 w-full rounded-lg bg-sky-500/20 py-2.5 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      <p className="mt-5 text-sm text-zinc-500">
        No password either way. You can keep playing without an account; signing
        in is what makes your name show up on a leaderboard.
      </p>
    </>
  );
}

/** The signed-in half: pick a name and a flag, or change them later. */
function ProfileForm({ userId, email }: { userId: string; email?: string }) {
  const { profile, refresh, signOut } = useAuth();
  const options = useMemo(flagOptions, []);
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setCountry(profile?.country ?? "");
  }, [profile]);

  const dirty = hasUnsavedChanges(username, country, profile);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const problem = usernameProblem(username);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (!(await usernameFree(username, userId))) {
        setError("That name is taken. Try another.");
        return;
      }
      await saveProfile({
        id: userId,
        username,
        country: country || null,
      });
      await refresh();
    } catch (caught) {
      setError(describeSaveError(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p className="mt-2 text-sm text-zinc-500">
        Signed in{email ? ` as ${email}` : ""}
      </p>

      {!profile && (
        <p className="mt-6 rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-4 py-3 text-sm text-zinc-300">
          One thing left: pick the name other players will see.
        </p>
      )}

      <form onSubmit={submit} className="mt-6">
        <label htmlFor="username" className="block text-sm text-zinc-400">
          Player name
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="worldwalker"
          autoComplete="off"
          className={`mt-1.5 ${inputClass}`}
        />
        <p className="mt-1.5 text-xs text-zinc-600">
          3–16 characters. Letters, numbers and underscores.
        </p>

        <label htmlFor="country" className="mt-5 block text-sm text-zinc-400">
          Flag <span className="text-zinc-600">(optional)</span>
        </label>
        <div className="mt-1.5 flex items-center gap-3">
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={inputClass}
          >
            <option value="">No flag</option>
            {options.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
          {country && (
            <img
              src={`/flags/${country}.svg`}
              alt=""
              width={40}
              height={30}
              className="w-10 shrink-0 rounded border border-white/15"
            />
          )}
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <button
          type="submit"
          disabled={saving || !dirty}
          className="mt-6 w-full rounded-lg bg-sky-500/20 py-2.5 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30 disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : !profile
              ? "Claim this name"
              : dirty
                ? "Save changes"
                : "Saved"}
        </button>
      </form>

      <button
        onClick={() => void signOut()}
        className="mt-6 text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
      >
        Sign out
      </button>
    </>
  );
}

export default function Account() {
  const { loading, session } = useAuth();

  if (!accountsEnabled) {
    return (
      <Shell>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Account
        </h1>
        <p className="mt-4 text-zinc-400">
          This copy of the game is running without accounts configured.
          Everything still works — your records live in this browser.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
        {session ? "Your account" : "Sign in"}
      </h1>

      {loading ? (
        <p className="mt-6 text-zinc-500">One moment…</p>
      ) : session ? (
        <ProfileForm userId={session.user.id} email={session.user.email} />
      ) : (
        <SignIn />
      )}
    </Shell>
  );
}
