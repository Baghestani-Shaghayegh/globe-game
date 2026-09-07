import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLAG_CODE, flagUrl } from "./flags";

const names: string[] = JSON.parse(
  readFileSync("public/data/world.geojson", "utf8")
).features.map((f: { properties: { name: string } }) => f.properties.name);

/** The only two features without a flag, both unrecognised states. */
const WITHOUT_FLAGS = ["Northern Cyprus", "Somaliland"];

describe("flag data", () => {
  it("covers every country on the map except the unrecognised ones", () => {
    const missing = names.filter((n) => !FLAG_CODE[n]);
    expect(missing.sort()).toEqual(WITHOUT_FLAGS);
  });

  it("has no codes for names the map doesn't contain", () => {
    const known = new Set(names);
    expect(Object.keys(FLAG_CODE).filter((n) => !known.has(n))).toEqual([]);
  });

  it("gives each country its own code", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [name, code] of Object.entries(FLAG_CODE)) {
      if (seen.has(code)) clashes.push(`${name} and ${seen.get(code)} share ${code}`);
      seen.set(code, name);
    }
    expect(clashes).toEqual([]);
  });

  it("uses well-formed two-letter codes", () => {
    const malformed = Object.entries(FLAG_CODE)
      .filter(([, code]) => !/^[a-z]{2}$/.test(code))
      .map(([name]) => name);
    expect(malformed).toEqual([]);
  });

  // A missing file would render as a broken image mid-round.
  it("has a flag file on disk for every code", () => {
    const absent = Object.entries(FLAG_CODE)
      .filter(([, code]) => !existsSync(`public/flags/${code}.svg`))
      .map(([name]) => name);
    expect(absent).toEqual([]);
  });

  it("builds a url, or null when there is no flag", () => {
    expect(flagUrl("France")).toBe("/flags/fr.svg");
    expect(flagUrl("Somaliland")).toBeNull();
  });
});
