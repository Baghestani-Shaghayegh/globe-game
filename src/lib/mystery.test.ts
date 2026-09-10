import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_SCALE_KM,
  arrowFor,
  bearing,
  closeness,
  distanceKm,
  heat,
  heatColor,
  heatSquare,
  loadMystery,
  mysteryFor,
  saveMystery,
  scoreFor,
  shareText,
  type MysteryResult,
} from "./mystery";

beforeEach(() => localStorage.clear());

// Real places, so the numbers can be checked against the world rather than
// against my own arithmetic.
const LONDON = { lat: 51.5074, lng: -0.1278 };
const PARIS = { lat: 48.8566, lng: 2.3522 };
const NEW_YORK = { lat: 40.7128, lng: -74.006 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const TOKYO = { lat: 35.6762, lng: 139.6503 };
const NORTH_POLE = { lat: 90, lng: 0 };
const SOUTH_POLE = { lat: -90, lng: 0 };

describe("distanceKm", () => {
  it.each([
    ["London → Paris", LONDON, PARIS, 344, 10],
    ["London → New York", LONDON, NEW_YORK, 5570, 40],
    ["London → Sydney", LONDON, SYDNEY, 16992, 80],
    ["Tokyo → Sydney", TOKYO, SYDNEY, 7823, 60],
  ])("%s is about %s km", (_label, a, b, expected, tolerance) => {
    expect(distanceKm(a, b)).toBeGreaterThan(expected - tolerance);
    expect(distanceKm(a, b)).toBeLessThan(expected + tolerance);
  });

  it("is zero from a place to itself", () => {
    expect(distanceKm(LONDON, LONDON)).toBe(0);
  });

  it("is the same in both directions", () => {
    expect(distanceKm(LONDON, TOKYO)).toBeCloseTo(distanceKm(TOKYO, LONDON), 6);
  });

  it("gets the long way round right — pole to pole is half the circumference", () => {
    expect(distanceKm(NORTH_POLE, SOUTH_POLE)).toBeCloseTo(20015, 0);
  });

  it("measures across the date line the short way, not around the world", () => {
    // 179°E to 179°W is two degrees apart, not 358.
    const near = distanceKm({ lat: 0, lng: 179 }, { lat: 0, lng: -179 });
    expect(near).toBeLessThan(250);
  });
});

describe("bearing and arrows", () => {
  it("points north when the target is due north", () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 10, lng: 0 })).toBeCloseTo(0, 5);
    expect(arrowFor({ lat: 0, lng: 0 }, { lat: 10, lng: 0 })).toBe("↑");
  });

  it("points east when the target is due east", () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 10 })).toBeCloseTo(90, 5);
    expect(arrowFor({ lat: 0, lng: 0 }, { lat: 0, lng: 10 })).toBe("→");
  });

  it.each([
    [{ lat: -10, lng: 0 }, "↓"],
    [{ lat: 0, lng: -10 }, "←"],
    [{ lat: 10, lng: 10 }, "↗"],
    [{ lat: -10, lng: -10 }, "↙"],
  ])("points %s", (target, arrow) => {
    expect(arrowFor({ lat: 0, lng: 0 }, target)).toBe(arrow);
  });

  it("always returns a bearing on the compass", () => {
    for (const to of [PARIS, NEW_YORK, SYDNEY, TOKYO]) {
      const deg = bearing(LONDON, to);
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThan(360);
    }
  });
});

describe("heat", () => {
  it("is 0 on the answer and 1 at the far end", () => {
    expect(heat(0)).toBe(0);
    expect(heat(MAX_SCALE_KM)).toBe(1);
  });

  it("never leaves 0–1, however far apart two places are", () => {
    for (const km of [-5, 0, 500, MAX_SCALE_KM, 20015]) {
      expect(heat(km)).toBeGreaterThanOrEqual(0);
      expect(heat(km)).toBeLessThanOrEqual(1);
    }
  });

  it("rises with distance", () => {
    expect(heat(500)).toBeLessThan(heat(2000));
    expect(heat(2000)).toBeLessThan(heat(9000));
  });
});

describe("closeness", () => {
  it("is 100% on the answer", () => {
    expect(closeness(0)).toBe(100);
  });

  it("is 0% at the far end", () => {
    expect(closeness(MAX_SCALE_KM)).toBe(0);
    expect(closeness(19_000)).toBe(0);
  });

  it("falls as the guess gets further away", () => {
    expect(closeness(344)).toBeGreaterThan(closeness(5570));
  });
});

describe("heatColor", () => {
  it("is red on the doorstep and navy a world away", () => {
    expect(heatColor(0)).toBe("#dc2626");
    expect(heatColor(MAX_SCALE_KM)).toBe("#1e3a8a");
  });

  it("returns a valid colour at every distance", () => {
    for (let km = 0; km <= 20000; km += 137) {
      expect(heatColor(km)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("never lands on green, which already means 'found' on this globe", () => {
    for (let km = 0; km <= 20000; km += 53) {
      const [r, g, b] = [1, 3, 5].map((i) =>
        parseInt(heatColor(km).slice(i, i + 2), 16)
      );
      // Green here would mean g clearly dominating both other channels.
      expect(g > r + 25 && g > b + 25).toBe(false);
    }
  });

  it("changes as the guess gets warmer, so the ramp reads as a gradient", () => {
    const near = heatColor(200);
    const middling = heatColor(4000);
    const far = heatColor(9500);
    expect(new Set([near, middling, far]).size).toBe(3);
  });
});

describe("heatSquare", () => {
  it("marks the answer green and the far side black", () => {
    expect(heatSquare(0)).toBe("🟩");
    expect(heatSquare(19_000)).toBe("⬛");
  });

  it("warms up as the guess closes in", () => {
    expect(heatSquare(500)).toBe("🟥");
    expect(heatSquare(2000)).toBe("🟧");
    expect(heatSquare(4000)).toBe("🟨");
    expect(heatSquare(6000)).toBe("🟦");
  });
});

describe("mysteryFor", () => {
  it("gives everyone the same country on the same day", () => {
    const pool = ["France", "Peru", "Chad", "Mali", "Japan"];
    expect(mysteryFor("2026-09-10", pool)).toBe(mysteryFor("2026-09-10", pool));
  });

  it("changes from day to day", () => {
    const pool = Array.from({ length: 60 }, (_, i) => `Country ${i}`);
    const week = ["10", "11", "12", "13", "14", "15", "16"].map((d) =>
      mysteryFor(`2026-09-${d}`, pool)
    );
    expect(new Set(week).size).toBeGreaterThan(4);
  });

  it("always picks from the pool it was given", () => {
    const pool = ["France", "Peru", "Chad"];
    for (const day of ["2026-09-10", "2026-10-01", "2027-01-01"]) {
      expect(pool).toContain(mysteryFor(day, pool));
    }
  });

  it("is not simply the first country of that day's ordinary round", () => {
    // Different salt, so the two dailies don't give the game away.
    const pool = Array.from({ length: 60 }, (_, i) => `Country ${i}`);
    const differs = ["2026-09-10", "2026-09-11", "2026-09-12"].filter(
      (day) => mysteryFor(day, pool) !== pool[0]
    );
    expect(differs.length).toBe(3);
  });

  it("copes with an empty pool", () => {
    expect(mysteryFor("2026-09-10", [])).toBeNull();
  });
});

describe("scoring", () => {
  const result = (over: Partial<MysteryResult> = {}): MysteryResult => ({
    day: "2026-09-10",
    number: 252,
    answer: "Chad",
    guesses: [{ name: "Chad", km: 0 }],
    solved: true,
    ...over,
  });

  it("pays most for finding it first go", () => {
    expect(scoreFor(result())).toBe(1000);
  });

  it("costs something for each extra guess", () => {
    const five = result({
      guesses: Array.from({ length: 5 }, () => ({ name: "x", km: 100 })),
    });
    expect(scoreFor(five)).toBe(1000 - 4 * 75);
  });

  it("never drops below a floor, however long it took", () => {
    const many = result({
      guesses: Array.from({ length: 80 }, () => ({ name: "x", km: 100 })),
    });
    expect(scoreFor(many)).toBe(100);
  });

  it("pays nothing for a round that was never solved", () => {
    expect(scoreFor(result({ solved: false }))).toBe(0);
  });
});

describe("the saved round", () => {
  const result: MysteryResult = {
    day: "2026-09-10",
    number: 252,
    answer: "Chad",
    guesses: [{ name: "Mali", km: 1800 }],
    solved: false,
  };

  it("comes back on the same day", () => {
    saveMystery(result);
    expect(loadMystery("2026-09-10")).toEqual(result);
  });

  it("is ignored on a different day, so tomorrow starts clean", () => {
    saveMystery(result);
    expect(loadMystery("2026-09-11")).toBeNull();
  });

  it("starts fresh on a corrupt store", () => {
    localStorage.setItem("worldguess.mystery.v1", "{not json");
    expect(loadMystery("2026-09-10")).toBeNull();
  });
});

describe("shareText", () => {
  it("shows a square per guess and the count", () => {
    const text = shareText({
      day: "2026-09-10",
      number: 252,
      answer: "Chad",
      guesses: [
        { name: "Peru", km: 9000 },
        { name: "Mali", km: 1800 },
        { name: "Chad", km: 0 },
      ],
      solved: true,
    });
    expect(text).toContain("Mystery #252");
    expect(text).toContain("3 guesses");
    expect(text).toContain("⬛🟧🟩");
  });

  it("marks an unsolved round with an X rather than a number", () => {
    const text = shareText({
      day: "2026-09-10",
      number: 252,
      answer: "Chad",
      guesses: [{ name: "Peru", km: 9000 }],
      solved: false,
    });
    expect(text).toContain("X guesses");
  });
});
