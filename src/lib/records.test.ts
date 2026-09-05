import { beforeEach, describe, expect, it } from "vitest";
import {
  addRun,
  allBuckets,
  bestLabel,
  bestScore,
  bestTime,
  clearAll,
  formatDuration,
  getRuns,
  isComplete,
} from "./records";
import { gamePath, parseLimit, recordKey } from "../data/modes";

beforeEach(() => localStorage.clear());

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5_000, "0:05"],
    [65_000, "1:05"],
    [600_000, "10:00"],
    [3_600_000, "1:00:00"],
    [3_930_000, "1:05:30"],
    [-500, "0:00"],
  ])("%ims reads %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("storing runs", () => {
  it("keeps the newest run first", () => {
    addRun("europe", { ms: 1000, found: 1, total: 43 });
    addRun("europe", { ms: 2000, found: 2, total: 43 });
    expect(getRuns("europe").map((r) => r.found)).toEqual([2, 1]);
  });

  it("caps the history at 20 runs", () => {
    for (let i = 0; i < 25; i++) {
      addRun("europe", { ms: i * 1000, found: i, total: 43 });
    }
    const runs = getRuns("europe");
    expect(runs).toHaveLength(20);
    expect(runs[0].found).toBe(24);
  });

  it("keeps buckets independent", () => {
    addRun("europe", { ms: 1000, found: 5, total: 43 });
    addRun("find:europe@180", { ms: 2000, found: 9, total: 43 });
    expect(getRuns("europe")).toHaveLength(1);
    expect(getRuns("find:europe@180")[0].found).toBe(9);
  });

  it("survives a corrupt store", () => {
    localStorage.setItem("worldguess.records.v3", "not json{");
    expect(getRuns("europe")).toEqual([]);
    expect(() => addRun("europe", { ms: 1, found: 1, total: 2 })).not.toThrow();
    expect(getRuns("europe")).toHaveLength(1);
  });

  it("discards entries that aren't runs", () => {
    localStorage.setItem(
      "worldguess.records.v3",
      JSON.stringify({ europe: [{ ms: "nope" }, null, { ms: 5, found: 1, total: 2 }] })
    );
    expect(getRuns("europe")).toHaveLength(1);
  });

  it("retires the superseded v1 and v2 stores", () => {
    localStorage.setItem("worldguess.records.v1", "{}");
    localStorage.setItem("worldguess.records.v2", "{}");
    getRuns("europe");
    expect(localStorage.getItem("worldguess.records.v1")).toBeNull();
    expect(localStorage.getItem("worldguess.records.v2")).toBeNull();
  });
});

describe("picking the record", () => {
  it("ranks cleared runs by time and ignores partial ones", () => {
    addRun("europe", { ms: 5000, found: 43, total: 43 });
    addRun("europe", { ms: 3000, found: 40, total: 43 });
    expect(bestTime("europe")?.ms).toBe(5000);
  });

  it("has no best time until the map is cleared", () => {
    addRun("europe", { ms: 3000, found: 42, total: 43 });
    expect(bestTime("europe")).toBeNull();
  });

  it("ranks partial runs by score, breaking ties on time", () => {
    addRun("europe", { ms: 9000, found: 20, total: 43 });
    addRun("europe", { ms: 4000, found: 20, total: 43 });
    addRun("europe", { ms: 1000, found: 12, total: 43 });
    expect(bestScore("europe")).toMatchObject({ found: 20, ms: 4000 });
  });

  it("labels a cleared mode with a time and an unfinished one with a score", () => {
    addRun("europe", { ms: 20000, found: 30, total: 43 });
    expect(bestLabel("europe")).toBe("30/43");
    addRun("europe", { ms: 60000, found: 43, total: 43 });
    expect(bestLabel("europe")).toBe("1:00");
  });

  it("has no label for a mode never played", () => {
    expect(bestLabel("oceania")).toBeNull();
  });

  it("treats a run as complete only when everything was found", () => {
    expect(isComplete({ ms: 1, at: "", found: 43, total: 43 })).toBe(true);
    expect(isComplete({ ms: 1, at: "", found: 42, total: 43 })).toBe(false);
    expect(isComplete({ ms: 1, at: "", found: 0, total: 0 })).toBe(false);
  });
});

describe("buckets round-trip through their keys", () => {
  // "Play this again" on the Records page rebuilds a URL from the stored key,
  // so recordKey and allBuckets have to agree.
  it.each([
    ["name", "europe", null, "/play/europe"],
    ["find", "europe", null, "/find/europe"],
    ["name", "asia", 180, "/play/asia?limit=180"],
    ["find", "oceania", 60, "/find/oceania?limit=60"],
  ] as const)("%s %s %s", (type, modeId, limit, path) => {
    const key = recordKey(type, modeId, limit);
    addRun(key, { ms: 1000, found: 1, total: 10 });

    const bucket = allBuckets().find((b) => b.key === key);
    expect(bucket).toBeDefined();
    expect(bucket).toMatchObject({ type, modeId, limitSeconds: limit });
    expect(gamePath(bucket!.type, bucket!.modeId, bucket!.limitSeconds)).toBe(
      path
    );
  });

  it("skips buckets with no runs", () => {
    localStorage.setItem(
      "worldguess.records.v3",
      JSON.stringify({ europe: [], asia: [{ ms: 1, found: 1, total: 2 }] })
    );
    expect(allBuckets().map((b) => b.key)).toEqual(["asia"]);
  });

  it("clears everything", () => {
    addRun("europe", { ms: 1000, found: 1, total: 43 });
    clearAll();
    expect(allBuckets()).toEqual([]);
  });
});

describe("time limits from the URL", () => {
  it("accepts the limits the menu offers", () => {
    expect(parseLimit("60")).toBe(60);
    expect(parseLimit("600")).toBe(600);
  });

  it("rejects anything else", () => {
    for (const raw of ["9999", "0", "-60", "abc", "", null]) {
      expect(parseLimit(raw)).toBeNull();
    }
  });
});
