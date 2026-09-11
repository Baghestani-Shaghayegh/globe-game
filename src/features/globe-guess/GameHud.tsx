import { formatDuration } from "../../lib/records";
import { formatMultiplier } from "../../lib/scoring";
import type { Gain } from "./useRound";

type Props = {
  onBack: () => void;
  found: number;
  total: number;
  ms: number;
  /** True when the clock counts down, so it can warn as it empties. */
  countdown: boolean;
  modeLabel: string;
  modeLevel: 1 | 2 | 3;
  points: number;
  streak: number;
  /** What the last correct answer paid, to float up off the score. */
  gain?: Gain | null;
  /** Ends the round. Null once it has already ended. */
  onFinish: (() => void) | null;
};

const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3.5"];

/**
 * The in-game status bar. Below `sm` the progress bar and mode label drop out —
 * the bar restates the counter beside it, and the mode was picked a moment ago
 * on the menu — so back, score, clock and Finish always fit a phone.
 */
export default function GameHud({
  onBack,
  found,
  total,
  ms,
  countdown,
  modeLabel,
  modeLevel,
  points,
  streak,
  gain,
  onFinish,
}: Props) {
  const progress = total ? Math.round((found / total) * 100) : 0;

  return (
    // The bar sits over the map, so only its controls take clicks — everything
    // else lets them through to the country underneath.
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm backdrop-blur sm:left-4 sm:top-4 sm:gap-3 sm:px-3">
      <button
        onClick={onBack}
        aria-label="Back to modes"
        className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <span className="h-4 w-px bg-white/10" aria-hidden="true" />

      <span className="relative tabular-nums font-medium text-zinc-100" aria-label="Score">
        {points.toLocaleString()}
        {gain && (
          // Keyed by the award, so two answers in a row replay the rise
          // instead of the second one landing on a finished animation.
          <span
            key={gain.id}
            aria-hidden="true"
            className="animate-score-pop absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-emerald-300"
          >
            +{gain.points}
          </span>
        )}
      </span>

      {/* The streak always paid; until now the only thing shown was how long
          it was, which said nothing about what the next answer was worth. */}
      {streak > 0 && (
        <span
          className={`rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums transition-colors ${
            streak >= 10
              ? "bg-amber-400/25 text-amber-200"
              : "bg-amber-400/15 text-amber-300"
          }`}
          aria-label={`Streak of ${streak}, next answer worth ${formatMultiplier(streak)}`}
        >
          {formatMultiplier(streak)}
        </span>
      )}

      <span className="h-4 w-px bg-white/10" aria-hidden="true" />

      <span className="hidden tabular-nums text-zinc-100 sm:inline">
        <b className="font-medium">{found}</b>
        <span className="text-zinc-500"> / {total}</span>
      </span>

      <span className="hidden h-1 w-20 overflow-hidden rounded-full bg-white/10 sm:block">
        <span
          className="block h-full rounded-full bg-emerald-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </span>

      <span className="h-4 w-px bg-white/10" aria-hidden="true" />

      <span
        className={`tabular-nums ${
          countdown && ms <= 10_000
            ? "font-medium text-rose-400"
            : countdown && ms <= 30_000
              ? "text-amber-300"
              : "text-zinc-300"
        }`}
        aria-label={countdown ? "Time remaining" : "Time elapsed"}
        role="timer"
      >
        {formatDuration(ms)}
      </span>

      <span
        className="hidden h-4 w-px bg-white/10 sm:block"
        aria-hidden="true"
      />

      <span className="hidden items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400 sm:flex">
        <span aria-hidden="true" className="flex items-end gap-[3px]">
          {BAR_HEIGHTS.map((height, i) => (
            <span
              key={height}
              className={`w-[3px] rounded-full ${height} ${
                i < modeLevel ? "bg-zinc-300" : "bg-white/15"
              }`}
            />
          ))}
        </span>
        {modeLabel}
      </span>

      {onFinish && (
        <>
          <span className="h-4 w-px bg-white/10" aria-hidden="true" />
          <button
            onClick={onFinish}
            className="pointer-events-auto rounded-md px-2 py-0.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          >
            Finish
          </button>
        </>
      )}
    </div>
  );
}
