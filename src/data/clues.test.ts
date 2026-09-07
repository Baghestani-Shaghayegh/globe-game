import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLUES, cluesFor } from "./clues";
import { getCountryMeta } from "./countries";
import { MODES } from "./modes";

const names: string[] = JSON.parse(
  readFileSync("public/data/world.geojson", "utf8")
).features.map((f: { properties: { name: string } }) => f.properties.name);

describe("clue data", () => {
  it("only names countries that are on the map", () => {
    const known = new Set(names);
    expect(Object.keys(CLUES).filter((n) => !known.has(n))).toEqual([]);
  });

  it("gives every listed country at least two clues", () => {
    const thin = Object.entries(CLUES)
      .filter(([, clues]) => clues.length < 2)
      .map(([name]) => name);
    expect(thin).toEqual([]);
  });

  // A clue that fits two countries has no right answer.
  it("uses no clue for more than one country", () => {
    const owners = new Map<string, string[]>();
    for (const [name, clues] of Object.entries(CLUES)) {
      for (const clue of clues) {
        owners.set(clue, [...(owners.get(clue) ?? []), name]);
      }
    }
    const shared = [...owners.entries()]
      .filter(([, who]) => who.length > 1)
      .map(([clue, who]) => `${clue} → ${who.join(", ")}`);
    expect(shared).toEqual([]);
  });

  it("repeats no clue within one country", () => {
    const repeated = Object.entries(CLUES)
      .filter(([, clues]) => new Set(clues).size !== clues.length)
      .map(([name]) => name);
    expect(repeated).toEqual([]);
  });

  it("never gives the answer away in the clue", () => {
    const leaks: string[] = [];
    for (const [geoName, clues] of Object.entries(CLUES)) {
      const meta = getCountryMeta(geoName);
      for (const clue of clues) {
        const haystack = clue.toLowerCase();
        for (const answer of [meta.displayName, meta.geoName]) {
          if (haystack.includes(answer.toLowerCase())) {
            leaks.push(`${geoName}: "${clue}"`);
          }
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("covers every sovereign country on the map", () => {
    const uncovered = names
      .map(getCountryMeta)
      .filter((meta) => meta.tier === "country")
      .filter((meta) => cluesFor(meta.geoName).length === 0)
      .map((meta) => meta.geoName);
    expect(uncovered).toEqual([]);
  });

  it("leaves every mode with something to ask for", () => {
    const withClues = names
      .map(getCountryMeta)
      .filter((meta) => cluesFor(meta.geoName).length > 0);
    for (const mode of MODES) {
      expect({
        mode: mode.id,
        count: withClues.filter((m) => mode.includes(m)).length,
      }).toMatchObject({ mode: mode.id, count: expect.any(Number) });
      expect(
        withClues.filter((m) => mode.includes(m)).length
      ).toBeGreaterThan(2);
    }
  });
});
