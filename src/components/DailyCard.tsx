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
}) {
  const tone = done
    ? "border-white/10 bg-white/[0.02] hover:border-white/20"
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
      className={`group relative flex flex-1 flex-col gap-1.5 rounded-2xl border px-4 py-4 transition-colors ${tone}`}
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
    </Link>
  );
}
