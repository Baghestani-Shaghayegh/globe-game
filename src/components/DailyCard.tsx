import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { playTap } from "../lib/sound";

/**
 * One of today's rounds, and the biggest thing on the page.
 *
 * Each card shows today's puzzle rather than describing the game: the ten
 * empty slots of the hunt, the heat scale of the mystery, the two flags of
 * the day's Connect pair. Once it's played, the same space shows how it went,
 * so the page doubles as today's scorecard. The earlier version was an
 * icon, a title, a sentence and a button — a card any app could have drawn,
 * with nothing on it from today.
 */
export default function DailyCard({
  to,
  icon,
  kicker,
  title,
  note,
  visual,
  accent,
  done = false,
}: {
  to: string;
  icon: ReactNode;
  /** The small line on top: "#274 · Name it". */
  kicker: string;
  title: string;
  /** One line under the title: what to do, or how it went. */
  note: string;
  /** Today's puzzle, or once played, the result. */
  visual: ReactNode;
  /** Tailwind colour stem, e.g. "sky" — the card's border, wash and glow. */
  accent: "sky" | "rose" | "violet";
  /** Already finished today: shows the result, and stops shouting. */
  done?: boolean;
}) {
  // The wash is a background *image* layered over the opaque surface, not a
  // second background colour that would replace it.
  const tone = {
    sky: "border-sky-400/30 [background-image:linear-gradient(160deg,rgba(56,189,248,0.16),rgba(56,189,248,0.03)_60%)] hover:border-sky-400/70",
    rose: "border-rose-400/30 [background-image:linear-gradient(160deg,rgba(251,113,133,0.15),rgba(251,113,133,0.03)_60%)] hover:border-rose-400/70",
    violet:
      "border-violet-400/30 [background-image:linear-gradient(160deg,rgba(167,139,250,0.15),rgba(167,139,250,0.03)_60%)] hover:border-violet-400/70",
  }[accent];

  const ink = {
    sky: "text-sky-300",
    rose: "text-rose-300",
    violet: "text-violet-300",
  }[accent];

  const action = done
    ? "bg-white/[0.07] text-zinc-200 group-hover:bg-white/[0.12]"
    : {
        sky: "bg-sky-300 text-sky-950 group-hover:bg-sky-200",
        rose: "bg-rose-300 text-rose-950 group-hover:bg-rose-200",
        violet: "bg-violet-300 text-violet-950 group-hover:bg-violet-200",
      }[accent];

  return (
    <Link
      onClick={playTap}
      to={to}
      className={`group relative flex h-full flex-col rounded-2xl border bg-surface/95 p-4 backdrop-blur-sm transition-colors sm:p-5 ${tone}`}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className={`[&_svg]:h-4 [&_svg]:w-4 ${ink}`}>
          {icon}
        </span>
        <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${ink}`}>
          {kicker}
        </span>
        {done && (
          <span className="ml-auto rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            ✓ Played
          </span>
        )}
      </span>

      <span className="mt-2 block text-xl font-semibold tracking-tight text-zinc-50">
        {title}
      </span>
      <span className="mt-0.5 block text-sm leading-snug text-zinc-400">{note}</span>

      {/* The picture of today: a fixed height, so the three line up. */}
      <span className="mt-4 flex min-h-[3.25rem] flex-1 items-center">{visual}</span>

      <span
        className={`mt-4 flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${action}`}
      >
        {done ? "See your result" : "Play"}
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
