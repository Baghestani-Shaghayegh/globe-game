import { describe, expect, it } from "vitest";
import { VIEW, outlinePath } from "./outline";
import type { Geometry } from "./geo";

const square: Geometry = {
  type: "Polygon",
  coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
};

const wide: Geometry = {
  type: "Polygon",
  coordinates: [[[0, 0], [40, 0], [40, 5], [0, 5], [0, 0]]],
};

const twoIslands: Geometry = {
  type: "MultiPolygon",
  coordinates: [
    [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]],
    [[[20, 0], [25, 0], [25, 5], [20, 5], [20, 0]]],
  ],
};

/** Every coordinate the path visits. */
function points(path: string): [number, number][] {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(
    (m) => [Number(m[1]), Number(m[2])] as [number, number]
  );
}

describe("outlinePath", () => {
  it("draws a closed path", () => {
    const path = outlinePath(square);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("keeps every point inside the box", () => {
    for (const geometry of [square, wide, twoIslands]) {
      for (const [x, y] of points(outlinePath(geometry))) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(VIEW);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(VIEW);
      }
    }
  });

  it("fills the box in its longest direction", () => {
    const xs = points(outlinePath(wide)).map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(VIEW - 20);
  });

  it("keeps a wide country wide, rather than stretching it square", () => {
    const p = points(outlinePath(wide));
    const width = Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
    const height = Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]));
    expect(width).toBeGreaterThan(height * 3);
  });

  it("centres the shape rather than pinning it to a corner", () => {
    const p = points(outlinePath(wide));
    const top = Math.min(...p.map((q) => q[1]));
    const bottom = VIEW - Math.max(...p.map((q) => q[1]));
    expect(Math.abs(top - bottom)).toBeLessThan(1);
  });

  it("draws every island, because a scattered country is its islands", () => {
    const path = outlinePath(twoIslands);
    expect(path.match(/M/g)).toHaveLength(2);
  });

  it("puts the shape the right way up — north at the top", () => {
    // A triangle with its apex north; after projection the apex must be the
    // smallest y, since SVG counts downwards.
    const spike: Geometry = {
      type: "Polygon",
      coordinates: [[[0, 0], [10, 0], [5, 20], [0, 0]]],
    };
    const p = points(outlinePath(spike));
    const apex = p.reduce((a, b) => (b[1] < a[1] ? b : a));
    expect(apex[0]).toBeCloseTo(VIEW / 2, 0);
  });

  it("squeezes longitude by latitude, so far-north countries aren't stretched", () => {
    const equator: Geometry = {
      type: "Polygon",
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    };
    const arctic: Geometry = {
      type: "Polygon",
      coordinates: [[[0, 70], [10, 70], [10, 80], [0, 80], [0, 70]]],
    };
    const ratio = (g: Geometry) => {
      const p = points(outlinePath(g));
      const w = Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
      const h = Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]));
      return w / h;
    };
    // Ten degrees of longitude is far narrower near the pole than at the
    // equator, so the arctic box must come out taller than it is wide.
    expect(ratio(arctic)).toBeLessThan(ratio(equator));
  });

  it("drops slivers too small to see", () => {
    const withSpeck: Geometry = {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
        [[[50, 50], [50.01, 50], [50.01, 50.01], [50, 50.01], [50, 50]]],
      ],
    };
    expect(outlinePath(withSpeck).match(/M/g)).toHaveLength(1);
  });

  it("has nothing to draw for empty geometry", () => {
    expect(outlinePath({ type: "Polygon", coordinates: [] })).toBe("");
  });

  it("ignores a degenerate ring rather than dividing by zero", () => {
    const degenerate: Geometry = {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
        [[[5, 5], [5, 5]]],
      ],
    };
    expect(outlinePath(degenerate)).not.toContain("NaN");
  });

  it("never emits NaN for any real country", () => {
    const path = outlinePath(square);
    expect(path).not.toContain("NaN");
    expect(path).not.toContain("Infinity");
  });
});
