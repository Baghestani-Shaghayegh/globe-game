import { Link } from "react-router-dom";
import { playTap } from "../lib/sound";

/**
 * One of today's rounds, and the biggest thing on the page.
 *
 * These were small, equal-weight cards over a grid of six larger ones for
 * free play, and a new player read the page the way it was drawn: the free
 * play was the game, the dailies an aside. Jou, looking at it for the first
 * time, said there were too many buttons and no telling which to press, and
 * that the dailies should be the thing that stands out. So each is a large
 * card with a plain call to action, and the rest of the page steps back.
 */
export default function DailyCard({
  to,
  icon,
  title,
  note,
  accent,
  done = false,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  note: string;
  /** Tailwind colour stem, e.g. "sky" — the card's border, wash and glow. */
  accent: "sky" | "rose" | "violet";
  /**
   * Already finished today.
   *
   * Dimmed and ticked rather than disabled: the round is over but the result
   * is not, and a card you cannot click is a card that cannot show you how you
   * did. It is still a link, it just stops competing for attention with the
   * two you have yet to play.
   */
  done?: boolean;
}) {
  // The wash is a background *image*, not a second background colour.
  //
  // It used to be `bg-sky-400/[0.07]` next to an opaque page-colour base on
  // the same element — two utilities setting the same property, so the tint
  // won and the opaque base never applied at all. The card was a 7% film over
  // the globe, which is why the highlight off the Atlantic read straight
  // through the words on it. A gradient layers over the colour instead.
  const tone = done
    ? "border-white/10 hover:border-white/20"
    : {
        sky: "border-sky-400/30 [background-image:linear-gradient(rgba(56,189,248,0.12),rgba(56,189,248,0.04))] hover:border-sky-400/60",
        rose: "border-rose-400/30 [background-image:linear-gradient(rgba(251,113,133,0.11),rgba(251,113,133,0.04))] hover:border-rose-400/60",
        violet:
          "border-violet-400/30 [background-image:linear-gradient(rgba(167,139,250,0.11),rgba(167,139,250,0.04))] hover:border-violet-400/60",
      }[accent];

  const badge = done
    ? "bg-white/[0.05] text-zinc-500"
    : {
        sky: "bg-sky-400/15 text-sky-200",
        rose: "bg-rose-400/15 text-rose-200",
        violet: "bg-violet-400/15 text-violet-200",
      }[accent];

  const action = done
    ? "bg-white/[0.06] text-zinc-400 group-hover:bg-white/10"
    : {
        sky: "bg-sky-300 text-sky-950 group-hover:bg-sky-200",
        rose: "bg-rose-300 text-rose-950 group-hover:bg-rose-200",
        violet: "bg-violet-300 text-violet-950 group-hover:bg-violet-200",
      }[accent];

  return (
    <Link
      onClick={playTap}
      to={to}
      className={`group relative flex items-center gap-4 rounded-2xl border bg-surface/95 p-4 backdrop-blur-sm transition-colors sm:flex-col sm:items-start sm:gap-3 sm:p-5 ${tone}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6 ${badge}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-lg font-semibold ${done ? "text-zinc-400" : "text-zinc-50"}`}
        >
          {title}
        </span>
        <span
          className={`mt-0.5 block text-sm leading-snug ${done ? "text-zinc-500" : "text-zinc-400"}`}
        >
          {note}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors sm:mt-1 ${action}`}
      >
        {done ? (
          <>
            <span aria-hidden="true" className="text-emerald-400">
              ✓{" "}
            </span>
            Result
          </>
        ) : (
          "Play"
        )}
      </span>
    </Link>
  );
}
