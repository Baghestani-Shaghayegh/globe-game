import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTINENT_OF, type Continent } from "./continents";
import { getCountryMeta } from "./countries";
import { MODES } from "./modes";

type Feature = { properties: { name: string } };

const featureNames: string[] = (
  JSON.parse(
    readFileSync("public/data/world.geojson", "utf8")
  ) as { features: Feature[] }
).features.map((f) => f.properties.name);

describe("continent data covers the map", () => {
  it("maps every feature in world.geojson", () => {
    const unmapped = featureNames.filter((name) => !CONTINENT_OF[name]);
    expect(unmapped).toEqual([]);
  });

  it("has no entries the map doesn't contain", () => {
    const known = new Set(featureNames);
    expect(Object.keys(CONTINENT_OF).filter((n) => !known.has(n))).toEqual([]);
  });

  it("gives every feature at least one continent", () => {
    const empty = Object.entries(CONTINENT_OF)
      .filter(([, continents]) => continents.length === 0)
      .map(([name]) => name);
    expect(empty).toEqual([]);
  });

  it("lists no continent twice for one country", () => {
    const duped = Object.entries(CONTINENT_OF)
      .filter(([, cs]) => new Set(cs).size !== cs.length)
      .map(([name]) => name);
    expect(duped).toEqual([]);
  });
});

describe("transcontinental countries appear in both rounds", () => {
  // Siberia fills much of the Asia view; a player who clicks it must be able
  // to answer. This is the regression that shipped once already.
  it.each([
    ["Russia", "europe", "asia"],
    ["Turkey", "europe", "asia"],
    ["Cyprus", "europe", "asia"],
    ["Georgia", "europe", "asia"],
    ["Armenia", "europe", "asia"],
    ["Azerbaijan", "europe", "asia"],
  ])("%s is in %s and %s", (name, a, b) => {
    expect(CONTINENT_OF[name]).toEqual(
      expect.arrayContaining([a as Continent, b as Continent])
    );
  });

  it("keeps Kazakhstan in Asia only, on purpose", () => {
    expect(CONTINENT_OF.Kazakhstan).toEqual(["asia"]);
  });
});

describe("mode membership", () => {
  const metas = featureNames.map(getCountryMeta);
  const countOf = (id: string) =>
    metas.filter((m) => MODES.find((mode) => mode.id === id)!.includes(m))
      .length;

  it("asks for the expected number of places", () => {
    expect({
      easy: countOf("easy"),
      hard: countOf("hard"),
      europe: countOf("europe"),
      africa: countOf("africa"),
      asia: countOf("asia"),
      americas: countOf("americas"),
      oceania: countOf("oceania"),
    }).toEqual({
      easy: 167,
      hard: 177,
      europe: 43,
      africa: 49,
      asia: 47,
      americas: 28,
      oceania: 6,
    });
  });

  it("keeps territories out of every continent round", () => {
    const regional = MODES.filter((m) => m.regional);
    const leaked = metas
      .filter((m) => m.tier === "territory")
      .filter((m) => regional.some((mode) => mode.includes(m)))
      .map((m) => m.geoName);
    expect(leaked).toEqual([]);
  });

  it("covers every playable country across the five regions", () => {
    const regional = MODES.filter((m) => m.regional);
    const orphaned = metas
      .filter((m) => m.tier === "country")
      .filter((m) => !regional.some((mode) => mode.includes(m)))
      .map((m) => m.geoName);
    expect(orphaned).toEqual([]);
  });
});
