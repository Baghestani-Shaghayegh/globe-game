import { useCallback, useRef, useState } from "react";
import { addRun, bestScore, bestTime, formatDuration } from "../../lib/records";

/** Everything the summary screen needs, frozen at the moment the run ended. */
export type Summary = {
  ms: number;
  found: number;
  total: number;
  completed: boolean;
  accuracy: number | null;
  isBest: boolean;
  previousBest: string | null;
};

type EndArgs = {
  found: number;
  total: number;
  /** How many answers the player gave, for accuracy. */
  guesses: number;
};

/**
 * The parts of a round that don't depend on how it is played: the clock, the
 * record it files, and the screens that wrap it. Both game types share this.
 */
export function useRound(recordKey: string) {
  const startedAt = useRef<number | null>(null);
  const recorded = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [reviewingMap, setReviewingMap] = useState(false);

  /** Starts the clock the first time it's called; later calls do nothing. */
  const begin = useCallback(() => {
    if (startedAt.current === null) startedAt.current = performance.now();
  }, []);

  const reset = useCallback(() => {
    startedAt.current = null;
    recorded.current = false;
    setElapsedMs(0);
    setSummary(null);
    setConfirmingExit(false);
    setReviewingMap(false);
  }, []);

  const tick = useCallback(() => {
    if (startedAt.current !== null) {
      setElapsedMs(performance.now() - startedAt.current);
    }
  }, []);

  /**
   * Ends the round — whether the player got everything or stopped early — and
   * files it, so a partial run still counts towards their records.
   */
  const end = useCallback(
    ({ found, total, guesses }: EndArgs) => {
      if (recorded.current || startedAt.current === null) return;
      recorded.current = true;

      const ms = performance.now() - startedAt.current;
      const completed = total > 0 && found === total;

      // Read the records before filing this run, so we compare against the past.
      const previousTime = bestTime(recordKey);
      const previousScore = bestScore(recordKey);
      // A run with nothing found isn't a result worth keeping.
      if (found > 0) addRun(recordKey, { ms, found, total });

      setSummary({
        ms,
        found,
        total,
        completed,
        accuracy: guesses > 0 ? Math.round((found / guesses) * 100) : null,
        isBest: completed
          ? !previousTime || ms < previousTime.ms
          : found > 0 && (!previousScore || found > previousScore.found),
        previousBest: completed
          ? previousTime
            ? formatDuration(previousTime.ms)
            : null
          : previousScore
            ? `${previousScore.found}/${previousScore.total}`
            : null,
      });
      setConfirmingExit(false);
    },
    [recordKey]
  );

  return {
    begin,
    reset,
    tick,
    end,
    summary,
    /** What the clock should read: live while playing, frozen once ended. */
    displayMs: summary ? summary.ms : elapsedMs,
    confirmingExit,
    setConfirmingExit,
    reviewingMap,
    setReviewingMap,
  };
}
