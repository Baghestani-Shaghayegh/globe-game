import { beforeEach, describe, expect, it } from "vitest";
import { GAME_TYPES } from "../data/modes";
import {
  DAILY_COUNTRIES,
  challengeFor,
  dailyType,
  dayKey,
  dayNumber,
  playedDays,
  resultFor,
  saveResult,
  streak,
  type DailyResult,
} from "./daily";

const POOL = Array.from({ length: 60 }, (_, i) => `Country ${i}`);

beforeEach(() => localStorage.clear());

describe("which day it is", () => {
  it("keys a date in UTC, so the world turns over together", () => {
    expect(dayKey(new Date("2026-09-07T23:59:00Z"))).toBe("2026-09-07");
    expect(dayKey(new Date("2026-09-08T00:01:00Z"))).toBe("2026-09-08");
  });

  it("numbers days from the epoch", () => {
    expect(dayNumber("2026-01-01")).toBe(1);
    expect(dayNumber("2026-01-02")).toBe(2);
    expect(dayNumber("2026-09-07")).toBe(250);
  });
});

describe("the day's round", () => {
  it("is the same every time it is built", () => {
    const a = challengeFor("2026-09-07", POOL);
    const b = challengeFor("2026-09-07", POOL);
    expect(a).toEqual(b);
  });

  it("differs from one day to the next", () => {
    const a = challengeFor("2026-09-07", POOL);
    const b = challengeFor("2026-09-08", POOL);
    expect(a.countries).not.toEqual(b.countries);
  });

  it("asks for ten countries, without repeating one", () => {
    const { countries } = challengeFor("2026-09-07", POOL);
    expect(countries).toHaveLength(DAILY_COUNTRIES);
    expect(new Set(countries).size).toBe(DAILY_COUNTRIES);
  });

  it("only ever asks for countries from the pool it was given", () => {
    const { countries } = challengeFor("2026-09-07", POOL);
    expect(countries.every((c) => POOL.includes(c))).toBe(true);
  });

  it("copes with a pool smaller than a full round", () => {
    const { countries } = challengeFor("2026-09-07", ["A", "B"]);
    expect(countries).toHaveLength(2);
  });

  it("rotates through every game type, then starts again", () => {
    // Derived from the list rather than hard-coded, so adding a fifth way to
    // play doesn't quietly leave this asserting the old count.
    const count = GAME_TYPES.length;
    const days = Array.from({ length: count }, (_, i) =>
      `2026-01-${String(i + 1).padStart(2, "0")}`
    );
    const types = days.map((d) => challengeFor(d, POOL).type);
    expect(new Set(types).size).toBe(count);

    const next = `2026-01-${String(count + 1).padStart(2, "0")}`;
    expect(challengeFor(next, POOL).type).toBe(types[0]);
  });

  it("offers every game type over a long enough stretch", () => {
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) =>
        challengeFor(`2026-03-${String(i + 1).padStart(2, "0")}`, POOL).type
      )
    );
    expect(seen.size).toBe(GAME_TYPES.length);
  });
});

const result = (day: string, over: Partial<DailyResult> = {}): DailyResult => ({
  day,
  number: dayNumber(day),
  type: "find",
  points: 900,
  found: 8,
  total: 10,
  ms: 61_000,
  outcomes: ["first", "first", "retried", "missed"],
  ...over,
});

describe("remembering the day", () => {
  it("stores and reads back a result", () => {
    saveResult(result("2026-09-07"));
    expect(resultFor("2026-09-07")?.points).toBe(900);
    expect(resultFor("2026-09-06")).toBeNull();
  });

  it("keeps each day separate", () => {
    saveResult(result("2026-09-06", { points: 100 }));
    saveResult(result("2026-09-07", { points: 200 }));
    expect(playedDays()).toEqual(["2026-09-07", "2026-09-06"]);
  });

  it("survives a corrupt store", () => {
    localStorage.setItem("worldguess.daily.v1", "not json{");
    expect(resultFor("2026-09-07")).toBeNull();
    expect(() => saveResult(result("2026-09-07"))).not.toThrow();
  });
});

describe("streaks", () => {
  it("counts consecutive days up to today", () => {
    for (const d of ["2026-09-05", "2026-09-06", "2026-09-07"]) saveResult(result(d));
    expect(streak("2026-09-07")).toBe(3);
  });

  it("still stands the morning after, before today is played", () => {
    for (const d of ["2026-09-05", "2026-09-06"]) saveResult(result(d));
    expect(streak("2026-09-07")).toBe(2);
  });

  it("breaks after a missed day", () => {
    for (const d of ["2026-09-01", "2026-09-06", "2026-09-07"]) saveResult(result(d));
    expect(streak("2026-09-07")).toBe(2);
  });

  it("is zero with nothing played, or after a long gap", () => {
    expect(streak("2026-09-07")).toBe(0);
    saveResult(result("2026-08-01"));
    expect(streak("2026-09-07")).toBe(0);
  });
});


describe("dailyType", () => {
  // The leaderboard builds today's bucket key from this without loading a
  // country list, so it has to agree with what the challenge actually is.
  it("matches the type the day's challenge is built as", () => {
    for (const day of [
      "2026-09-11",
      "2026-09-12",
      "2026-01-01",
      "2025-12-31",
      "2026-06-15",
      "2026-03-03",
    ]) {
      expect(dailyType(day)).toBe(challengeFor(day, ["Peru", "Chad"]).type);
    }
  });

  it("works its way through every game type", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      seen.add(dailyType(day));
    }
    expect(seen.size).toBe(GAME_TYPES.length);
  });
});
