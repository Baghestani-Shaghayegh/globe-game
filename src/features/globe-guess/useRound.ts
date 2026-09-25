import { useCallback, useEffect, useRef, useState } from "react";
import { addRun, bestScore, bestTime, formatDuration } from "../../lib/records";
import { postScore } from "../../lib/leaderboard";
import {
  emptyScore,
  formatMultiplier,
  hintsOn,
  pointsFor,
  scoreCorrect,
  scoreHint,
  scorePass,
  scoreWrong,
  type HintKind,
  type Score,
} from "../../lib/scoring";
import {
  playCorrect,
  playHint,
  playOther,
  playRecord,
  playRoundEnd,
  playTick,
  playWrong,
} from "../../lib/sound";

/** How near the end a countdown starts being audible. */
const TICK_FROM_SECONDS = 10;

/**
 * What the last correct answer paid, for the figure that floats up off the
 * globe. `id` rather than a timestamp so two answers worth the same amount in
 * quick succession still read as two separate awards.
 */
export type Gain = {
  points: number;
  /** How it was written: "1.5x" while a streak is running, else null. */
  multiplier: string | null;
  id: number;
};

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
  /** Countries the player gave at least one answer for. */
  attempted: number;
  /** Of those, the ones they got right without a wrong answer first. */
  firstTry: number;
};

/**
 * The parts of a round that don't depend on how it is played: the clock, the
 * record it files, and the screens that wrap it. Both game types share this.
 */
export function useRound(
  recordKey: string,
  limitMs: number | null,
  /**
   * Whether the run counts. Practice sets this false: it is study, and a
   * drill over the eight countries you keep missing is not a score anyone
   * should be ranked on.
   */
  {
    record = true,
    pointsMultiplier = 1,
  }: {
    record?: boolean;
    /**
     * Applied to the round's score once, at the end. The daily doubles; see
     * DAILY_MULTIPLIER for why. Applied here rather than per answer so the
     * running total in the HUD stays the plain arithmetic a player can follow.
     */
    pointsMultiplier?: number;
  } = {}
) {
  const startedAt = useRef<number | null>(null);
  /** When the question being answered was put to the player, for speed. */
  const questionAt = useRef<number | null>(null);
  const recorded = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [reviewingMap, setReviewingMap] = useState(false);
  const [score, setScore] = useState<Score>(emptyScore);
  const [gain, setGain] = useState<Gain | null>(null);
  // The score as of this instant. `setScore`'s updater can't be the place to
  // play a sound or raise a popup — React may run it twice — so the streak is
  // read from here, outside the updater, and the updater stays pure.
  const scoreNow = useRef<Score>(emptyScore);
  const gainId = useRef(0);

  const applyScore = useCallback((next: (score: Score) => Score) => {
    const updated = next(scoreNow.current);
    scoreNow.current = updated;
    setScore(updated);
  }, []);

  /** Starts the clock the first time it's called; later calls do nothing. */
  const begin = useCallback(() => {
    if (startedAt.current === null) startedAt.current = performance.now();
    if (questionAt.current === null) questionAt.current = performance.now();
  }, []);

  /**
   * Starts the clock on a new question. Find it calls this when a new country
   * is asked, so the pause after a revealed answer is not charged to the next
   * one. Name it has no questions as such: its clock runs from the last
   * answer, which `correct` and `pass` reset.
   */
  const startQuestion = useCallback(() => {
    questionAt.current = performance.now();
  }, []);

  /** How long the current question has taken, and the clock started again. */
  const lapQuestion = useCallback(() => {
    const now = performance.now();
    const ms = questionAt.current === null ? 0 : now - questionAt.current;
    questionAt.current = now;
    return ms;
  }, []);

  const reset = useCallback(() => {
    startedAt.current = null;
    questionAt.current = null;
    recorded.current = false;
    setElapsedMs(0);
    setSummary(null);
    setConfirmingExit(false);
    setReviewingMap(false);
    setScore(emptyScore);
    scoreNow.current = emptyScore;
    setGain(null);
    lastTick.current = null;
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
    ({ found, total, attempted, firstTry }: EndArgs) => {
      if (recorded.current || startedAt.current === null) return;
      recorded.current = true;

      // A round stopped by the clock is exactly the limit long, however late
      // the tick that noticed happened to fire.
      const raw = performance.now() - startedAt.current;
      const ms = limitMs === null ? raw : Math.min(raw, limitMs);
      const completed = total > 0 && found === total;
      const points = Math.round(score.points * pointsMultiplier);

      // Read the records before filing this run, so we compare against the past.
      const previousTime = bestTime(recordKey);
      const previousScore = bestScore(recordKey);
      // A run with nothing found isn't a result worth keeping.
      if (record && found > 0) {
        addRun(recordKey, {
          ms,
          found,
          total,
          points,
          bestStreak: score.bestStreak,
          hintsUsed: score.hintsUsed,
        });
        // Onto the weekly board too, if there's an account behind this run.
        // Deliberately not awaited: the summary shouldn't wait on the network,
        // and the run is already saved locally whether or not this lands.
        void postScore(recordKey, {
          points,
          found,
          total,
          ms,
          bestStreak: score.bestStreak,
          hintsUsed: score.hintsUsed,
        });
      }

      const isBest = completed
        ? !previousTime || ms < previousTime.ms
        : found > 0 && (!previousScore || found > previousScore.found);

      playRoundEnd(completed);
      if (isBest) playRecord();

      setSummary({
        ms,
        points,
        bestStreak: score.bestStreak,
        found,
        total,
        completed,
        // Share of the countries tried that were named right first time.
        // Counting every guess instead made a single retry look like a
        // collapse, and three tries at one country sank the whole round.
        accuracy:
          attempted > 0 ? Math.round((firstTry / attempted) * 100) : null,
        isBest,
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
    [recordKey, limitMs, score, record, pointsMultiplier]
  );

  const remainingMs =
    limitMs === null ? null : Math.max(0, limitMs - elapsedMs);

  // The last ten seconds, once each. The clock is read from `remainingMs`
  // rather than counted, so a browser that throttles a background tab can skip
  // seconds without the ticks drifting out of step with what is on screen.
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (remainingMs === null || summary) {
      lastTick.current = null;
      return;
    }
    const secondsLeft = Math.ceil(remainingMs / 1000);
    if (secondsLeft > TICK_FROM_SECONDS || secondsLeft <= 0) return;
    if (lastTick.current === secondsLeft) return;
    lastTick.current = secondsLeft;
    playTick(secondsLeft);
  }, [remainingMs, summary]);

  return {
    begin,
    startQuestion,
    reset,
    tick,
    end,
    score,
    /** Records a correct answer for a country, paid by streak and hints. */
    correct: useCallback(
      (name: string) => {
        const before = scoreNow.current.streak;
        const hints = hintsOn(scoreNow.current, name);
        const ms = lapQuestion();
        playCorrect(before);
        setGain({
          points: pointsFor(before, hints, ms),
          // A first answer is worth the base and nothing more; calling that
          // "1x" would dress up the ordinary case as a bonus. A helped one
          // earns no streak bonus, so it gets no multiplier either.
          multiplier:
            before > 0 && hints === 0 ? formatMultiplier(before) : null,
          id: ++gainId.current,
        });
        applyScore((s) => scoreCorrect(s, name, ms));
      },
      [applyScore, lapQuestion]
    ),
    /** Records a wrong answer, which only costs the streak. */
    wrong: useCallback(() => {
      playWrong();
      applyScore(scoreWrong);
    }, [applyScore]),
    /** Moves past a country without answering it, and without a charge. */
    pass: useCallback(() => {
      playOther();
      lapQuestion();
      applyScore(scorePass);
    }, [applyScore, lapQuestion]),
    /** Buys a hint for a country, charged to that country's answer. */
    spendHint: useCallback(
      (hint: HintKind, name: string) => {
        playHint();
        applyScore((s) => scoreHint(s, hint, name));
      },
      [applyScore]
    ),
    /** The last award, for the figure that floats up. */
    gain,
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
