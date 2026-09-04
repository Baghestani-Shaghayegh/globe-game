import { Link } from "react-router-dom";
import { formatDuration } from "../../lib/records";

type Props = {
  /** True when every country was found, false when the player finished early. */
  completed: boolean;
  ms: number;
  found: number;
  total: number;
  /** Share of guesses that landed, or null if the player never guessed. */
  accuracy: number | null;
  /** Whether this run beat the mode's previous record. */
  isBest: boolean;
  /** The record this run was measured against, if there was one. */
  previousBest: string | null;
  /** Display names of everything left unfound, already sorted. */
  missed: string[];
  onPlayAgain: () => void;
  /** Hides the panel so the revealed globe can be studied. */
  onReviewMap: () => void;
};

export default function RoundSummary({
  completed,
  ms,
  found,
  total,
  accuracy,
  isBest,
  previousBest,
  missed,
  onPlayAgain,
  onReviewMap,
}: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07111c]/55 p-4">
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141b23] shadow-2xl">
        <div className="px-6 pt-6 text-center">
          <p className="text-sm text-zinc-400">
            {completed ? `You found all ${total}` : "Run ended"}
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums text-zinc-50">
            {formatDuration(ms)}
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

        {missed.length > 0 && (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto border-t border-white/[0.07] px-6 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Missed ({missed.length})
              </p>
              <button
                onClick={onReviewMap}
                className="text-xs text-zinc-400 underline underline-offset-4 transition-colors hover:text-zinc-100"
              >
                Show on globe
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {missed.map((name) => (
                <span
                  key={name}
                  className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-zinc-300"
                >
                  {name}
                </span>
              ))}
            </div>
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
