import { Link } from "react-router-dom";
import { PageShell } from "../components/SiteHeader";

/** Same address as the privacy page: one place to write to. */
const CONTACT = "privacy@guessglobe.com";

/** The date the wording below last changed, not the date it was rendered. */
const UPDATED = "4 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

const link = "text-zinc-200 underline underline-offset-4 hover:text-zinc-50";

export default function Terms() {
  return (
    <PageShell>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">Terms</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated {UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-zinc-300">
        By playing GuessGlobe you agree to what is written here. It is short because the game is simple.
      </p>

      <Section title="Playing">
        <p>
          The game is free. You can play every mode without an account. Maps, flags, capitals and country facts are
          there to learn from and are checked, but a border or a name can be disputed or change. If you find one that
          is wrong, tell us on the{" "}
          <Link to="/feedback" className={link}>
            feedback page
          </Link>
          .
        </p>
      </Section>

      <Section title="Your account">
        <p>
          Pick a player name that is not someone else&rsquo;s and is fine to read aloud. We may change or remove a
          name, or a score, that is abusive, or that was made with a script instead of by playing. You are
          responsible for what happens under your account. How we handle your details is on the{" "}
          <Link to="/privacy" className={link}>
            privacy page
          </Link>
          .
        </p>
      </Section>

      <Section title="Videos you share">
        <p>
          The video of a round is made on your device and belongs to you. If you post it to the leaderboard, anyone
          can watch it. If you send it to YouTube or another site, that site&rsquo;s own terms apply to what you
          post there, and for YouTube that includes the{" "}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className={link}>
            YouTube Terms of Service
          </a>
          . You can remove a video from YouTube at any time from your own channel.
        </p>
      </Section>

      <Section title="What you agree not to do">
        <p>
          Do not try to break the game or the leaderboard, load it with automated requests, or look for ways into
          other people&rsquo;s accounts. Do not post anything through the game that you do not have the right to post.
        </p>
      </Section>

      <Section title="No promises">
        <p>
          The game is provided as it is. It may be down, change, or lose a feature, and scores held on a server can be
          reset if the ranking needs fixing. We are not liable for loss of a streak, a score or a recording. Nothing
          here limits rights you have by law that cannot be limited.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          When these terms change, the date at the top changes with them. Using the game after that means you accept
          the new wording.
        </p>
      </Section>

      <Section title="Getting in touch">
        <p>
          Questions go to{" "}
          <a href={`mailto:${CONTACT}`} className={link}>
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
    </PageShell>
  );
}
