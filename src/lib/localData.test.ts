import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  LOCAL_KEYS,
  clearLocalData,
  replayTodaysDailies,
  storedCount,
} from "./localData";

/** Every source file, so the list can be checked against what the code writes. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe("local data", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears every key it lists", () => {
    for (const key of LOCAL_KEYS) localStorage.setItem(key, "x");
    expect(storedCount()).toBe(LOCAL_KEYS.length);
    clearLocalData();
    expect(storedCount()).toBe(0);
  });

  it("leaves keys belonging to anything else alone", () => {
    localStorage.setItem("someone-elses-key", "x");
    clearLocalData();
    expect(localStorage.getItem("someone-elses-key")).toBe("x");
  });

  // The list is hand-written, so this is the thing that can rot: a feature
  // added later stores something and "clear my data" quietly misses it.
  it("names every worldguess key the source writes", () => {
    const found = new Set<string>();
    for (const file of sources("src")) {
      if (file.endsWith("localData.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/"(worldguess\.[\w.]+)"/g)) {
        found.add(match[1]);
      }
    }
    expect([...found].sort()).toEqual([...LOCAL_KEYS].sort());
  });

  it("counts nothing when storage is unavailable", () => {
    const storage = globalThis.localStorage;
    // @ts-expect-error — the private-window case.
    delete globalThis.localStorage;
    expect(storedCount()).toBe(0);
    expect(() => clearLocalData()).not.toThrow();
    globalThis.localStorage = storage;
  });
});

describe("replaying today", () => {
  const TODAY = "2026-09-11";
  const YESTERDAY = "2026-09-10";

  beforeEach(() => {
    localStorage.setItem(
      "worldguess.daily.v1",
      JSON.stringify({
        [YESTERDAY]: { day: YESTERDAY, points: 900 },
        [TODAY]: { day: TODAY, points: 1200 },
      })
    );
    localStorage.setItem("worldguess.mystery.v1", JSON.stringify({ day: TODAY }));
    localStorage.setItem("worldguess.connect.v1", JSON.stringify({ day: TODAY }));
  });

  it("makes all three playable again", () => {
    replayTodaysDailies(TODAY);
    const daily = JSON.parse(localStorage.getItem("worldguess.daily.v1")!);
    expect(daily[TODAY]).toBeUndefined();
    expect(localStorage.getItem("worldguess.mystery.v1")).toBe(null);
    expect(localStorage.getItem("worldguess.connect.v1")).toBe(null);
  });

  // The whole reason it takes a day rather than clearing the key: wiping the
  // history would reset the streak, and a streak is the thing hardest to
  // rebuild while testing.
  it("leaves earlier days, and the streak they carry, alone", () => {
    replayTodaysDailies(TODAY);
    const daily = JSON.parse(localStorage.getItem("worldguess.daily.v1")!);
    expect(daily[YESTERDAY]).toEqual({ day: YESTERDAY, points: 900 });
  });

  it("does nothing harmful when nothing has been played", () => {
    localStorage.clear();
    expect(() => replayTodaysDailies(TODAY)).not.toThrow();
  });

  it("survives a corrupt store", () => {
    localStorage.setItem("worldguess.daily.v1", "{not json");
    expect(() => replayTodaysDailies(TODAY)).not.toThrow();
  });
});
