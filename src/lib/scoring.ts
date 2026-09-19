/**
 * Scoring for a round.
 *
 * A correct answer is worth a base amount, plus a bonus that grows with the
 * current streak so a run of answers is worth more than the same answers
 * scattered between mistakes. A hint is paid for by the country it helps with,
 * which is what makes taking one a decision rather than a free win.
 */
export const POINTS_PER_COUNTRY = 100;
/**
 * Extra per country already in the streak, capped so it can't run away.
 *
 * It was +25 a step up to +250, so an answer at the top of a streak paid
 * 3.5 times the base and a long round was mostly streak: a perfect 196 came
 * to 67,225. Quiz games that reward a run keep the reward a garnish —
 * Kahoot's streak bonus tops out at half again — so this now does the same:
 * +10 a step, up to +50, 1.5x at the top. The same perfect 196 is 29,250.
 */
export const STREAK_BONUS = 10;
export const MAX_STREAK_BONUS = 50;

/**
 * What a wrong answer costs.
 *
 * It used to cost nothing but the streak, on the reasoning that the run was
 * punishment enough. That made clicking around the map free: with no price on
 * a guess, sweeping the continent always beat thinking.
 */
export const WRONG_COST = 25;

export type HintKind = "letter" | "region" | "answer";

/**
 * What each hint leaves a country worth.
 *
 * Hints used to be a flat charge on the round's total — 30 for a letter — and
 * left the streak alone, so at the top of a streak a letter cost under a
 * tenth of the answer it bought. Now a hint is charged to the country it is
 * for, the way quiz games price help: each one halves what that country pays,
 * and a helped answer earns no streak bonus and starts the streak again.
 * "Show me" is not a hint in this sense — see `scoreHint`.
 */
export const HINT_FACTOR = 0.5;

/**
 * How quickly an answer came, as the share of the base it keeps.
 *
 * Quiz games that race the clock pay a quick answer more — Kahoot gives the
 * full amount for an instant answer and half for one at the buzzer. The same
 * here: within FAST_MS the whole base, falling evenly to SLOW_SHARE of it by
 * SLOW_MS, and no lower. Speed only ever takes away, so the most an answer
 * can pay is unchanged. The window allows for typing: finding a country and
 * spelling it takes a quick player about five seconds.
 */
export const FAST_MS = 5_000;
export const SLOW_MS = 30_000;
export const SLOW_SHARE = 0.5;

export function speedShare(ms: number): number {
  const late = Math.min(1, Math.max(0, (ms - FAST_MS) / (SLOW_MS - FAST_MS)));
  return 1 - (1 - SLOW_SHARE) * late;
}

/** Hints bought so far on this one country. */
export function hintsOn(score: Score, name: string): number {
  return score.hints?.name === name ? score.hints.count : 0;
}

/**
 * Points for a correct answer given the streak it continues, the hints bought
 * for it, and how long it took. Speed and hints scale the base; the streak
 * bonus is added on top, and a helped answer does not get it.
 */
export function pointsFor(streakBefore: number, hints = 0, ms = 0): number {
  const base = Math.round(
    POINTS_PER_COUNTRY * speedShare(ms) * HINT_FACTOR ** hints
  );
  if (hints > 0) return base;
  return base + Math.min(MAX_STREAK_BONUS, streakBefore * STREAK_BONUS);
}

/**
 * The same number said out loud: what the next correct answer is worth as a
 * multiple of the base. The streak always paid — 1.5x at the top — but the
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
  /** Hints bought for the country being answered, and which country. */
  hints: { name: string; count: number } | null;
};

export const emptyScore: Score = {
  points: 0,
  streak: 0,
  bestStreak: 0,
  hints: null,
};

/**
 * A correct answer: paid by streak, hints and speed, and the country's hints
 * spent. `ms` is how long this answer took.
 */
export function scoreCorrect(score: Score, name = "", ms = 0): Score {
  const hints = hintsOn(score, name);
  const streak = hints > 0 ? 0 : score.streak + 1;
  return {
    points: score.points + pointsFor(score.streak, hints, ms),
    streak,
    bestStreak: Math.max(score.bestStreak, streak),
    hints: null,
  };
}

/**
 * A wrong answer breaks the streak and costs points, never below zero. Hints
 * already bought stay with the country: it is still the one being asked.
 */
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
 * For "I don't know this one and I don't want to pay to find out". It is not
 * free — a streak is worth up to 50 on every answer after it — it just isn't
 * charged for.
 */
export function scorePass(score: Score): Score {
  return { ...score, streak: 0, hints: null };
}

/**
 * Buys a hint for one country.
 *
 * A letter or a narrowed map halves what that country will pay. "Show me"
 * gives the country away, so it pays nothing, ends the streak, and costs what
 * a wrong answer costs — or it would be the free way to learn every answer,
 * better than passing.
 */
export function scoreHint(score: Score, hint: HintKind, name: string): Score {
  if (hint === "answer") {
    return {
      ...score,
      points: Math.max(0, score.points - WRONG_COST),
      streak: 0,
      hints: null,
    };
  }
  return { ...score, hints: { name, count: hintsOn(score, name) + 1 } };
}
