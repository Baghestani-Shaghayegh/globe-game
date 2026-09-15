import type { Streak } from "../lib/daily";

/**
 * The daily streak, as a number and a flame and nothing else.
 *
 * It used to carry a line of text — "play today to keep it", "play today to
 * start a streak". That belonged to a chip sitting under a heading with room
 * around it. Up beside the name and flag there is no room for a sentence, and
 * a sentence there would read as a notification rather than a stat.
 *
 * Nothing at all at zero. A "🔥 0" is not a streak, and an empty one parked
 * next to the player's name is a reproach every time they open the page.
 */
export default function StreakChip({
  streak,
  className = "",
}: {
  streak: Streak;
  className?: string;
}) {
  if (streak.days === 0) return null;

  const label = streak.playedToday
    ? `${streak.days}-day daily streak`
    : `${streak.days}-day daily streak, today not played yet`;

  return (
    <span
      title={label}
      aria-label={label}
      className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-sm tabular-nums transition-colors ${
        // Lit once today is on it, plain while it is still owed. The colour is
        // the whole of what the sentence used to say.
        streak.playedToday
          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
          : "border-white/15 text-zinc-400"
      } ${className}`}
    >
      <span aria-hidden="true" className={streak.playedToday ? "" : "opacity-60"}>
        🔥
      </span>
      <span aria-hidden="true">{streak.days}</span>
    </span>
  );
}
