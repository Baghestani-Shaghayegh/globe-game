import { describe, expect, it } from "vitest";
import {
  MAX_LEVEL,
  XP_PER_BADGE,
  levelFor,
  progressFor,
  totalXp,
  xpFromBadges,
  xpFromRuns,
  xpToReach,
} from "./levels";
import type { Bucket, Run } from "./records";
import type { Earned } from "./achievements";
import { GLOBE_THEMES, themeById, unlockedThemes } from "./globeTheme";

const run = (over: Partial<Run> = {}): Run => ({
  ms: 60_000,
  at: "2026-09-09T12:00:00.000Z",
  found: 10,
  total: 44,
  ...over,
});

const bucket = (runs: Run[]): Bucket => ({
  key: "europe",
  type: "name",
  modeId: "europe",
  limitSeconds: null,
  ruleset: "relaxed",
  runs,
});

const badge = (unlocked: boolean): Earned =>
  ({ unlocked }) as Earned;

describe("xpToReach", () => {
  it("starts level 1 at nothing", () => {
    expect(xpToReach(1)).toBe(0);
  });

  it("climbs, and each level costs more than the last", () => {
    let previousStep = 0;
    for (let level = 2; level <= MAX_LEVEL; level += 1) {
      const step = xpToReach(level) - xpToReach(level - 1);
      expect(step).toBeGreaterThan(previousStep);
      previousStep = step;
    }
  });

  it("holds the shape the copy promises", () => {
    expect(xpToReach(2)).toBe(1_000);
    expect(xpToReach(5)).toBe(10_000);
    expect(xpToReach(10)).toBe(45_000);
    expect(xpToReach(20)).toBe(190_000);
  });

  it("clamps nonsense to the range", () => {
    expect(xpToReach(0)).toBe(0);
    expect(xpToReach(-5)).toBe(0);
    expect(xpToReach(999)).toBe(xpToReach(MAX_LEVEL));
  });
});

describe("levelFor", () => {
  it("starts everyone at level 1", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(999)).toBe(1);
  });

  it("promotes exactly on the threshold, not a point before", () => {
    expect(levelFor(xpToReach(2) - 1)).toBe(1);
    expect(levelFor(xpToReach(2))).toBe(2);
  });

  it("agrees with xpToReach at every level", () => {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      expect(levelFor(xpToReach(level))).toBe(level);
    }
  });

  it("stops at the cap", () => {
    expect(levelFor(10_000_000)).toBe(MAX_LEVEL);
  });
});

describe("xp from history", () => {
  it("uses a run's points when it has them", () => {
    expect(xpFromRuns([bucket([run({ points: 3_000 })])])).toBe(3_000);
  });

  it("values a run from before scoring existed by what it found", () => {
    expect(xpFromRuns([bucket([run({ found: 10 })])])).toBe(250);
  });

  it("pays a bonus for finishing the map", () => {
    const partial = xpFromRuns([bucket([run({ points: 500, found: 43, total: 44 })])]);
    const complete = xpFromRuns([bucket([run({ points: 500, found: 44, total: 44 })])]);
    expect(complete - partial).toBe(1_000);
  });

  it("adds up across buckets and runs", () => {
    expect(
      xpFromRuns([
        bucket([run({ points: 100 }), run({ points: 200 })]),
        bucket([run({ points: 300 })]),
      ])
    ).toBe(600);
  });

  it("is nothing for a player who has never finished a round", () => {
    expect(xpFromRuns([])).toBe(0);
  });

  it("counts earned badges only", () => {
    expect(xpFromBadges([badge(true), badge(false), badge(true)])).toBe(
      2 * XP_PER_BADGE
    );
  });

  it("totals runs and badges together", () => {
    expect(totalXp([bucket([run({ points: 1_000 })])], [badge(true)])).toBe(
      1_000 + XP_PER_BADGE
    );
  });
});

describe("progressFor", () => {
  it("puts a new player at the bottom of level 1", () => {
    expect(progressFor(0)).toMatchObject({ level: 1, into: 0, share: 0 });
  });

  it("reports how far through a level someone is", () => {
    const half = xpToReach(2) + (xpToReach(3) - xpToReach(2)) / 2;
    const progress = progressFor(half);
    expect(progress.level).toBe(2);
    expect(progress.share).toBeCloseTo(0.5);
  });

  it("says what is left to the next level", () => {
    expect(progressFor(xpToReach(3) - 250).toNext).toBe(250);
  });

  it("sits full at the cap, with nothing left to earn", () => {
    const progress = progressFor(xpToReach(MAX_LEVEL) + 50_000);
    expect(progress).toMatchObject({ level: MAX_LEVEL, share: 1, toNext: null });
  });

  it("never reports a share outside 0–1", () => {
    for (const xp of [0, 1, 999, 45_000, 190_000, 10_000_000]) {
      const { share } = progressFor(xp);
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  });
});

describe("globe themes", () => {
  it("has one available from the very start", () => {
    expect(unlockedThemes(1)).toHaveLength(1);
    expect(unlockedThemes(1)[0].id).toBe("atlantic");
  });

  it("unlocks more as the level climbs, and all of them by the cap", () => {
    expect(unlockedThemes(4).length).toBeGreaterThan(unlockedThemes(2).length);
    expect(unlockedThemes(MAX_LEVEL)).toHaveLength(GLOBE_THEMES.length);
  });

  it("gates every theme at a level that can actually be reached", () => {
    for (const entry of GLOBE_THEMES) {
      expect(entry.level).toBeGreaterThanOrEqual(1);
      expect(entry.level).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });

  it("has no duplicate ids", () => {
    const ids = GLOBE_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to the default for an id it doesn't know", () => {
    expect(themeById("no-such-theme").id).toBe("atlantic");
  });

  it("keeps found and missed distinct in every palette, since they carry meaning", () => {
    for (const entry of GLOBE_THEMES) {
      expect(entry.palette.found).not.toBe(entry.palette.missed);
      expect(entry.palette.found).not.toBe(entry.palette.unfound);
      expect(entry.palette.missed).not.toBe(entry.palette.unfound);
    }
  });
});
