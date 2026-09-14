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

/**
 * What a wrong answer costs.
 *
 * It used to cost nothing but the streak, on the reasoning that the run was
 * punishment enough. That made clicking around the map free: with no price on
 * a guess, sweeping the continent always beat thinking. It is deliberately
 * less than the cheapest hint, so buying a nudge stays the better deal than
 * guessing blind.
 */
export const WRONG_COST = 25;

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

/**
 * The same number said out loud: what the next correct answer is worth as a
 * multiple of the base. The streak always paid — 3.5x at the top — but the
 * only thing on screen was a count, so nobody could tell. This is the figure
 * the HUD shows, and it is derived from `pointsFor` rather than restated, so
 * the display cannot drift from the scoring.
 */
export function multiplierFor(streakBefore: number): number {
  return pointsFor(streakBefore) / POINTS_PER_COUNTRY;
}

/** The multiplier as it is written on screen: "2x", "2.25x". */
export function formatMultiplier(streakBefore: number): string {
  const multiplier = multiplierFor(streakBefore);
  return `${Number.isInteger(multiplier) ? multiplier : multiplier.toFixed(2).replace(/0$/, "")}\u00d7`;
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

/** A wrong answer breaks the streak and costs points, never below zero. */
export function scoreWrong(score: Score): Score {
  return {
    ...score,
    points: Math.max(0, score.points - WRONG_COST),
    streak: 0,
  };
}

/**
 * Passing on a country: the streak goes, the points stay.
 *
 * Between a wrong answer, which costs 25, and buying the answer, which costs
 * 120, there was nothing for "I don't know this one and I don't want to pay
 * to find out". This is that. It is not free — a streak is worth up to 250 on
 * the next correct answer — it just isn't charged for.
 */
export function scorePass(score: Score): Score {
  return { ...score, streak: 0 };
}

/** Hints are deducted, but a round's score never goes below zero. */
export function scoreHint(score: Score, hint: HintKind): Score {
  return { ...score, points: Math.max(0, score.points - HINT_COST[hint]) };
}

/**
 * Whether a hint can be paid for out of what has been earned so far.
 *
 * The floor in `scoreHint` meant a hint cost nothing at zero points, so every
 * hint was free at the start of every round — free exactly when it is worth
 * the most. Offering one that cannot be paid for is the thing to stop, not
 * the deduction.
 *
 * Deliberately not applied to "show me the answer": that is the way past a
 * country you cannot find rather than an advantage, and a player with no
 * points and no way forward is stuck. It still charges what it can.
 */
export function canAfford(score: Score, hint: HintKind): boolean {
  return score.points >= HINT_COST[hint];
}
