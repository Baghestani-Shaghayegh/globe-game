import { beforeEach, describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  clearAchievements,
  evaluate,
  refresh,
  tally,
  type PlayerHistory,
} from "./achievements";
import type { Bucket, Run } from "./records";
import type { CountryRow } from "./countryStats";

beforeEach(() => localStorage.clear());

const run = (over: Partial<Run> = {}): Run => ({
  ms: 60_000,
  at: "2026-09-09T12:00:00.000Z",
  found: 5,
  total: 10,
  ...over,
});

const bucket = (over: Partial<Bucket> = {}): Bucket => ({
  key: "europe",
  type: "name",
  modeId: "europe",
  limitSeconds: null,
  count: null,
  ruleset: "relaxed",
  runs: [run()],
  ...over,
});

const country = (name: string, over: Partial<CountryRow> = {}): CountryRow => ({
  geoName: name,
  displayName: name,
  continents: ["europe"],
  seen: 1,
  first: 1,
  fumbled: 0,
  missed: 0,
  accuracy: 100,
  ...over,
});

const history = (over: Partial<PlayerHistory> = {}): PlayerHistory => ({
  buckets: [],
  countries: [],
  dailyStreak: 0,
  dailyPlayed: 0,
  ...over,
});

const find = (earned: ReturnType<typeof evaluate>, id: string) => {
  const badge = earned.find((b) => b.id === id);
  if (!badge) throw new Error(`no achievement ${id}`);
  return badge;
};

describe("the catalogue", () => {
  it("has no duplicate ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("asks for a positive amount of something in every case", () => {
    for (const badge of ACHIEVEMENTS) {
      expect(badge.measure(history()).need).toBeGreaterThan(0);
    }
  });

  it("starts a new player at nothing earned", () => {
    const earned = evaluate(history());
    expect(earned.every((b) => !b.unlocked)).toBe(true);
    expect(tally(earned)).toEqual({ unlocked: 0, total: ACHIEVEMENTS.length });
  });
});

describe("finishing rounds", () => {
  it("earns the first badge for one finished round", () => {
    const earned = evaluate(history({ buckets: [bucket()] }));
    expect(find(earned, "first-round").unlocked).toBe(true);
  });

  it("counts a streak across every mode, taking the best", () => {
    const earned = evaluate(
      history({
        buckets: [
          bucket({ runs: [run({ bestStreak: 4 })] }),
          bucket({ key: "asia", modeId: "asia", runs: [run({ bestStreak: 12 })] }),
        ],
      })
    );
    expect(find(earned, "streak-10")).toMatchObject({ have: 12, unlocked: true });
    expect(find(earned, "streak-50")).toMatchObject({ have: 12, unlocked: false });
  });

  it("only counts a sudden-death streak towards the sudden-death badge", () => {
    const relaxed = evaluate(
      history({ buckets: [bucket({ runs: [run({ bestStreak: 40 })] })] })
    );
    expect(find(relaxed, "sudden-death").unlocked).toBe(false);

    const sudden = evaluate(
      history({
        buckets: [
          bucket({ ruleset: "sudden", runs: [run({ bestStreak: 25 })] }),
        ],
      })
    );
    expect(find(sudden, "sudden-death").unlocked).toBe(true);
  });
});

describe("clearing maps", () => {
  const clear = (modeId: string) =>
    bucket({ key: modeId, modeId, runs: [run({ found: 44, total: 44 })] });

  it("wants the map actually finished, not just played", () => {
    const partial = evaluate(
      history({ buckets: [bucket({ runs: [run({ found: 43, total: 44 })] })] })
    );
    expect(find(partial, "clear-europe").unlocked).toBe(false);

    const done = evaluate(history({ buckets: [clear("europe")] }));
    expect(find(done, "clear-europe").unlocked).toBe(true);
  });

  it("accepts a clear in any game type", () => {
    const earned = evaluate(
      history({
        buckets: [
          bucket({
            key: "flag:europe",
            type: "flag",
            modeId: "europe",
            runs: [run({ found: 44, total: 44 })],
          }),
        ],
      })
    );
    expect(find(earned, "clear-europe").unlocked).toBe(true);
  });

  it("counts continents towards the set", () => {
    const earned = evaluate(
      history({ buckets: [clear("europe"), clear("asia"), clear("africa")] })
    );
    expect(find(earned, "clear-all-regions")).toMatchObject({
      have: 3,
      need: 5,
      unlocked: false,
    });
  });

  it("finishes the set at all five", () => {
    const earned = evaluate(
      history({
        buckets: ["europe", "asia", "africa", "americas", "oceania"].map(clear),
      })
    );
    expect(find(earned, "clear-all-regions").unlocked).toBe(true);
  });
});

describe("speed demon", () => {
  const clearIn = (ms: number) =>
    bucket({ modeId: "europe", runs: [run({ found: 44, total: 44, ms })] });

  it("is not earned by a slow clear", () => {
    const earned = evaluate(history({ buckets: [clearIn(150_000)] }));
    expect(find(earned, "speed-region").unlocked).toBe(false);
  });

  it("is earned under two minutes", () => {
    const earned = evaluate(history({ buckets: [clearIn(90_000)] }));
    expect(find(earned, "speed-region").unlocked).toBe(true);
  });

  it("ignores a fast run that didn't finish the map", () => {
    const earned = evaluate(
      history({
        buckets: [bucket({ modeId: "europe", runs: [run({ found: 2, total: 44, ms: 3000 })] })],
      })
    );
    expect(find(earned, "speed-region").unlocked).toBe(false);
  });
});

describe("countries met", () => {
  const met = (n: number) =>
    Array.from({ length: n }, (_, i) => country(`Country ${i}`));

  it("counts distinct countries, not sightings", () => {
    const earned = evaluate(
      history({ countries: [country("France", { seen: 40, first: 40 })] })
    );
    expect(find(earned, "met-100").have).toBe(1);
  });

  it("unlocks at a hundred", () => {
    expect(find(evaluate(history({ countries: met(99) })), "met-100").unlocked).toBe(false);
    expect(find(evaluate(history({ countries: met(100) })), "met-100").unlocked).toBe(true);
  });
});

describe("sharp eye", () => {
  const rows = (count: number, accuracy: number) =>
    Array.from({ length: count }, (_, i) =>
      country(`Country ${i}`, {
        seen: 1,
        first: i < Math.round((accuracy / 100) * count) ? 1 : 0,
        missed: i < Math.round((accuracy / 100) * count) ? 0 : 1,
        accuracy,
      })
    );

  it("won't be earned on a handful of lucky answers", () => {
    // Three for three is 100% accuracy and means nothing.
    const earned = evaluate(history({ countries: rows(3, 100) }));
    expect(find(earned, "sharp-eye")).toMatchObject({ have: 0, unlocked: false });
  });

  it("is earned once there is enough history behind the number", () => {
    const earned = evaluate(history({ countries: rows(100, 85) }));
    expect(find(earned, "sharp-eye").unlocked).toBe(true);
  });

  it("is not earned by a hundred countries answered badly", () => {
    const earned = evaluate(history({ countries: rows(100, 40) }));
    expect(find(earned, "sharp-eye").unlocked).toBe(false);
  });
});

describe("the daily challenge", () => {
  it("tracks the running streak", () => {
    const earned = evaluate(history({ dailyStreak: 7 }));
    expect(find(earned, "daily-7").unlocked).toBe(true);
    expect(find(earned, "daily-30").unlocked).toBe(false);
  });

  it("counts total days played separately from the streak", () => {
    const earned = evaluate(history({ dailyStreak: 2, dailyPlayed: 50 }));
    expect(find(earned, "daily-50").unlocked).toBe(true);
    expect(find(earned, "daily-7").unlocked).toBe(false);
  });
});

describe("refresh", () => {
  it("stamps a newly earned badge and keeps the date afterwards", () => {
    const first = refresh(history({ buckets: [bucket()] }));
    const stamped = first.find((b) => b.id === "first-round")!.at;
    expect(stamped).not.toBeNull();

    const again = refresh(history({ buckets: [bucket()] }));
    expect(again.find((b) => b.id === "first-round")!.at).toBe(stamped);
  });

  it("leaves unearned badges undated", () => {
    const earned = refresh(history());
    expect(earned.every((b) => b.at === null)).toBe(true);
  });

  it("keeps a badge earned even if the history behind it is cleared", () => {
    refresh(history({ buckets: [bucket()] }));
    // Records wiped, but the date stays on file — the badge was earned.
    const after = evaluate(history(), JSON.parse(localStorage.getItem("worldguess.achievements.v1")!));
    expect(after.find((b) => b.id === "first-round")!.at).not.toBeNull();
  });

  it("starts fresh on a corrupt store", () => {
    localStorage.setItem("worldguess.achievements.v1", "{not json");
    expect(() => refresh(history())).not.toThrow();
  });

  it("clears", () => {
    refresh(history({ buckets: [bucket()] }));
    clearAchievements();
    expect(localStorage.getItem("worldguess.achievements.v1")).toBeNull();
  });
});
