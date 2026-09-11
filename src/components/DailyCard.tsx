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
}: {
  to: string;
  icon: string;
  title: string;
  note: string;
  /** Tailwind colour stem, e.g. "sky" — the card's border, wash and glow. */
  accent: "sky" | "rose" | "violet";
  /** A streak or a "done" marker, shown top-right. */
  badge?: string;
}) {
  const tone = {
    sky: "border-sky-400/25 bg-sky-400/[0.07] hover:border-sky-400/50",
    rose: "border-rose-400/25 bg-rose-400/[0.06] hover:border-rose-400/50",
    violet: "border-violet-400/25 bg-violet-400/[0.06] hover:border-violet-400/50",
  }[accent];

  return (
    <Link
      onClick={playTap}
      to={to}
      className={`group relative flex flex-1 flex-col gap-1.5 rounded-2xl border px-4 py-4 transition-colors ${tone}`}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg leading-none">
          {icon}
        </span>
        <span className="font-medium text-zinc-100">{title}</span>
        {badge && (
          <span className="ml-auto shrink-0 text-xs tabular-nums text-zinc-400">
            {badge}
          </span>
        )}
      </span>
      <span className="text-sm leading-snug text-zinc-400">{note}</span>
    </Link>
  );
}
