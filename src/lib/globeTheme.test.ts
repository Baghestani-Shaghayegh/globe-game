import { describe, expect, it } from "vitest";
import {
  GLOBE_THEMES,
  backdropColor,
  setGlobeTheme,
  theme,
} from "./globeTheme";

/** Rough perceived lightness, enough to order three shades of the same hue. */
const lightness = (hex: string) =>
  [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0);

describe("backdrop colour", () => {
  // The two mistakes this has to avoid, both made once already: painted the
  // sea's own colour the land vanishes and the globe is a featureless ball;
  // painted as bright as a target, land nobody can act on competes with land
  // they can.
  it("sits between the sea and a country in play, in every palette", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      const backdrop = lightness(backdropColor());
      expect(backdrop).toBeGreaterThan(lightness(theme.sphere));
      expect(backdrop).toBeLessThan(lightness(theme.unfound));
    }
  });

  it("is never the sea's own colour", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      expect(backdropColor()).not.toBe(theme.sphere);
    }
  });

  it("is a real six-digit colour", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      expect(backdropColor()).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("follows a palette change", () => {
    setGlobeTheme(GLOBE_THEMES[0].id);
    const first = backdropColor();
    const other = GLOBE_THEMES.find((t) => t.palette.sphere !== theme.sphere);
    if (!other) return;
    setGlobeTheme(other.id);
    expect(backdropColor()).not.toBe(first);
  });
});
