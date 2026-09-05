import { Link } from "react-router-dom";
import { formatDuration } from "../../lib/records";
import { theme } from "../../lib/globeTheme";

type Props = {
  /** True when every country was found, false when the player finished early. */
  completed: boolean;
  /** The round was stopped by the countdown rather than by the player. */
  outOfTime: boolean;
  ms: number;
  points: number;
  bestStreak: number;
  found: number;
  total: number;
  /** Share of guesses that landed, or null if the player never guessed. */
  accuracy: number | null;
  /** Whether this run beat the mode's previous record. */
  isBest: boolean;
  /** The record this run was measured against, if there was one. */
  previousBest: string | null;
  /** How many countries were left unfound. */
  missedCount: number;
  onPlayAgain: () => void;
  /** Hides the panel so the revealed globe can be studied. */
  onReviewMap: () => void;
};

export default function RoundSummary({
  completed,
  outOfTime,
  ms,
  points,
  bestStreak,
  found,
  total,
  accuracy,
  isBest,
  previousBest,
  missedCount,
  onPlayAgain,
  onReviewMap,
}: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07111c]/55 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#141b23] shadow-2xl">
        <div className="px-6 pt-6 text-center">
          <p className="text-sm text-zinc-400">
            {completed
              ? `You found all ${total}`
              : outOfTime
                ? "Time's up"
                : "Run ended"}
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums text-zinc-50">
            {points.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-zinc-500">
            points
          </p>

          <p className="mt-3 text-sm tabular-nums text-zinc-400">
            {formatDuration(ms)}
            {bestStreak > 1 && (
              <>
                <span className="mx-1.5 text-zinc-600">·</span>
                best streak {bestStreak}
              </>
            )}
          </p>

          <p className="mt-2 text-sm tabular-nums text-zinc-400">
            <span className="text-zinc-100">{found}</span> of {total} found
            {accuracy !== null && (
              <>
                <span className="mx-1.5 text-zinc-600">·</span>
                {accuracy}% accuracy
              </>
            )}
          </p>

          {isBest ? (
            <p className="mt-3 text-xs uppercase tracking-wider text-emerald-300">
              {completed ? "New best time" : "New best score"}
            </p>
          ) : (
            previousBest && (
              <p className="mt-3 text-xs tabular-nums text-zinc-500">
                Your best {previousBest}
              </p>
            )
          )}
        </div>

        {missedCount > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.07] px-6 py-3.5">
            <span className="flex items-center gap-2 text-sm text-zinc-400">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: theme.missed }}
              />
              <span className="tabular-nums">{missedCount}</span> missed
            </span>
            <button
              onClick={onReviewMap}
              className="text-xs text-zinc-400 underline underline-offset-4 transition-colors hover:text-zinc-100"
            >
              Show on globe
            </button>
          </div>
        )}

        <div className="flex gap-2 border-t border-white/[0.07] px-6 py-4">
          <button
            onClick={onPlayAgain}
            className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            Play again
          </button>
          <Link
            to="/"
            className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-center text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
          >
            Back to modes
          </Link>
        </div>
      </div>
    </div>
  );
}
