import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  allBuckets,
  bestPoints,
  clearAll,
  formatDuration,
  isComplete,
  type Bucket,
  type Run,
} from "../lib/records";
import { GAME_TYPES, MODES, TIME_LIMITS, gamePath } from "../data/modes";

function modeName(modeId: string): string {
  return MODES.find((m) => m.id === modeId)?.name ?? modeId;
}

function modeAccent(modeId: string): string {
  return MODES.find((m) => m.id === modeId)?.accent ?? "#8fb8d1";
}

function typeLabel(type: Bucket["type"]): string {
  return GAME_TYPES.find((t) => t.id === type)?.label ?? type;
}

function limitLabel(seconds: number | null): string {
  if (seconds === null) return "Count up";
  return TIME_LIMITS.find((l) => l.seconds === seconds)?.label ?? `${seconds}s`;
}

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A clear time once the map has been finished, otherwise how far you got. */
function runLabel(run: Run): string {
  return isComplete(run)
    ? formatDuration(run.ms)
    : `${run.found}/${run.total}`;
}

function BucketCard({ bucket }: { bucket: Bucket }) {
  const topScore = bestPoints(bucket.key)?.points ?? null;
  const cleared = bucket.runs.filter(isComplete);
  const best = cleared.length
    ? cleared.reduce((a, b) => (a.ms < b.ms ? a : b))
    : bucket.runs.reduce((a, b) =>
        b.found > a.found || (b.found === a.found && b.ms < a.ms) ? b : a
      );

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.07] px-4 py-3">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: modeAccent(bucket.modeId) }}
        />
        <span className="font-medium text-zinc-100">
          {modeName(bucket.modeId)}
        </span>
        <span className="text-xs text-zinc-500">
          {typeLabel(bucket.type)} · {limitLabel(bucket.limitSeconds)}
          {bucket.ruleset === "sudden" && " · Sudden death"}
        </span>
        <span className="ml-auto flex items-center gap-2 text-sm tabular-nums text-zinc-300">
          {topScore !== null && (
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs text-zinc-400">
              {topScore.toLocaleString()} pts
            </span>
          )}
          Best {runLabel(best)}
        </span>
      </div>

      <ol className="divide-y divide-white/[0.05]">
        {bucket.runs.map((run) => (
          <li
            key={run.at}
            className="flex items-center gap-3 px-4 py-2 text-sm"
          >
            <span className="tabular-nums text-zinc-300">
              {run.found}
              <span className="text-zinc-600"> / {run.total}</span>
            </span>
            <span
              aria-hidden="true"
              className="h-1 w-16 overflow-hidden rounded-full bg-white/10"
            >
              <span
                className="block h-full rounded-full bg-emerald-400/70"
                style={{
                  width: `${run.total ? (100 * run.found) / run.total : 0}%`,
                }}
              />
            </span>
            <span className="tabular-nums text-zinc-500">
              {formatDuration(run.ms)}
            </span>
            {typeof run.points === "number" && (
              <span className="tabular-nums text-zinc-500">
                {run.points.toLocaleString()} pts
              </span>
            )}
            {typeof run.bestStreak === "number" && run.bestStreak > 1 && (
              <span className="tabular-nums text-amber-300/70">
                {run.bestStreak}× streak
              </span>
            )}
            {run === best && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-300">
                Best
              </span>
            )}
            <span className="ml-auto text-xs tabular-nums text-zinc-600">
              {when(run.at)}
            </span>
          </li>
        ))}
      </ol>

      <div className="border-t border-white/[0.07] px-4 py-2.5">
        <Link
          to={gamePath(
            bucket.type,
            bucket.modeId,
            bucket.limitSeconds,
            bucket.ruleset
          )}
          className="text-xs text-zinc-400 underline underline-offset-4 transition-colors hover:text-zinc-100"
        >
          Play this again
        </Link>
      </div>
    </div>
  );
}

export default function Records() {
  const [buckets, setBuckets] = useState<Bucket[]>(() => allBuckets());
  const [confirmingClear, setConfirmingClear] = useState(false);

  const totals = useMemo(() => {
    const runs = buckets.flatMap((b) => b.runs);
    return {
      runs: runs.length,
      found: runs.reduce((sum, r) => sum + r.found, 0),
      played: runs.reduce((sum, r) => sum + r.ms, 0),
    };
  }, [buckets]);

  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Records
        </h1>

        {buckets.length === 0 ? (
          <p className="mt-4 text-zinc-400">
            No runs yet. Finish a round and it'll show up here.
          </p>
        ) : (
          <>
            <p className="mt-2 tabular-nums text-zinc-400">
              {totals.runs} {totals.runs === 1 ? "run" : "runs"} ·{" "}
              {totals.found} countries found · {formatDuration(totals.played)}{" "}
              played
            </p>

            <div className="mt-8 flex flex-col gap-4">
              {buckets.map((bucket) => (
                <BucketCard key={bucket.key} bucket={bucket} />
              ))}
            </div>

            <div className="mt-8">
              {confirmingClear ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-zinc-300">
                    Delete every run? This can't be undone.
                  </span>
                  <button
                    onClick={() => {
                      clearAll();
                      setBuckets([]);
                      setConfirmingClear(false);
                    }}
                    className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/25"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmingClear(false)}
                    className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingClear(true)}
                  className="text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
                >
                  Clear records
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
