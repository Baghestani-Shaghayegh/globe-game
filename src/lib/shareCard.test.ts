import { describe, expect, it } from "vitest";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  TILE_BAND_HEIGHT,
  tileLayout,
} from "./shareCard";

describe("card shape", () => {
  it("is the portrait Instagram prefers", () => {
    expect(CARD_WIDTH / CARD_HEIGHT).toBeCloseTo(4 / 5, 3);
  });
});

describe("tileLayout", () => {
  const MAX = CARD_WIDTH - 180;

  it("puts a daily round's ten squares on one line", () => {
    const { perRow, rows } = tileLayout(10, MAX);
    expect(perRow).toBe(10);
    expect(rows).toBe(1);
  });

  it("wraps once there are too many to read", () => {
    const { rows } = tileLayout(30, MAX);
    expect(rows).toBeGreaterThan(1);
  });

  it("never draws a tile too small to see", () => {
    for (const count of [1, 5, 10, 12, 20, 30, 50]) {
      expect(tileLayout(count, MAX).size).toBeGreaterThanOrEqual(24);
    }
  });

  it("never lets a row run off the card", () => {
    for (const count of [1, 3, 10, 12, 25, 40, 60]) {
      const { perRow, size, gap } = tileLayout(count, MAX);
      expect(perRow * size + (perRow - 1) * gap).toBeLessThanOrEqual(MAX);
    }
  });

  it("caps how big a single tile gets, so one guess isn't a billboard", () => {
    expect(tileLayout(1, MAX).size).toBeLessThanOrEqual(96);
  });

  it("has enough rows for every tile", () => {
    for (const count of [1, 7, 13, 29, 55]) {
      const { perRow, rows } = tileLayout(count, MAX);
      expect(perRow * rows).toBeGreaterThanOrEqual(count);
    }
  });

  it("draws nothing for nothing", () => {
    expect(tileLayout(0, MAX)).toEqual({
      perRow: 0,
      size: 0,
      gap: 0,
      rows: 0,
      height: 0,
    });
  });

  it("keeps the whole block inside its band, however many tiles there are", () => {
    for (const count of [1, 10, 28, 50, 90]) {
      expect(tileLayout(count, MAX).height).toBeLessThanOrEqual(TILE_BAND_HEIGHT);
    }
  });

  it("shrinks the tiles rather than overflowing when the rows pile up", () => {
    expect(tileLayout(90, MAX).size).toBeLessThan(tileLayout(10, MAX).size);
  });
});
