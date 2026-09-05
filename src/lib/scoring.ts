/**
 * Scoring for a round.
 *
 * A correct answer is worth a base amount, plus a bonus that grows with the
 * current streak so a run of answers is worth more than the same answers
 * scattered between mistakes. Hints are paid for out of the same pot, which is
 * what makes taking one a decision rather than a free win.
 */
export const POINTS_PER_COUNTRY = 100;
/** Extra per country already in the streak, capped so it can't run away. */
export const STREAK_BONUS = 25;
export const MAX_STREAK_BONUS = 250;

export type HintKind = "letter" | "continent" | "region" | "answer";

/** What each hint costs. Showing the answer outright costs the most. */
export const HINT_COST: Record<HintKind, number> = {
  letter: 30,
  continent: 40,
  region: 60,
  answer: 120,
};

/** Points for a correct answer given the streak it continues. */
export function pointsFor(streakBefore: number): number {
  return (
    POINTS_PER_COUNTRY +
    Math.min(MAX_STREAK_BONUS, streakBefore * STREAK_BONUS)
  );
}

export type Score = {
  points: number;
  /** Correct answers in a row right now. */
  streak: number;
  /** The longest streak reached this round. */
  bestStreak: number;
};

export const emptyScore: Score = { points: 0, streak: 0, bestStreak: 0 };

export function scoreCorrect(score: Score): Score {
  const streak = score.streak + 1;
  return {
    points: score.points + pointsFor(score.streak),
    streak,
    bestStreak: Math.max(score.bestStreak, streak),
  };
}

/** A wrong answer costs nothing but the streak — the run is punishment enough. */
export function scoreWrong(score: Score): Score {
  return { ...score, streak: 0 };
}

/** Hints are deducted, but a round's score never goes below zero. */
export function scoreHint(score: Score, hint: HintKind): Score {
  return { ...score, points: Math.max(0, score.points - HINT_COST[hint]) };
}
