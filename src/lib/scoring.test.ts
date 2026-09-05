import { describe, expect, it } from "vitest";
import {
  HINT_COST,
  emptyScore,
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
