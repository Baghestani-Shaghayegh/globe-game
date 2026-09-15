import type { Streak } from "../lib/daily";

/**
 * The daily streak, as a chip.
 *
 * Shown from day one. It used to appear only from day two, which hid it at
 * exactly the moment it does the most work: the reason to come back tomorrow
 * is knowing you have something to keep, and a player who never sees a "1"
 * has nothing yet to keep.
 *
 * Three things it can say, and they are three different moments:
 *
 *  - nothing on file — an invitation, in plain grey, because a streak you do
 *    not have yet is not an achievement to dress up.
 *  - a run that today has not been added to — the one worth a warning. The
 *    number is real but it is a day from being lost, and saying so is the
 *    whole point of showing it before the round rather than after.
 *  - a run today is already part of — settled, with the record alongside it
 *    when the record is worth mentioning.
 */
export default function StreakChip({
  streak,
  className = "",
}: {
  streak: Streak;
  className?: string;
}) {
  const { days, playedToday, best } = streak;

  if (days === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400 ${className}`}
      >
        <span aria-hidden="true" className="opacity-50">
          🔥
        </span>
        Play today to start a streak
      </span>
    );
  }

  const label = `${days}-day streak`;
  // Only when it is behind you. Matching your own record is the run you are
  // having, and "best 6" next to a 6 reads as a ceiling rather than a record.
  const showBest = best > days;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
        playedToday
          ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
          : "border-white/10 bg-white/[0.04] text-zinc-300"
      } ${className}`}
    >
      <span aria-hidden="true" className={playedToday ? "" : "opacity-60"}>
        🔥
      </span>
      <span className="font-medium tabular-nums">{label}</span>
      {!playedToday && (
        <span className="text-zinc-500">· play today to keep it</span>
      )}
      {playedToday && showBest && (
        <span className="text-amber-200/50 tabular-nums">· best {best}</span>
      )}
    </span>
  );
}
