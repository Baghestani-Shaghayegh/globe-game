import { describe, expect, it } from "vitest";
import {
  HINT_FACTOR,
  POINTS_PER_COUNTRY,
  emptyScore,
  formatMultiplier,
  hintsOn,
  multiplierFor,
  pointsFor,
  scoreCorrect,
  scoreHint,
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
    expect(pointsFor(1)).toBe(110);
    expect(pointsFor(4)).toBe(140);
  });

  it("caps the streak bonus at half again", () => {
    expect(pointsFor(5)).toBe(150);
    expect(pointsFor(100)).toBe(150);
  });

  it("halves a country's worth for each hint, and drops the streak bonus", () => {
    expect(pointsFor(10, 1)).toBe(50);
    expect(pointsFor(10, 2)).toBe(25);
    expect(pointsFor(0, 1)).toBe(POINTS_PER_COUNTRY * HINT_FACTOR);
  });
});

// The totals the change was made for: the old rules paid 67,225 for a perfect
// 196 and 2,125 for a perfect ten, most of it streak.
describe("what a perfect round pays", () => {
  it("is 29,250 for the whole map", () => {
    expect(run(emptyScore, 196).points).toBe(29_250);
  });

  it("is 1,350 for ten, before the daily doubles it", () => {
    expect(run(emptyScore, 10).points).toBe(1_350);
  });
});

describe("scoring a round", () => {
  it("counts a streak of correct answers", () => {
    const score = run(emptyScore, 3);
    expect(score).toEqual({ points: 330, streak: 3, bestStreak: 3, hints: null });
  });

  it("breaks the streak on a wrong answer, and charges for it", () => {
    const after = scoreWrong(run(emptyScore, 3));
    expect(after).toMatchObject({
      points: 330 - WRONG_COST,
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

  it("remembers the best streak across breaks", () => {
    let score = run(emptyScore, 4);
    score = scoreWrong(score);
    score = run(score, 2);
    expect(score.streak).toBe(2);
    expect(score.bestStreak).toBe(4);
  });
});

describe("hints", () => {
  // The complaint that started this: at the top of a streak a letter cost 30
  // against an answer worth 350, and the streak carried on as if unhelped.
  it("costs a helped answer at least half of what it would have paid", () => {
    const streaking = run(emptyScore, 8);
    const unhelped = scoreCorrect(streaking, "Peru").points - streaking.points;
    const helped =
      scoreCorrect(scoreHint(streaking, "letter", "Peru"), "Peru").points -
      streaking.points;
    expect(helped).toBeLessThanOrEqual(unhelped / 2);
  });

  it("ends the streak on a helped answer", () => {
    const score = scoreCorrect(
      scoreHint(run(emptyScore, 4), "letter", "Peru"),
      "Peru"
    );
    expect(score.streak).toBe(0);
    expect(score.bestStreak).toBe(4);
  });

  it("takes nothing from the round until the answer comes", () => {
    const score = run(emptyScore, 2);
    expect(scoreHint(score, "letter", "Peru").points).toBe(score.points);
  });

  it("stacks: a letter and a narrowed map leave a quarter", () => {
    let score = scoreHint(emptyScore, "letter", "Peru");
    score = scoreHint(score, "region", "Peru");
    expect(hintsOn(score, "Peru")).toBe(2);
    expect(scoreCorrect(score, "Peru").points).toBe(25);
  });

  // Buying a letter for one country, then answering a different one, must not
  // charge the second for the first's help.
  it("belongs to the country it was bought for", () => {
    const score = scoreHint(emptyScore, "letter", "Peru");
    expect(hintsOn(score, "Chile")).toBe(0);
    expect(scoreCorrect(score, "Chile").points).toBe(100);
  });

  it("stays with the country through a wrong guess", () => {
    const score = scoreWrong(scoreHint(emptyScore, "letter", "Peru"));
    expect(hintsOn(score, "Peru")).toBe(1);
  });

  it("is spent once the country is answered or passed", () => {
    const hinted = scoreHint(emptyScore, "letter", "Peru");
    expect(scoreCorrect(hinted, "Peru").hints).toBe(null);
    expect(scorePass(hinted).hints).toBe(null);
  });
});

describe("showing the answer", () => {
  it("pays nothing, ends the streak, and costs what a wrong answer costs", () => {
    const score = run(emptyScore, 3);
    const after = scoreHint(score, "answer", "Peru");
    expect(after.points).toBe(score.points - WRONG_COST);
    expect(after.streak).toBe(0);
  });

  // A player at zero with a country they cannot find has to have a way on.
  it("is always possible, even with nothing to pay with", () => {
    expect(scoreHint(emptyScore, "answer", "Peru").points).toBe(0);
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

  it("starts at 1 and climbs a tenth per answer", () => {
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(1)).toBe(1.1);
    expect(multiplierFor(4)).toBe(1.4);
  });

  it("stops climbing at the cap", () => {
    expect(multiplierFor(5)).toBe(1.5);
    expect(multiplierFor(40)).toBe(1.5);
  });

  it("writes whole multiples without a decimal tail", () => {
    expect(formatMultiplier(0)).toBe("1×");
    expect(formatMultiplier(1)).toBe("1.1×");
    expect(formatMultiplier(5)).toBe("1.5×");
  });
});

describe("passing on a country", () => {
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
      scoreHint(score, "answer", "Peru").points
    );
  });
});
