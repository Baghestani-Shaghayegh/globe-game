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
  badge,
  done = false,
  pill,
  action,
}: {
  to: string;
  icon: string;
  title: string;
  note: string;
  /** Tailwind colour stem, e.g. "sky" — the card's border, wash and glow. */
  accent: "sky" | "rose" | "violet";
  /** A streak or a "done" marker, shown top-right. */
  badge?: string;
  /**
   * Already finished today.
   *
   * Dimmed and ticked rather than disabled: the round is over but the result
   * is not, and a card you cannot click is a card that cannot show you how you
   * did. It is still a link, it just stops competing for attention with the
   * two you have yet to play.
   */
  done?: boolean;
  /** A standing fact about the puzzle, e.g. what its points are worth. */
  pill?: string;
  /** The call to action at the foot of the card. */
  action?: string;
}) {
  // Each wash is laid over an opaque base rather than straight onto the page:
  // these cards sit on top of the globe, and a 6% tint on its own leaves the
  // continents reading through the words.
  const tone = done
    ? "border-white/10 bg-[#07111c]/75 hover:border-white/20"
    : {
        sky: "border-sky-400/25 bg-sky-400/[0.07] hover:border-sky-400/50",
        rose: "border-rose-400/25 bg-rose-400/[0.06] hover:border-rose-400/50",
        violet:
          "border-violet-400/25 bg-violet-400/[0.06] hover:border-violet-400/50",
      }[accent];

  return (
    <Link
      onClick={playTap}
      to={to}
      className={`group relative flex flex-1 flex-col gap-1 rounded-2xl border bg-[#07111c]/75 px-4 py-3.5 backdrop-blur-sm transition-colors ${tone}`}
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
          {badge && (
            <span className="text-xs tabular-nums text-zinc-400">{badge}</span>
          )}
          {done && (
            <span
              aria-label="finished today"
              className="text-xs font-medium text-emerald-400/80"
            >
              ✓
            </span>
          )}
        </span>
      </span>
      <span
        className={`text-sm leading-snug ${done ? "text-zinc-600" : "text-zinc-400"}`}
      >
        {note}
      </span>

      {pill && !done && (
        <span className="w-fit rounded-full border border-teal-300/30 bg-teal-300/10 px-2.5 py-0.5 text-xs font-medium text-teal-200">
          {pill}
        </span>
      )}

      {action && (
        <span
          className={`mt-auto pt-1.5 text-sm font-medium ${
            done ? "text-zinc-500" : "text-teal-300 group-hover:text-teal-200"
          }`}
        >
          {done ? "See your result" : action} <span aria-hidden="true">→</span>
        </span>
      )}
    </Link>
  );
}
