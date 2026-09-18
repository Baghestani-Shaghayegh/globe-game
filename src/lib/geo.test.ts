import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { altitudeFor, featureCentre, type Geometry, ROUND_FOV, worldAltitude } from "./geo";

type Feature = { properties: { name: string }; geometry: Geometry };

const features: Feature[] = JSON.parse(
  readFileSync("public/data/world.geojson", "utf8")
).features;

const centreOf = (name: string) =>
  featureCentre(features.find((f) => f.properties.name === name)!.geometry);

describe("featureCentre", () => {
  // Averaging every ring would put France in the Atlantic and the USA in the
  // Pacific, dragged out by overseas territories and Alaska.
  it.each([
    ["France", 46.7, 1.8],
    ["USA", 37.2, -95.8],
    // Moved from 36.2/135.7 with the 1:10m map: Honshu is drawn in more
    // detail now, and its own centre sits a little north, by the Noto
    // peninsula rather than inland of Kyoto. Still Honshu.
    ["Japan", 37.5, 136.5],
    ["Chile", -35.7, -71.3],
    ["Australia", -24.9, 133.5],
    ["Egypt", 26.8, 30.8],
    ["Iceland", 65.0, -19.0],
  ])("puts %s on its main landmass", (name, lat, lng) => {
    const centre = centreOf(name);
    expect(centre.lat).toBeCloseTo(lat, 0);
    expect(centre.lng).toBeCloseTo(lng, 0);
  });

  it("returns a usable point for every country on the map", () => {
    const broken = features
      .map((f) => [f.properties.name, featureCentre(f.geometry)] as const)
      .filter(
        ([, c]) =>
          !Number.isFinite(c.lat) ||
          !Number.isFinite(c.lng) ||
          Math.abs(c.lat) > 90 ||
          Math.abs(c.lng) > 180 ||
          !Number.isFinite(c.span)
      )
      .map(([name]) => name);
    expect(broken).toEqual([]);
  });

  it("reports a bigger span for a bigger country", () => {
    expect(centreOf("Russia").span).toBeGreaterThan(centreOf("France").span);
    expect(centreOf("France").span).toBeGreaterThan(
      centreOf("Luxembourg").span
    );
  });
});

describe("altitudeFor", () => {
  it("stays within the range the camera can use", () => {
    for (const span of [0, 0.5, 5, 40, 120, 1000, -5]) {
      const altitude = altitudeFor(span);
      expect(altitude).toBeGreaterThanOrEqual(0.38);
      expect(altitude).toBeLessThanOrEqual(2.2);
    }
  });

  it("pulls further back for a wider country", () => {
    expect(altitudeFor(60)).toBeGreaterThan(altitudeFor(10));
  });

  // A fixed altitude left Luxembourg as roughly fifty pixels of colour.
  it("comes in close for a tiny country", () => {
    expect(altitudeFor(centreOf("Luxembourg").span)).toBeLessThan(0.5);
  });
});

describe("how far back a round sits to show the world", () => {
  // The sphere's diameter, as a fraction of the window's shorter edge.
  const fill = (width: number, height: number) => {
    const a = worldAltitude(width, height);
    const spread = Math.tan((ROUND_FOV / 2) * (Math.PI / 180));
    const radius = (height / 2) * (1 / Math.sqrt((1 + a) ** 2 - 1)) / spread;
    return (radius * 2) / Math.min(width, height);
  };

  it("fills most of the shorter edge, whichever edge that is", () => {
    for (const [w, h] of [[1600, 1000], [1440, 900], [1366, 768], [2000, 1131]]) {
      expect(fill(w, h)).toBeCloseTo(0.88, 2);
    }
  });

  // A phone held upright: the width runs out long before the height does.
  it("stays inside a tall narrow window", () => {
    expect(fill(400, 820)).toBeCloseTo(0.88, 2);
    expect(fill(400, 820)).toBeLessThan(1);
  });

  it("brings the camera closer than the 2.1 every globe used to carry", () => {
    expect(worldAltitude(1600, 1000)).toBeLessThan(2.1);
  });

  it("never gets so close that the camera ends up inside the globe", () => {
    for (const [w, h] of [[100, 4000], [4000, 100], [1, 1]]) {
      expect(worldAltitude(w, h)).toBeGreaterThanOrEqual(0.6);
    }
  });
});
