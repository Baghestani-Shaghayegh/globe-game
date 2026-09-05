import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { altitudeFor, featureCentre, type Geometry } from "./geo";

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
    ["Japan", 36.2, 135.7],
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
