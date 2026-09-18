import { describe, expect, it } from "vitest";
import {
  GLOBE_THEMES,
  answerStroke,
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

const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lin(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

describe("a border that reads on a filled-in answer", () => {
  /**
   * The bug: one pale stroke chosen against dark unanswered land, reused on
   * every country. Measured, it clears 3 comfortably on unanswered land — 3.1
   * to 5.8 across the palettes — and lands at 1.06 on Emerald's found green,
   * 1.10 on Mono, 1.13 on Atlantic. A ratio of 1.06 is not a faint line, it is
   * no line.
   */
  it("separates from every answer colour in every palette", () => {
    const weak: string[] = [];
    for (const theme of GLOBE_THEMES) {
      for (const key of ["found", "missed", "selected"] as const) {
        const fill = theme.palette[key];
        const ratio = contrast(answerStroke(fill), fill);
        if (ratio < 3) weak.push(`${theme.id}.${key} = ${ratio.toFixed(2)}`);
      }
    }
    expect(weak).toEqual([]);
  });

  // The whole point of deriving it rather than picking a second colour by eye:
  // a palette added later is covered without anyone remembering to check.
  it("holds for a colour no palette uses", () => {
    for (const fill of ["#ffffff", "#000000", "#4ade80", "#fde047", "#1a1a1a"]) {
      expect(contrast(answerStroke(fill), fill)).toBeGreaterThanOrEqual(3);
    }
  });

  it("is a shade of the country it outlines, not a colour of its own", () => {
    // Darker than the fill in every channel, so the border reads as the same
    // country rather than a stripe of something else laid over it. Only where
    // darkening works — on near-black land it has to go the other way.
    const fill = "#4ade80";
    const stroke = answerStroke(fill);
    const channels = (hex: string) =>
      [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    const [fr, fg, fb] = channels(fill);
    const [sr, sg, sb] = channels(stroke);
    expect(sr).toBeLessThanOrEqual(fr);
    expect(sg).toBeLessThanOrEqual(fg);
    expect(sb).toBeLessThanOrEqual(fb);
  });
});
