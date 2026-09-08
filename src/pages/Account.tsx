import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled, supabase } from "../lib/supabase";
import {
  describeSaveError,
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

/** The signed-out half: ask for an email, send a link, say so. */
function SignIn() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <form onSubmit={submit} className="mt-6">
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
      <p className="mt-4 text-sm text-zinc-500">
        No password to remember — the link signs you in. You can keep playing
        without an account; signing in is what makes your name show up on a
        leaderboard.
      </p>
    </form>
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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setCountry(profile?.country ?? "");
  }, [profile]);

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
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
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

        <label
          htmlFor="country"
          className="mt-5 block text-sm text-zinc-400"
        >
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
          disabled={saving}
          className="mt-6 w-full rounded-lg bg-sky-500/20 py-2.5 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30 disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved" : profile ? "Save changes" : "Claim this name"}
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
