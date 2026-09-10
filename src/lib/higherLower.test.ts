import { beforeEach, describe, expect, it } from "vitest";
import {
  askable,
  bigger,
  comparable,
  formatArea,
  loadBest,
  nextPair,
  saveBest,
  score,
} from "./higherLower";
import { AREA_KM2, MIN_AREA_RATIO, areaOf } from "../data/areas";

beforeEach(() => localStorage.clear());

describe("the area data", () => {
  it("covers the whole map", () => {
    expect(Object.keys(AREA_KM2).length).toBeGreaterThan(170);
  });

  it("has a positive area for everything", () => {
    for (const [name, km] of Object.entries(AREA_KM2)) {
      expect(km, name).toBeGreaterThan(0);
    }
  });

  it.each([
    ["Russia", "Canada"],
    ["Canada", "India"],
    ["Brazil", "Mexico"],
    ["Algeria", "Egypt"],
    ["Australia", "Japan"],
    ["Sudan", "Kenya"],
    ["Argentina", "Chile"],
    ["Iran", "Iraq"],
    ["Sweden", "Portugal"],
    ["Kazakhstan", "Turkey"],
  ])("puts %s above %s, as the world does", (big, small) => {
    expect(areaOf(big)!).toBeGreaterThan(areaOf(small)!);
  });

  it("gets the biggest country right", () => {
    const largest = Object.entries(AREA_KM2)
      .filter(([name]) => name !== "Antarctica")
      .sort(([, a], [, b]) => b - a)[0][0];
    expect(largest).toBe("Russia");
  });

  it("keeps the order of the top few", () => {
    const top = Object.entries(AREA_KM2)
      .filter(([name]) => name !== "Antarctica" && name !== "Greenland")
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);
    // Canada, China and the USA are close enough that a simplified map can
    // shuffle them; Russia and Brazil are not in doubt.
    expect(top[0]).toBe("Russia");
    expect(top).toContain("Canada");
    expect(top).toContain("China");
    expect(top).toContain("USA");
    expect(top).toContain("Brazil");
  });
});

describe("comparable", () => {
  it("refuses a country against itself", () => {
    expect(comparable("France", "France")).toBe(false);
  });

  it("refuses two countries too close to call on a simplified map", () => {
    // Whatever the pair, anything under the ratio must be refused.
    for (const [a, b] of Object.entries(AREA_KM2).slice(0, 60).flatMap(
      ([a], i, all) => all.slice(i + 1).map(([b]) => [a, b] as [string, string])
    )) {
      const ratio =
        Math.max(areaOf(a)!, areaOf(b)!) / Math.min(areaOf(a)!, areaOf(b)!);
      if (ratio < MIN_AREA_RATIO) expect(comparable(a, b), `${a}/${b}`).toBe(false);
    }
  });

  it("accepts a pair that is clearly apart", () => {
    expect(comparable("Russia", "Belgium")).toBe(true);
  });

  it("refuses something not on the map", () => {
    expect(comparable("France", "Atlantis")).toBe(false);
  });
});

describe("bigger", () => {
  it("names the larger one", () => {
    expect(bigger("Russia", "Belgium")).toBe("Russia");
    expect(bigger("Belgium", "Russia")).toBe("Russia");
  });
});

describe("nextPair", () => {
  it("only ever offers a pair that can be told apart", () => {
    for (let i = 0; i < 200; i += 1) {
      const pair = nextPair();
      expect(pair).not.toBeNull();
      expect(comparable(pair!.left, pair!.right)).toBe(true);
      expect(pair!.left).not.toBe(pair!.right);
    }
  });

  it("keeps the named country on screen when asked to", () => {
    for (let i = 0; i < 40; i += 1) {
      const pair = nextPair(askable(), Math.random, "Japan");
      expect(pair!.left).toBe("Japan");
    }
  });

  it("gives up rather than spinning when nothing is comparable", () => {
    // Two countries of near-identical size and nothing else to choose from.
    const twins = Object.entries(AREA_KM2)
      .sort(([, a], [, b]) => a - b)
      .map(([name]) => name);
    const close = twins.filter((_, i) => i > 0 && i < 3);
    expect(nextPair(close, () => 0)).toBeNull();
  });

  it("offers only sovereign countries", () => {
    expect(askable()).not.toContain("Greenland");
    expect(askable()).not.toContain("Antarctica");
    expect(askable()).toContain("France");
  });
});

describe("score", () => {
  it("counts a run up", () => {
    let s = { streak: 0, best: 0 };
    s = score(s, true);
    s = score(s, true);
    expect(s).toEqual({ streak: 2, best: 2 });
  });

  it("resets the streak on a miss but keeps the best", () => {
    let s = { streak: 0, best: 0 };
    s = score(s, true);
    s = score(s, true);
    s = score(s, false);
    expect(s).toEqual({ streak: 0, best: 2 });
  });
});

describe("the saved best", () => {
  it("comes back", () => {
    saveBest(7);
    expect(loadBest()).toBe(7);
  });

  it("starts at nothing", () => {
    expect(loadBest()).toBe(0);
  });

  it("ignores a corrupt value", () => {
    localStorage.setItem("worldguess.higherlower.v1", "{not json");
    expect(loadBest()).toBe(0);
  });

  it("ignores a nonsense value", () => {
    localStorage.setItem("worldguess.higherlower.v1", '"lots"');
    expect(loadBest()).toBe(0);
  });
});

describe("formatArea", () => {
  it.each([
    [17098246, "17.10M km²"],
    [1249853, "1.25M km²"],
    [551695, "552,000 km²"],
    [30528, "31,000 km²"],
    [2586, "2,586 km²"],
  ])("reads %s as %s", (km, expected) => {
    expect(formatArea(km)).toBe(expected);
  });
});
