import { beforeEach, describe, expect, it } from "vitest";
import {
  allCountries,
  byContinent,
  clearStats,
  mostMissed,
  recordRound,
  totals,
} from "./countryStats";

beforeEach(() => localStorage.clear());

describe("recordRound", () => {
  it("counts a clean answer as a first-try hit", () => {
    recordRound({ seen: ["France"], found: ["France"], fumbled: [] });
    const [row] = allCountries();
    expect(row).toMatchObject({
      geoName: "France",
      first: 1,
      fumbled: 0,
      missed: 0,
      seen: 1,
      accuracy: 100,
    });
  });

  it("separates a country got on the second try from one got outright", () => {
    recordRound({
      seen: ["France", "Peru"],
      found: ["France", "Peru"],
      fumbled: ["Peru"],
    });
    const rows = Object.fromEntries(allCountries().map((r) => [r.geoName, r]));
    expect(rows.France.first).toBe(1);
    expect(rows.Peru.fumbled).toBe(1);
    expect(rows.Peru.first).toBe(0);
    expect(rows.Peru.accuracy).toBe(0);
  });

  it("counts a country posed but never got as missed", () => {
    recordRound({ seen: ["Chad"], found: [], fumbled: [] });
    expect(allCountries()[0]).toMatchObject({ missed: 1, seen: 1 });
  });

  it("ignores countries the round never posed", () => {
    recordRound({ seen: ["France"], found: ["France"], fumbled: [] });
    expect(allCountries().map((r) => r.geoName)).toEqual(["France"]);
  });

  it("accumulates across rounds", () => {
    recordRound({ seen: ["Mali"], found: ["Mali"], fumbled: [] });
    recordRound({ seen: ["Mali"], found: [], fumbled: [] });
    recordRound({ seen: ["Mali"], found: ["Mali"], fumbled: ["Mali"] });
    expect(allCountries()[0]).toMatchObject({
      first: 1,
      fumbled: 1,
      missed: 1,
      seen: 3,
      accuracy: 33,
    });
  });

  it("counts a country listed twice in one round only once", () => {
    recordRound({ seen: ["Mali", "Mali"], found: ["Mali"], fumbled: [] });
    expect(allCountries()[0].seen).toBe(1);
  });

  it("does nothing when the round posed nothing", () => {
    recordRound({ seen: [], found: [], fumbled: [] });
    expect(allCountries()).toEqual([]);
  });

  it("uses the display name, not the map's spelling", () => {
    recordRound({ seen: ["USA"], found: ["USA"], fumbled: [] });
    expect(allCountries()[0].displayName).toBe("United States");
  });
});

describe("storage safety", () => {
  it("starts fresh on a corrupt value", () => {
    localStorage.setItem("worldguess.countries.v1", "{not json");
    expect(allCountries()).toEqual([]);
  });

  it("drops entries that aren't stats", () => {
    localStorage.setItem(
      "worldguess.countries.v1",
      JSON.stringify({ France: { first: 1, fumbled: 0, missed: 0 }, Peru: 7 })
    );
    expect(allCountries().map((r) => r.geoName)).toEqual(["France"]);
  });

  it("clears everything", () => {
    recordRound({ seen: ["France"], found: ["France"], fumbled: [] });
    clearStats();
    expect(allCountries()).toEqual([]);
  });
});

describe("totals", () => {
  it("reports nothing measured as no accuracy at all", () => {
    expect(totals().accuracy).toBeNull();
  });

  it("averages over sightings, not countries", () => {
    recordRound({ seen: ["France"], found: ["France"], fumbled: [] });
    recordRound({ seen: ["France"], found: ["France"], fumbled: [] });
    recordRound({ seen: ["Chad"], found: [], fumbled: [] });
    expect(totals()).toMatchObject({
      countries: 2,
      seen: 3,
      first: 2,
      missed: 1,
      accuracy: 67,
    });
  });
});

describe("byContinent", () => {
  it("groups countries under their continent, weakest first", () => {
    recordRound({ seen: ["France"], found: ["France"], fumbled: [] });
    recordRound({ seen: ["Chad"], found: [], fumbled: [] });
    const rows = byContinent();
    expect(rows.map((r) => r.continent)).toEqual(["africa", "europe"]);
    expect(rows[0]).toMatchObject({ accuracy: 0, countries: 1, seen: 1 });
    expect(rows[1]).toMatchObject({ accuracy: 100 });
  });

  it("counts a country that straddles two continents in both", () => {
    recordRound({ seen: ["Russia"], found: ["Russia"], fumbled: [] });
    expect(byContinent().map((r) => r.continent).sort()).toEqual([
      "asia",
      "europe",
    ]);
  });

  it("leaves out continents nothing has been asked from", () => {
    recordRound({ seen: ["France"], found: ["France"], fumbled: [] });
    expect(byContinent().map((r) => r.continent)).toEqual(["europe"]);
  });
});

describe("mostMissed", () => {
  it("leaves out countries that have never been slipped on", () => {
    recordRound({ seen: ["France"], found: ["France"], fumbled: [] });
    expect(mostMissed()).toEqual([]);
  });

  it("ranks an outright blank above a country got on the retry", () => {
    recordRound({ seen: ["Chad"], found: [], fumbled: [] });
    recordRound({ seen: ["Peru", "Mali"], found: ["Peru", "Mali"], fumbled: ["Peru", "Mali"] });
    recordRound({ seen: ["Peru"], found: ["Peru"], fumbled: ["Peru"] });
    // Chad: one miss (2). Peru: two fumbles (2), but a blank breaks the tie.
    // Mali: one fumble (1).
    expect(mostMissed().map((r) => r.geoName)).toEqual(["Chad", "Peru", "Mali"]);
  });

  it("honours the limit", () => {
    recordRound({ seen: ["Chad", "Peru", "Mali"], found: [], fumbled: [] });
    expect(mostMissed(2)).toHaveLength(2);
  });
});
