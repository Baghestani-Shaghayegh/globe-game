import { describe, expect, it } from "vitest";
import { CAPITALS, capitalOf, capitalsFor } from "./capitals";
import { getCountryMeta } from "./countries";
import { readFileSync } from "node:fs";

// Read from disk rather than imported: the map is data, not a module, and the
// point of these tests is that the two files agree with each other.
const FEATURES = (
  JSON.parse(
    readFileSync(new URL("../../public/data/world.geojson", import.meta.url), "utf8")
  ) as { features: { properties: { name: string } }[] }
).features;
const SOVEREIGN = FEATURES.map((f) => f.properties.name).filter(
  (name) => getCountryMeta(name).tier === "country"
);

/** Countries the game deliberately doesn't ask a capital for. */
const NO_CAPITAL = new Set(["West Bank"]);

describe("coverage", () => {
  it("has a capital for every sovereign country the map holds", () => {
    const missing = SOVEREIGN.filter(
      (name) => !NO_CAPITAL.has(name) && !CAPITALS[name]
    );
    expect(missing).toEqual([]);
  });

  it("names no country the map doesn't have", () => {
    const known = new Set(FEATURES.map((f) => f.properties.name));
    expect(Object.keys(CAPITALS).filter((name) => !known.has(name))).toEqual([]);
  });

  it("covers essentially the whole world", () => {
    expect(Object.keys(CAPITALS).length).toBeGreaterThanOrEqual(SOVEREIGN.length - 2);
  });
});

describe("the entries themselves", () => {
  it("gives every country at least one capital", () => {
    for (const [name, capitals] of Object.entries(CAPITALS)) {
      expect(capitals.length, name).toBeGreaterThan(0);
      for (const capital of capitals) expect(capital.trim()).not.toBe("");
    }
  });

  it("lists no duplicates within a country", () => {
    for (const [name, capitals] of Object.entries(CAPITALS)) {
      expect(new Set(capitals).size, name).toBe(capitals.length);
    }
  });

  it("never repeats a primary capital across two countries", () => {
    const primaries = Object.values(CAPITALS).map((c) => c[0]);
    const seen = new Set<string>();
    const repeated = primaries.filter((c) => (seen.has(c) ? true : (seen.add(c), false)));
    expect(repeated).toEqual([]);
  });
});

describe("the ones that are easy to get wrong", () => {
  it.each([
    ["Australia", "Canberra"],
    ["Brazil", "Brasilia"],
    ["Canada", "Ottawa"],
    ["Turkey", "Ankara"],
    ["Nigeria", "Abuja"],
    ["Myanmar", "Naypyidaw"],
    ["Kazakhstan", "Astana"],
    ["Switzerland", "Bern"],
    ["USA", "Washington, D.C."],
    ["New Zealand", "Wellington"],
  ])("%s is %s, not its largest city", (country, capital) => {
    expect(capitalOf(country)).toBe(capital);
  });

  it("keeps South Africa's three", () => {
    expect(capitalsFor("South Africa")).toEqual([
      "Pretoria",
      "Cape Town",
      "Bloemfontein",
    ]);
  });

  it("accepts either of Bolivia's", () => {
    expect(capitalsFor("Bolivia")).toContain("Sucre");
    expect(capitalsFor("Bolivia")).toContain("La Paz");
  });

  it("accepts The Hague as well as Amsterdam", () => {
    expect(capitalsFor("Netherlands")).toContain("The Hague");
  });

  it("accepts the old name where a country has recently changed it", () => {
    expect(capitalsFor("Kazakhstan")).toContain("Nur-Sultan");
    expect(capitalsFor("Ukraine")).toContain("Kiev");
    expect(capitalsFor("Burundi")).toContain("Bujumbura");
  });

  it("accepts an unaccented spelling wherever there is an accent", () => {
    for (const [name, capitals] of Object.entries(CAPITALS)) {
      const accented = capitals.find((c) => /[À-ÿ]/.test(c));
      if (!accented) continue;
      const plain = accented.normalize("NFD").replace(/[̀-ͯ]/g, "");
      expect(capitals, name).toContain(plain);
    }
  });
});

describe("lookups", () => {
  it("returns null for a country with no capital on file", () => {
    expect(capitalOf("West Bank")).toBeNull();
    expect(capitalOf("Atlantis")).toBeNull();
  });

  it("returns an empty list rather than undefined", () => {
    expect(capitalsFor("Atlantis")).toEqual([]);
  });
});
