import { Link } from "react-router-dom";

/**
 * Where to write about data. A real address is required before publishing —
 * an ad network will check, and a policy nobody can reply to is not a policy.
 * Swap this for one on the game's own domain once there is one.
 */
const CONTACT = "privacy@worldguess.example";

/** The date the wording below last changed, not the date it was rendered. */
const UPDATED = "11 September 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Privacy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated {UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-zinc-300">
          WorldGuess is a geography game. You can play all of it without an
          account, and most of what it remembers never leaves your device.
        </p>

        <Section title="What stays on your device">
          <p>
            Your records, streaks, badges, level, per-country statistics and
            practice deck are stored in your browser&rsquo;s local storage. They
            are not sent anywhere, they are not readable by us, and clearing
            your browser data deletes them for good. There is no backup.
          </p>
          <p>
            The same store holds your settings — globe palette, whether hints
            are on, and your answer to the cookie question below.
          </p>
        </Section>

        <Section title="If you make an account">
          <p>
            An account exists so your name can appear on a leaderboard and so
            you can play against a friend. Making one stores your email address,
            the player name you choose, the flag you pick, and the scores you
            submit. Other players can see your player name, flag, scores and
            level; nobody but you sees your email.
          </p>
          <p>
            Accounts and scores are held by Supabase, which runs the database
            and sends the sign-in emails on our behalf. If you sign in with
            Google, Google tells us your email address and nothing else — no
            contacts, no profile, no access to anything in your account.
          </p>
          <p>
            There is no password to lose: signing in means clicking a link we
            email you, or using Google.
          </p>
        </Section>

        <Section title="Advertising">
          <p>
            The game is free and paid for by ads. Ad networks set cookies to
            measure whether an ad was seen and, unless you say otherwise, to
            choose which ads to show you.
          </p>
          <p>
            We ask before any of that happens. Say no and the ad scripts are
            never loaded at all — not loaded-but-limited, simply not loaded.
            Either answer is remembered, and you can change it at any time
            under{" "}
            <Link
              to="/settings"
              className="text-zinc-200 underline underline-offset-4 hover:text-zinc-50"
            >
              Settings
            </Link>
            .
          </p>
        </Section>

        <Section title="What we don't do">
          <p>
            There is no analytics script, no tracking pixel, and no third-party
            code on the page beyond the ad slots described above. We do not sell
            anything to anyone, and we do not email you except to send a sign-in
            link you asked for.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Everything held on your device can be erased from{" "}
            <Link
              to="/settings"
              className="text-zinc-200 underline underline-offset-4 hover:text-zinc-50"
            >
              Settings
            </Link>
            , which clears it immediately and without asking us.
          </p>
          <p>
            To delete an account and the scores attached to it, write to{" "}
            <a
              href={`mailto:${CONTACT}`}
              className="text-zinc-200 underline underline-offset-4 hover:text-zinc-50"
            >
              {CONTACT}
            </a>{" "}
            from the address the account uses. Deleting an account removes its
            leaderboard entries too.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The game is suitable for any age, but an account needs an email
            address, and ad networks set their own age rules. If you are under
            13, play without an account.
          </p>
        </Section>

        <Section title="Getting in touch">
          <p>
            Questions about any of this go to{" "}
            <a
              href={`mailto:${CONTACT}`}
              className="text-zinc-200 underline underline-offset-4 hover:text-zinc-50"
            >
              {CONTACT}
            </a>
            .
          </p>
        </Section>

        <Link
          to="/"
          className="mt-10 inline-block text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
        >
          Back to the game
        </Link>
      </main>
    </div>
  );
}
