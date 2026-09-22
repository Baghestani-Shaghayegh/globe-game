import { Link } from "react-router-dom";
import { playTap } from "../lib/sound";

/**
 * One of today's rounds. Compact and equal-weight: these three are the reason
 * to come back, and none of them is more important than the others.
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
  icon: string;
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
  // It used to be `bg-sky-400/[0.07]` next to an opaque `bg-[#07111c]/75` on
  // the same element — two utilities setting the same property, so the tint
  // won and the opaque base never applied at all. The card was a 7% film over
  // the globe, which is why the highlight off the Atlantic read straight
  // through the words on it. A gradient layers over the colour instead.
  const tone = done
    ? "border-white/10 hover:border-white/20"
    : {
        sky: "border-sky-400/25 [background-image:linear-gradient(rgba(56,189,248,0.10),rgba(56,189,248,0.10))] hover:border-sky-400/50",
        rose: "border-rose-400/25 [background-image:linear-gradient(rgba(251,113,133,0.09),rgba(251,113,133,0.09))] hover:border-rose-400/50",
        violet:
          "border-violet-400/25 [background-image:linear-gradient(rgba(167,139,250,0.09),rgba(167,139,250,0.09))] hover:border-violet-400/50",
      }[accent];

  return (
    <Link
      onClick={playTap}
      to={to}
      className={`group relative flex flex-col gap-1 rounded-2xl border bg-[#0a1420]/95 px-4 py-3.5 backdrop-blur-sm transition-colors ${tone}`}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`text-lg leading-none ${done ? "opacity-40 grayscale" : ""}`}
        >
          {icon}
        </span>
        <span className={done ? "font-medium text-zinc-400" : "font-medium text-zinc-100"}>
          {title}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {done && (
            <span
              aria-label="finished today"
              className="text-xs font-medium text-emerald-400/80"
            >
              ✓
            </span>
          )}
          <span
            aria-hidden="true"
            className="text-zinc-600 transition-colors group-hover:text-zinc-300"
          >
            ›
          </span>
        </span>
      </span>
      <span
        className={`text-sm leading-snug ${done ? "text-zinc-500" : "text-zinc-400"}`}
      >
        {note}
      </span>
    </Link>
  );
}
