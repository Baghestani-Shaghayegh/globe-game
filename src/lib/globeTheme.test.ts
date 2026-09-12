import { describe, expect, it } from "vitest";
import {
  GLOBE_THEMES,
  backdropColor,
  landShade,
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

/** A spread of real country names, so the shades are measured on the map the
 *  game actually draws rather than on made-up strings. */
const NAMES = [
  "France", "Germany", "Spain", "Italy", "Poland", "Norway", "Greece",
  "Brazil", "Peru", "Chile", "Kenya", "Egypt", "India", "Japan",
  "Canada", "Mexico", "Australia", "Iceland", "Nepal", "Oman",
];

/** Distance between two colours, in plain channel terms. */
const apart = (a: string, b: string) =>
  [1, 3, 5].reduce(
    (worst, at) =>
      Math.max(
        worst,
        Math.abs(
          parseInt(a.slice(at, at + 2), 16) - parseInt(b.slice(at, at + 2), 16)
        )
      ),
    0
  );

describe("land shading", () => {
  it("gives the same country the same shade every time", () => {
    setGlobeTheme("meridian");
    for (const name of NAMES) expect(landShade(name)).toBe(landShade(name));
  });

  it("actually varies — the map is not one flat fill", () => {
    setGlobeTheme("meridian");
    const shades = new Set(NAMES.map((name) => landShade(name)));
    expect(shades.size).toBeGreaterThan(3);
  });

  it("is a real six-digit colour, in every palette", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      for (const name of NAMES) {
        expect(landShade(name)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  // The whole point of the shading is that it stays decoration. Land that
  // drifted near "found" or "missed" would cost someone the round, which is a
  // far worse bug than a map that looks flat.
  it("never comes near a colour that means something", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      for (const name of NAMES) {
        const shade = landShade(name);
        expect(apart(shade, theme.found)).toBeGreaterThan(40);
        expect(apart(shade, theme.missed)).toBeGreaterThan(40);
        expect(apart(shade, theme.selected)).toBeGreaterThan(40);
      }
    }
  });

  it("stays a shade of the land rather than wandering off it", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      for (const name of NAMES) {
        expect(apart(landShade(name), theme.unfound)).toBeLessThanOrEqual(40);
      }
    }
  });

  // A country painted the sea's colour would read as ocean, which is the
  // mistake the Connect backdrop already made once.
  it("never lands on the sea's own colour", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      for (const name of NAMES) {
        expect(landShade(name)).not.toBe(theme.sphere);
        expect(apart(landShade(name), theme.sphere)).toBeGreaterThan(8);
      }
    }
  });

  it("follows a palette change", () => {
    setGlobeTheme("meridian");
    const before = NAMES.map((name) => landShade(name));
    setGlobeTheme("ember");
    const after = NAMES.map((name) => landShade(name));
    expect(after).not.toEqual(before);
  });
});
