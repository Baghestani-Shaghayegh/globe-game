import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled, supabase, urlAuthError } from "../lib/supabase";
import {
  describeSaveError,
  saveProfile,
  usernameFree,
  usernameProblem,
} from "../lib/profiles";
import { FLAG_CODE } from "../data/flags";
import { getCountryMeta } from "../data/countries";
import { PageShell } from "../components/SiteHeader";
import { allBuckets } from "../lib/records";
import { refresh, tally } from "../lib/achievements";
import { dayKey, playedDays, streakState } from "../lib/daily";
import { progressFor, totalXp } from "../lib/levels";
import { STAT_ICONS } from "../components/gameIcons";

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
    <PageShell>
      {children}
    </PageShell>
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

/**
 * What an account is actually for, before it is asked for.
 *
 * The page opened on "Sign in" and two buttons: it asked for an email without
 * ever saying what the email buys. Every line here is something the account
 * really does today — the boards, the crowns, the rooms. Notably absent is
 * carrying your records to another device, which sounds like the obvious one
 * and is not true: records, streaks, badges and the practice deck live in this
 * browser, and an account does not move them.
 *
 * No count of what the player has already done, either. A tally of rounds and
 * badges under the heading read as leverage — look what you stand to miss —
 * where the lines below simply say what the thing is.
 *
 * Where local storage ends is on the privacy page rather than under these
 * buttons now. Nothing here claims otherwise; if signing in ever does carry a
 * player's history, this list is where that line belongs, at the top.
 */
function WhySignIn() {
  const lines = [
    {
      title: "Get on the leaderboard",
      body: "Your name and your flag, ranked against everyone else — this week's board and this month's.",
    },
    {
      title: "Claim a crown",
      body: "The hall of fame holds one name per game: whoever cleared all 167 countries fastest. It stays yours until somebody beats it.",
    },
    {
      title: "Play a friend",
      body: "Open a private room, send the six-letter code, and you both get the same questions at the same time.",
    },
  ];

  return (
    <div className="mt-6 rounded-2xl border border-teal-300/25 bg-teal-300/[0.05] p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-50">
        Create a free account
      </h2>

      <ul className="mt-4 space-y-3.5">
        {lines.map((line) => (
          <li key={line.title} className="flex items-start gap-2.5">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-0.5 h-4 w-4 shrink-0 text-teal-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-100">
                {line.title}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-zinc-400">
                {line.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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
      <WhySignIn />

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

    </>
  );
}

/** The pencil that opens an editor, small and unlabelled beside what it edits. */
function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      </svg>
    </button>
  );
}

/**
 * Your flag, worn as the avatar.
 *
 * A player picks a country and it shows up beside their name on every board;
 * here it is the biggest thing on the page, because it is the one piece of
 * identity this game gives out. No flag chosen yet leaves the ring empty
 * rather than filling it with a stranger's face.
 */
function FlagAvatar({ code, onEdit }: { code: string | null; onEdit: () => void }) {
  return (
    <span className="relative inline-block">
      <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-teal-300/40 bg-[#0a1420]">
        {code ? (
          <img
            src={`/flags/${code}.svg`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-10 w-10 text-zinc-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
        )}
      </span>
      <button
        onClick={onEdit}
        aria-label="Change your flag"
        title="Change your flag"
        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#07111c] bg-teal-300 text-[#07111c] transition-colors hover:bg-teal-200"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
        </svg>
      </button>
    </span>
  );
}

/** The day the account was opened, as a person would write it. */
function memberSince(iso?: string): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * The four numbers worth a glance, read from the history in this browser.
 *
 * Deliberately a summary and not a second Records page: each tile is a link
 * to the page that goes into it. They are local figures on a page about the
 * account, which is the honest arrangement while the account does not hold
 * them — see the note on `WhySignIn`.
 */
function Stats() {
  const figures = useMemo(() => {
    const earned = refresh();
    return {
      streak: streakState(dayKey()).days,
      level: progressFor(totalXp(allBuckets(), earned)).level,
      days: playedDays().length,
      badges: tally(earned),
    };
  }, []);

  const tiles = [
    {
      to: "/stats",
      label: "Day streak",
      value: String(figures.streak),
      icon: STAT_ICONS.streak,
    },
    {
      to: "/levels",
      label: "Level",
      value: String(figures.level),
      icon: STAT_ICONS.level,
    },
    {
      to: "/stats",
      label: "Days played",
      value: String(figures.days),
      icon: STAT_ICONS.days,
    },
    {
      to: "/achievements",
      label: "Badges",
      value: `${figures.badges.unlocked}/${figures.badges.total}`,
      icon: STAT_ICONS.badges,
    },
  ];

  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-[0.18em] text-zinc-500">
        Your play
      </h2>
      <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to={tile.to}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center transition-colors hover:border-white/25"
          >
            <span className="flex items-center justify-center gap-2">
              <span className="text-teal-300/90 [&_svg]:h-6 [&_svg]:w-6">
                {tile.icon}
              </span>
              <span className="text-2xl font-semibold tabular-nums text-zinc-50">
                {tile.value}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              {tile.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * The foot of the page: signing out, and closing the account for good.
 *
 * `delete_my_account` takes no arguments: the only account it can delete is
 * the one calling it. Everything held against that account goes with it —
 * profile, posted scores, any rooms — because all of it cascades from the
 * user row. What stays is what was never on the server: the records, streak
 * and badges in this browser, which is said here rather than discovered.
 */
function AccountFooter() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!supabase || working) return;
    setWorking(true);
    setError(null);
    const { error: failed } = await supabase.rpc("delete_my_account");
    if (failed) {
      setError(failed.message);
      setWorking(false);
      return;
    }
    await signOut();
    navigate("/");
  };

  return (
    <section className="mt-10 border-t border-white/[0.07] pt-6">
      {asking ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/[0.06] p-5">
          <p className="text-sm text-zinc-100">
            Delete your account for good?
          </p>
          <p className="mt-1.5 text-sm text-zinc-400">
            Your name, your flag and every score you have posted go with it,
            and the name is free for someone else to take. Your records,
            streak and badges are in this browser and stay there.
          </p>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          {/* Keeping the account is the button; deleting it is the quiet
              link beside it. The weight belongs to the way out, not the way
              through — a filled button under a question about deleting
              everything invites the press it should be slowing down. */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={() => setAsking(false)}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-[#07111c] transition-colors hover:bg-white"
            >
              Keep my account
            </button>
            <button
              onClick={() => void remove()}
              disabled={working}
              className="text-sm text-rose-300/80 underline underline-offset-4 transition-colors hover:text-rose-200 disabled:opacity-50"
            >
              {working ? "Deleting…" : "Yes, delete it"}
            </button>
          </div>
        </div>
      ) : (
        // The two ways out of an account, on one line: the ordinary one on
        // the left, and the one nobody is looking for off in the corner.
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => void signOut()}
            className="text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
          >
            Sign out
          </button>
          <button
            onClick={() => setAsking(true)}
            className="text-sm text-zinc-600 underline underline-offset-4 transition-colors hover:text-rose-300"
          >
            Delete my account
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The signed-in half: who you are, and a pencil beside each part of it.
 *
 * It was a form — two fields and a Save button, shown in full whether or not
 * anything was being changed. Almost nobody changes their name twice, so the
 * page now shows the name, the flag and the day you joined, and asks for the
 * form only when a pencil is pressed.
 */
function ProfileForm({
  userId,
  email,
  createdAt,
}: {
  userId: string;
  email?: string;
  createdAt?: string;
}) {
  const { profile, refresh } = useAuth();
  const options = useMemo(flagOptions, []);
  const [editing, setEditing] = useState<"name" | "flag" | null>(null);
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setCountry(profile?.country ?? "");
  }, [profile]);

  // A fresh account has no name, and the boards cannot list one without it —
  // so the name editor opens itself rather than waiting to be found.
  const naming = editing === "name" || !profile;
  const joined = memberSince(createdAt);

  const commit = async (nextName: string, nextCountry: string) => {
    if (saving) return;
    const problem = usernameProblem(nextName);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Only worth asking about a name that is actually changing: checking
      // your own name against the table is a round trip to be told yes.
      if (
        nextName !== profile?.username &&
        !(await usernameFree(nextName, userId))
      ) {
        setError("That name is taken. Try another.");
        return;
      }
      await saveProfile({
        id: userId,
        username: nextName,
        country: nextCountry || null,
      });
      await refresh();
      setEditing(null);
    } catch (caught) {
      setError(describeSaveError(caught));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setUsername(profile?.username ?? "");
    setCountry(profile?.country ?? "");
    setError(null);
    setEditing(null);
  };

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-5">
        <FlagAvatar
          code={profile?.country ?? null}
          onEdit={() => {
            setError(null);
            setEditing("flag");
          }}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-2xl font-semibold tracking-tight text-zinc-50">
              {profile?.username ?? "No name yet"}
            </h2>
            {profile && (
              <EditButton
                label="Change your name"
                onClick={() => {
                  setError(null);
                  setEditing("name");
                }}
              />
            )}
          </div>

          {joined && (
            <p className="mt-1 text-sm text-zinc-500">Member since {joined}</p>
          )}
          {email && (
            <p className="mt-0.5 truncate text-sm text-zinc-600">{email}</p>
          )}
        </div>
      </div>

      {naming && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void commit(username, country);
          }}
          className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <label htmlFor="username" className="block text-sm text-zinc-400">
            {profile ? "Change your name" : "Pick the name other players see"}
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="worldwalker"
            autoComplete="off"
            autoFocus
            className={`mt-1.5 ${inputClass}`}
          />
          <p className="mt-1.5 text-xs text-zinc-600">
            3–16 characters. Letters, numbers and underscores.
          </p>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || username === profile?.username}
              className="rounded-lg bg-teal-300 px-4 py-2 text-sm font-semibold text-[#07111c] transition-colors hover:bg-teal-200 disabled:opacity-40"
            >
              {saving ? "Saving…" : profile ? "Save name" : "Claim this name"}
            </button>
            {profile && (
              <button
                type="button"
                onClick={cancel}
                className="text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {editing === "flag" && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <label htmlFor="country" className="block text-sm text-zinc-400">
            Your flag <span className="text-zinc-600">(optional)</span>
          </label>
          {/* The browser's own arrow sits hard against the border of a
              full-width select. Ours is drawn instead, with room around it,
              the way the map picker on the menu does it. */}
          <div className="relative mt-1.5">
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={`appearance-none pr-11 ${inputClass}`}
            >
              <option value="">No flag</option>
              {options.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void commit(username, country)}
              disabled={saving || country === (profile?.country ?? "")}
              className="rounded-lg bg-teal-300 px-4 py-2 text-sm font-semibold text-[#07111c] transition-colors hover:bg-teal-200 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save flag"}
            </button>
            <button
              onClick={cancel}
              className="text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <Stats />

      <AccountFooter />
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
        My profile
      </h1>

      {loading ? (
        <p className="mt-6 text-zinc-500">One moment…</p>
      ) : session ? (
        <ProfileForm
          userId={session.user.id}
          email={session.user.email}
          createdAt={session.user.created_at}
        />
      ) : (
        <SignIn />
      )}
    </Shell>
  );
}
