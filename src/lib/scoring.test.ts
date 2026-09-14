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
  canAfford,
  scorePass,
  scoreWrong,
  WRONG_COST,
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

  it("breaks the streak on a wrong answer, and charges for it", () => {
    const after = scoreWrong(run(emptyScore, 3));
    expect(after).toMatchObject({
      points: 375 - WRONG_COST,
      streak: 0,
      bestStreak: 3,
    });
  });

  // Sweeping the continent used to be free. It costs something now, but never
  // enough to put a player in the red — a round's score has a floor.
  it("never charges a wrong answer below zero", () => {
    expect(scoreWrong(emptyScore).points).toBe(0);
    expect(scoreWrong(scoreWrong(emptyScore)).points).toBe(0);
  });

  it("costs less than the cheapest hint, so a nudge stays the better deal", () => {
    expect(WRONG_COST).toBeLessThan(Math.min(...Object.values(HINT_COST)));
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

describe("paying for a hint", () => {
  it("needs the points to be there first", () => {
    expect(canAfford(emptyScore, "letter")).toBe(false);
    expect(canAfford(run(emptyScore, 1), "letter")).toBe(true);
  });

  it("goes by the price of the hint asked for", () => {
    const score = { ...emptyScore, points: 50 };
    expect(canAfford(score, "letter")).toBe(true); // 30
    expect(canAfford(score, "continent")).toBe(true); // 40
    expect(canAfford(score, "region")).toBe(false); // 60
    expect(canAfford(score, "answer")).toBe(false); // 120
  });

  it("counts exactly enough as enough", () => {
    expect(canAfford({ ...emptyScore, points: HINT_COST.region }, "region")).toBe(
      true
    );
    expect(
      canAfford({ ...emptyScore, points: HINT_COST.region - 1 }, "region")
    ).toBe(false);
  });

  // The one hint that is not gated: a player at zero with a country they
  // cannot find has to have a way forward.
  it("still lets the answer be bought when it cannot be paid for", () => {
    expect(scoreHint(emptyScore, "answer").points).toBe(0);
  });
});

describe("passing on a country", () => {
  // Between a wrong guess at 25 and buying the answer at 120, there was
  // nothing for "I don't know this one and I'm not paying to find out".
  it("costs no points", () => {
    const score = run(emptyScore, 3);
    expect(scorePass(score).points).toBe(score.points);
  });

  it("still breaks the streak — it was not answered", () => {
    expect(scorePass(run(emptyScore, 3)).streak).toBe(0);
  });

  it("keeps the best streak reached", () => {
    expect(scorePass(run(emptyScore, 4)).bestStreak).toBe(4);
  });

  // Which is the whole difference between the two, and the reason both exist.
  it("is cheaper than a wrong guess and cheaper than the answer", () => {
    const score = run(emptyScore, 3);
    expect(scorePass(score).points).toBeGreaterThan(scoreWrong(score).points);
    expect(scorePass(score).points).toBeGreaterThan(
      scoreHint(score, "answer").points
    );
  });
});
