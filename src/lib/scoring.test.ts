import { describe, expect, it } from "vitest";
import {
  HINT_COST,
  POINTS_PER_COUNTRY,
  emptyScore,
  formatMultiplier,
  multiplierFor,
  pointsFor,
  scoreCorrect,
  scoreHint,
  scoreWrong,
  type Score,
} from "./scoring";

const run = (score: Score, times: number) =>
  Array.from({ length: times }).reduce<Score>((s) => scoreCorrect(s), score);

describe("pointsFor", () => {
  it("pays more as the streak grows", () => {
    expect(pointsFor(0)).toBe(100);
    expect(pointsFor(1)).toBe(125);
    expect(pointsFor(4)).toBe(200);
  });

  it("caps the streak bonus", () => {
    expect(pointsFor(10)).toBe(350);
    expect(pointsFor(100)).toBe(350);
  });
});

describe("scoring a round", () => {
  it("counts a streak of correct answers", () => {
    const score = run(emptyScore, 3);
    expect(score).toEqual({ points: 375, streak: 3, bestStreak: 3 });
  });

  it("breaks the streak on a wrong answer but keeps the points", () => {
    const after = scoreWrong(run(emptyScore, 3));
    expect(after).toMatchObject({ points: 375, streak: 0, bestStreak: 3 });
  });

  it("remembers the best streak across breaks", () => {
    let score = run(emptyScore, 4);
    score = scoreWrong(score);
    score = run(score, 2);
    expect(score.streak).toBe(2);
    expect(score.bestStreak).toBe(4);
  });

  it("charges for a hint without touching the streak", () => {
    const score = scoreHint(run(emptyScore, 2), "letter");
    expect(score.points).toBe(225 - HINT_COST.letter);
    expect(score.streak).toBe(2);
  });

  it("never lets a hint push the score negative", () => {
    expect(scoreHint(emptyScore, "answer").points).toBe(0);
  });
});

describe("streak multiplier", () => {
  // The multiplier is shown, the points are scored; they must be the same
  // number said two ways, or the HUD is lying about what an answer is worth.
  it("matches what the answer actually pays", () => {
    for (let streak = 0; streak <= 15; streak++) {
      expect(multiplierFor(streak)).toBe(
        pointsFor(streak) / POINTS_PER_COUNTRY
      );
    }
  });

  it("starts at 1 and climbs a quarter per answer", () => {
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(1)).toBe(1.25);
    expect(multiplierFor(4)).toBe(2);
  });

  it("stops climbing at the cap", () => {
    expect(multiplierFor(10)).toBe(3.5);
    expect(multiplierFor(40)).toBe(3.5);
  });

  it("writes whole multiples without a decimal tail", () => {
    expect(formatMultiplier(0)).toBe("1×");
    expect(formatMultiplier(4)).toBe("2×");
    expect(formatMultiplier(1)).toBe("1.25×");
    expect(formatMultiplier(2)).toBe("1.5×");
  });
});
