import { beforeEach, describe, expect, it } from "vitest";
import {
  DAILY_COUNTRIES,
  challengeFor,
  DAILY_LIMIT_MS,
  DAILY_LIMIT_SECONDS,
  DAILY_MULTIPLIER,
  MAX_RUN_MS,
  MIN_RUN_MS,
  elapsedMs,
  dailyType,
  dayKey,
  dayNumber,
  playedDays,
  recentDays,
  resultFor,
  saveResult,
  streak,
  streakState,
  type DailyResult,
} from "./daily";
import { recordKey, TIME_LIMITS } from "../data/modes";
import { describeBucket, isDailyBucket } from "./leaderboard";

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

  // One game every day, so that everybody's daily score is comparable with
  // everybody else's — and so the card on the menu can say what it is.
  it("is the same game every day: naming the country", () => {
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) =>
        challengeFor(`2026-03-${String(i + 1).padStart(2, "0")}`, POOL).type
      )
    );
    expect([...seen]).toEqual(["name"]);
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

describe("what the streak display needs to know", () => {
  it("says whether today is already counted", () => {
    for (const d of ["2026-09-05", "2026-09-06"]) saveResult(result(d));
    expect(streakState("2026-09-07").playedToday).toBe(false);
    saveResult(result("2026-09-07"));
    expect(streakState("2026-09-07").playedToday).toBe(true);
  });

  // The morning after is the case worth getting right: the streak still
  // stands, but it is one day from being lost, and the card has to be able to
  // say so.
  it("still counts the run the morning after, unplayed", () => {
    for (const d of ["2026-09-05", "2026-09-06"]) saveResult(result(d));
    const state = streakState("2026-09-07");
    expect(state.days).toBe(2);
    expect(state.playedToday).toBe(false);
  });

  it("remembers the longest run even once it is broken", () => {
    for (const d of [
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-07",
    ]) {
      saveResult(result(d));
    }
    const state = streakState("2026-09-07");
    expect(state.days).toBe(1);
    expect(state.best).toBe(4);
  });

  it("counts the current run as the best when it is", () => {
    for (const d of ["2026-09-05", "2026-09-06", "2026-09-07"]) saveResult(result(d));
    expect(streakState("2026-09-07")).toEqual({
      days: 3,
      playedToday: true,
      best: 3,
    });
  });

  it("is all zeroes with nothing played", () => {
    expect(streakState("2026-09-07")).toEqual({
      days: 0,
      playedToday: false,
      best: 0,
    });
  });

  // A month boundary is where a hand-rolled "yesterday" goes wrong.
  it("carries a run across the end of a month", () => {
    for (const d of ["2026-08-30", "2026-08-31", "2026-09-01"]) saveResult(result(d));
    expect(streakState("2026-09-01").days).toBe(3);
    expect(streakState("2026-09-01").best).toBe(3);
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

  // It used to rotate through all six by date, which meant the card on the
  // menu could not say what you were about to play — and that card is called
  // Country hunt, so on a flags day it was wrong.
  it("is naming the country, every day", () => {
    for (let i = 0; i < 40; i++) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      expect(dailyType(day)).toBe("name");
    }
  });
});

describe("the daily bonus", () => {
  // The daily is ten countries against a hundred and sixty-seven, so without
  // a multiplier the one round everyone plays together is the worst-paying
  // thing on the board.
  it("is a whole number a player can hold in their head", () => {
    expect(Number.isInteger(DAILY_MULTIPLIER)).toBe(true);
    expect(DAILY_MULTIPLIER).toBeGreaterThan(1);
  });
});

describe("elapsed time filed with a score", () => {
  it("is the real gap when the puzzle was stamped", () => {
    const started = 1_000_000;
    expect(elapsedMs(started, started + 45_000)).toBe(45_000);
  });

  // The scores table checks this column, and a rejected row loses the whole
  // score over a detail the board doesn't even rank on.
  it("never falls below the floor the table accepts", () => {
    const started = 1_000_000;
    expect(elapsedMs(started, started + 10)).toBe(MIN_RUN_MS);
    expect(elapsedMs(started, started)).toBe(MIN_RUN_MS);
  });

  it("never exceeds the ceiling, for a puzzle left open overnight", () => {
    const started = 1_000_000;
    expect(elapsedMs(started, started + 9 * 86_400_000)).toBe(MAX_RUN_MS);
  });

  // Rounds saved before scores were posted carry no stamp.
  it("falls back to the floor when there is no stamp", () => {
    expect(elapsedMs(undefined)).toBe(MIN_RUN_MS);
  });
});

describe("the daily's time limit", () => {
  it("is the milliseconds the seconds say", () => {
    expect(DAILY_LIMIT_MS).toBe(DAILY_LIMIT_SECONDS * 1000);
  });

  // Enough that a country the player has never heard of is a setback rather
  // than the end of the round.
  it("leaves room for the ten countries it asks for", () => {
    expect(DAILY_LIMIT_SECONDS / DAILY_COUNTRIES).toBeGreaterThanOrEqual(20);
  });

  // Not decoration: describeBucket reads a limit back through this list, and
  // one that isn't in it renders as a bare "300s".
  it("is a limit the rest of the game offers", () => {
    expect(TIME_LIMITS.map((l) => l.seconds)).toContain(DAILY_LIMIT_SECONDS);
  });

  // Two bugs waiting here. The bucket the timed daily files under has to
  // still read as a daily, or replaying one stops being blocked; and the key
  // has to be the one the board looks up, which is why the limit lives in one
  // constant both sides import.
  it("still files under a bucket the game knows is a daily", () => {
    const bucket = recordKey("name", "daily", DAILY_LIMIT_SECONDS);
    // "name" is the classic game, which keeps the bare mode id — no prefix.
    expect(bucket).toBe("daily@300");
    expect(isDailyBucket(bucket)).toBe(true);
    expect(describeBucket(bucket)).toContain("Daily");
    expect(describeBucket(bucket)).toContain("5 min");
  });
});

describe("recentDays", () => {
  it("returns a fortnight, oldest first, ending today", () => {
    const days = recentDays(14, "2026-09-25");
    expect(days).toHaveLength(14);
    expect(days[0].day).toBe("2026-09-12");
    expect(days[13].day).toBe("2026-09-25");
  });

  it("marks the days that were not played", () => {
    saveResult({
      day: "2026-09-24",
      number: 1,
      type: "name",
      points: 900,
      found: 9,
      total: 10,
      ms: 120_000,
      outcomes: [],
    });

    const days = recentDays(3, "2026-09-25");
    expect(days.map((day) => day.found)).toEqual([null, 9, null]);
  });

  it("crosses a month boundary backwards", () => {
    expect(recentDays(3, "2026-10-01")[0].day).toBe("2026-09-29");
  });
});
