import { describe, expect, it } from "vitest";
import { landTones } from "./globeTerrain";
import { GLOBE_THEMES, setGlobeTheme, theme } from "./globeTheme";

/**
 * Every country in a round is now painted through `landTones` — the land it
 * sits on and the colours that mean something both go through the same
 * lighting. The risk that buys is that a "found" country on the shadowed limb
 * dims towards the plain land on the sunlit side, and a player loses a round
 * to a trick of the light.
 */

/**
 * Distance between two colours, measured where the eye meets them.
 *
 * A THREE.Color holds linear light, and comparing those directly understates
 * the difference badly — found on the dark limb against sunlit land reads as
 * 20 channels apart in linear and 50 on screen. `getHexString` is the
 * conversion back to sRGB, which is what the shader writes out and what the
 * player actually sees.
 */
const channels = (c: { getHexString: () => string }) => {
  const hex = c.getHexString();
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
};

const apart = (a: { getHexString: () => string }, b: { getHexString: () => string }) => {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
};

describe("land under the light", () => {
  // The cruellest case on screen: an answer on the shadowed limb against
  // unclaimed land square under the sun. Lighting the answers too, this came
  // out at 21 channels on Emerald and 27 on Atlantic — which is what made
  // them flat.
  it("keeps every answer clear of the land, at the worst pairing", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      const land = landTones(theme.unfound);
      for (const answer of [theme.found, theme.missed, theme.selected]) {
        const flat = landTones(answer, "answer");
        expect(apart(flat.shadow, land.highlight)).toBeGreaterThan(40);
        expect(apart(flat.highlight, land.shadow)).toBeGreaterThan(40);
      }
    }
  });

  it("keeps found and missed clear of each other", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      expect(
        apart(landTones(theme.found, "answer").base, landTones(theme.missed, "answer").base)
      ).toBeGreaterThan(40);
    }
  });

  // Flat means flat: an answer must read the same wherever it falls on the
  // sphere, or the player is reading the light instead of the round.
  it("does not shade an answer at all", () => {
    for (const palette of GLOBE_THEMES) {
      setGlobeTheme(palette.id);
      const { shadow, base, highlight } = landTones(theme.found, "answer");
      expect(apart(shadow, base)).toBe(0);
      expect(apart(highlight, base)).toBe(0);
    }
  });

  it("does shade the land — shadow under highlight", () => {
    setGlobeTheme("meridian");
    for (const colour of [theme.unfound, theme.idle]) {
      const { shadow, highlight } = landTones(colour);
      expect(channels(shadow)[1]).toBeLessThan(channels(highlight)[1]);
    }
  });

  // Ice is the one colour tinted by scaling rather than by the land's ramp,
  // because a pale grey run through a teal ramp comes out teal.
  it("keeps ice pale, and paler than the land it sits in", () => {
    setGlobeTheme("meridian");
    const ice = landTones("#b3c1d2", "ice");
    expect(channels(ice.highlight)[1]).toBeGreaterThan(
      channels(landTones(theme.unfound).highlight)[1]
    );
    expect(channels(ice.shadow)[1]).toBeGreaterThan(40);
  });
});
