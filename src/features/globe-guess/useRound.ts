import { useCallback, useRef, useState } from "react";
import { addRun, bestScore, bestTime, formatDuration } from "../../lib/records";
import {
  emptyScore,
  scoreCorrect,
  scoreHint,
  scoreWrong,
  type HintKind,
  type Score,
} from "../../lib/scoring";

/** Everything the summary screen needs, frozen at the moment the run ended. */
export type Summary = {
  ms: number;
  points: number;
  bestStreak: number;
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
export function useRound(recordKey: string, limitMs: number | null) {
  const startedAt = useRef<number | null>(null);
  const recorded = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [reviewingMap, setReviewingMap] = useState(false);
  const [score, setScore] = useState<Score>(emptyScore);

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
    setScore(emptyScore);
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

      // A round stopped by the clock is exactly the limit long, however late
      // the tick that noticed happened to fire.
      const raw = performance.now() - startedAt.current;
      const ms = limitMs === null ? raw : Math.min(raw, limitMs);
      const completed = total > 0 && found === total;

      // Read the records before filing this run, so we compare against the past.
      const previousTime = bestTime(recordKey);
      const previousScore = bestScore(recordKey);
      // A run with nothing found isn't a result worth keeping.
      if (found > 0) {
        addRun(recordKey, {
          ms,
          found,
          total,
          points: score.points,
          bestStreak: score.bestStreak,
        });
      }

      setSummary({
        ms,
        points: score.points,
        bestStreak: score.bestStreak,
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
    [recordKey, limitMs, score]
  );

  const remainingMs =
    limitMs === null ? null : Math.max(0, limitMs - elapsedMs);

  return {
    begin,
    reset,
    tick,
    end,
    score,
    /** Records a correct answer, continuing the streak. */
    correct: useCallback(() => setScore(scoreCorrect), []),
    /** Records a wrong answer, which only costs the streak. */
    wrong: useCallback(() => setScore(scoreWrong), []),
    /** Charges for a hint. */
    spendHint: useCallback(
      (hint: HintKind) => setScore((s) => scoreHint(s, hint)),
      []
    ),
    summary,
    /** True once a countdown has run out and the round hasn't been filed yet. */
    timeUp: remainingMs === 0 && !summary,
    /** Whether the clock counts down; the HUD styles it differently. */
    countdown: limitMs !== null,
    /** What the clock should read: live while playing, frozen once ended. */
    displayMs: summary
      ? limitMs === null
        ? summary.ms
        : Math.max(0, limitMs - summary.ms)
      : (remainingMs ?? elapsedMs),
    confirmingExit,
    setConfirmingExit,
    reviewingMap,
    setReviewingMap,
  };
}
