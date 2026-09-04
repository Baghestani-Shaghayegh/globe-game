import { formatDuration } from "../../lib/records";

type Props = {
  onBack: () => void;
  found: number;
  total: number;
  ms: number;
  modeLabel: string;
  modeLevel: 1 | 2 | 3;
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
  modeLabel,
  modeLevel,
  onFinish,
}: Props) {
  const progress = total ? Math.round((found / total) * 100) : 0;

  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm backdrop-blur sm:left-4 sm:top-4 sm:gap-3 sm:px-3">
      <button
        onClick={onBack}
        aria-label="Back to modes"
        className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
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

      <span className="tabular-nums text-zinc-100">
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
        className="tabular-nums text-zinc-300"
        aria-label="Time elapsed"
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
            className="rounded-md px-2 py-0.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          >
            Finish
          </button>
        </>
      )}
    </div>
  );
}
