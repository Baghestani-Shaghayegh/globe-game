import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allowedSlips,
  editDistance,
  isCorrectGuess,
  nearestNames,
  normalizeAnswer,
  suggestNames,
} from "./answerMatch";
import { getCountryMeta } from "../data/countries";

describe("normalizeAnswer", () => {
  it.each([
    ["  France  ", "france"],
    ["Türkiye", "turkiye"],
    ["Côte d'Ivoire", "cote d ivoire"],
    ["GUINEA-BISSAU", "guinea bissau"],
    ["Bosnia   and\tHerzegovina", "bosnia and herzegovina"],
    ["", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected);
  });
});

describe("isCorrectGuess", () => {
  const accepts = (geoName: string, guess: string) =>
    isCorrectGuess(guess, getCountryMeta(geoName));

  it("accepts the displayed name whatever the casing or spacing", () => {
    expect(accepts("France", "france")).toBe(true);
    expect(accepts("France", "  FRANCE ")).toBe(true);
  });

  it("accepts the aliases people actually type", () => {
    expect(accepts("USA", "usa")).toBe(true);
    expect(accepts("USA", "United States")).toBe(true);
    expect(accepts("USA", "america")).toBe(true);
    expect(accepts("England", "UK")).toBe(true);
    expect(accepts("Netherlands", "Holland")).toBe(true);
    expect(accepts("Myanmar", "Burma")).toBe(true);
    expect(accepts("Czech Republic", "Czechia")).toBe(true);
  });

  it("accepts the raw map name as well as the display name", () => {
    expect(accepts("Swaziland", "Eswatini")).toBe(true);
    expect(accepts("Swaziland", "Swaziland")).toBe(true);
  });

  it("rejects a different country", () => {
    expect(accepts("France", "Germany")).toBe(false);
  });

  it("rejects an empty or whitespace answer", () => {
    expect(accepts("France", "")).toBe(false);
    expect(accepts("France", "   ")).toBe(false);
  });

  it("forgives the typos people actually make", () => {
    expect(accepts("Kyrgyzstan", "Kyrgystan")).toBe(true);
    expect(accepts("Kyrgyzstan", "Kirgyzstan")).toBe(true);
    expect(accepts("Philippines", "Philipines")).toBe(true);
    expect(accepts("Netherlands", "Netherlnds")).toBe(true);
    expect(accepts("Madagascar", "Madagascer")).toBe(true);
    expect(accepts("Switzerland", "Switzerlnad")).toBe(true);
    expect(accepts("Mozambique", "Mozambque")).toBe(true);
  });

  // A short name has no slack: one letter is the whole difference between
  // these pairs, so forgiving it would accept the wrong country.
  it.each([
    ["Chad", "Chile"],
    ["Mali", "Malta"],
    ["Iran", "Iraq"],
    ["Niger", "Nigeria"],
    ["Austria", "Australia"],
  ])("does not accept %s for %s", (a, b) => {
    expect(accepts(a, b)).toBe(false);
    expect(accepts(b, a)).toBe(false);
  });

  it("still rejects a guess that is simply a different country", () => {
    expect(accepts("France", "Spain")).toBe(false);
    expect(accepts("Japan", "Jordan")).toBe(false);
  });
});

describe("editDistance", () => {
  it.each([
    ["abc", "abc", 0],
    ["abc", "abd", 1],
    ["abc", "ab", 1],
    ["kitten", "sitting", 3],
  ])("%s vs %s is %i", (a, b, expected) => {
    expect(editDistance(a, b, 5)).toBe(expected);
  });

  it("gives up once it passes the limit", () => {
    expect(editDistance("aaaaaa", "bbbbbb", 2)).toBeGreaterThan(2);
  });
});

describe("allowedSlips", () => {
  it("gives no slack to a name that sits beside another country", () => {
    expect(allowedSlips("Ireland")).toBe(0);
    expect(allowedSlips("Iceland")).toBe(0);
    expect(allowedSlips("Zambia")).toBe(0);
    expect(allowedSlips("Gambia")).toBe(0);
    expect(allowedSlips("North Korea")).toBe(0);
  });

  it("gives none to very short names either", () => {
    expect(allowedSlips("Chad")).toBe(0);
    expect(allowedSlips("Iran")).toBe(0);
    expect(allowedSlips("Mali")).toBe(0);
  });

  it("gives room to long, isolated names", () => {
    expect(allowedSlips("Kyrgyzstan")).toBeGreaterThan(0);
    expect(allowedSlips("Madagascar")).toBeGreaterThan(0);
    expect(allowedSlips("Philippines")).toBeGreaterThan(0);
  });
});

describe("tolerance never confuses two real countries", () => {
  const names: string[] = JSON.parse(
    readFileSync("public/data/world.geojson", "utf8")
  ).features.map((f: { properties: { name: string } }) => f.properties.name);

  // The whole risk of forgiving typos: that a correct answer for one country
  // is quietly accepted for another. Checked across the entire map.
  it("accepts no country's own name as an answer for a different one", () => {
    const collisions: string[] = [];
    for (const geoName of names) {
      const meta = getCountryMeta(geoName);
      for (const other of names) {
        if (other === geoName) continue;
        const otherMeta = getCountryMeta(other);
        for (const answer of [
          otherMeta.displayName,
          otherMeta.geoName,
          ...otherMeta.aliases,
        ]) {
          if (isCorrectGuess(answer, meta)) {
            collisions.push(`"${answer}" accepted for ${meta.displayName}`);
          }
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it("still accepts every country's own name", () => {
    const rejected = names.filter(
      (n) => !isCorrectGuess(getCountryMeta(n).displayName, getCountryMeta(n))
    );
    expect(rejected).toEqual([]);
  });
});

describe("what the suggestion list offers", () => {
  const pool = [
    { displayName: "United States", aliases: ["usa", "us", "united states of america", "america"] },
    { displayName: "United Kingdom", aliases: ["england", "uk", "great britain", "britain"] },
    { displayName: "Australia", aliases: [] },
    { displayName: "Austria", aliases: [] },
    { displayName: "Belarus", aliases: [] },
    { displayName: "Russia", aliases: [] },
    { displayName: "Morocco", aliases: [] },
  ];
  const names = (typed: string, limit = 6) =>
    suggestNames(pool, typed, limit).map((m) => m.displayName);

  // The bug this was written for: "usa" is accepted as an answer but the list
  // under the box only searched printed names, so it offered nothing.
  it("finds a country by its alias", () => {
    expect(names("usa")).toEqual(["United States"]);
    expect(names("uk")).toEqual(["United Kingdom"]);
    expect(names("england")).toEqual(["United Kingdom"]);
  });

  // Plain substring matching put Australia, Austria, Belarus and Russia above
  // the United States for "us" — all four contain those two letters.
  it("puts what you are obviously reaching for first", () => {
    expect(names("us")[0]).toBe("United States");
  });

  it("prefers a real name over a nickname", () => {
    expect(names("united")).toEqual(["United Kingdom", "United States"]);
  });

  it("still matches a plain prefix", () => {
    expect(names("moro")).toEqual(["Morocco"]);
    expect(names("austr")).toEqual(["Australia", "Austria"]);
  });

  it("ignores case, accents and punctuation", () => {
    expect(names("U.S.A.")).toEqual(["United States"]);
    expect(names("  MOROCCO ")).toEqual(["Morocco"]);
  });

  it("offers nothing for an empty box, rather than everything", () => {
    expect(names("")).toEqual([]);
    expect(names("   ")).toEqual([]);
  });

  it("offers nothing for a name no country has", () => {
    expect(names("zzzz")).toEqual([]);
  });

  it("never returns more than it was asked for", () => {
    expect(names("a", 3).length).toBeLessThanOrEqual(3);
  });
});

describe("names typed with dots or run together", () => {
  const everyName: string[] = JSON.parse(
    readFileSync("public/data/world.geojson", "utf8")
  ).features.map((f: { properties: { name: string } }) => f.properties.name);
  const usa = getCountryMeta("USA");
  const korea = getCountryMeta("South Korea");

  it("accepts initials written with full stops", () => {
    expect(isCorrectGuess("U.S.A.", usa)).toBe(true);
    expect(isCorrectGuess("u.s.a", usa)).toBe(true);
    expect(isCorrectGuess("U.S.", usa)).toBe(true);
  });

  it("accepts a two-word name run together", () => {
    expect(isCorrectGuess("southkorea", korea)).toBe(true);
    expect(isCorrectGuess("unitedstates", usa)).toBe(true);
    expect(isCorrectGuess("unitedstatesofamerica", usa)).toBe(true);
  });

  it("still takes the ordinary spellings", () => {
    expect(isCorrectGuess("usa", usa)).toBe(true);
    expect(isCorrectGuess("United States", usa)).toBe(true);
    expect(isCorrectGuess("south korea", korea)).toBe(true);
  });

  /**
   * The guarantee this change could have broken.
   *
   * Removing spaces shortens names, and the fuzzy radii are derived from the
   * map precisely so that no two countries' accepted spellings overlap. The
   * space-free comparison is therefore exact-only — but "exact" is worth
   * proving: every accepted spelling of every country, with its spaces taken
   * out, must still belong to exactly one country.
   */
  it("never lets one country answer for another", () => {
    const owners = new Map<string, string>();
    const clashes: string[] = [];
    for (const geoName of everyName) {
      const meta = getCountryMeta(geoName);
      const forms = [meta.displayName, meta.geoName, ...meta.aliases];
      for (const form of forms) {
        const key = normalizeAnswer(form).replace(/ /g, "");
        if (!key) continue;
        const owner = owners.get(key);
        if (owner && owner !== geoName) clashes.push(`${key}: ${owner} vs ${geoName}`);
        owners.set(key, geoName);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("keeps the pairs the radii exist to separate apart", () => {
    const pairs: [string, string][] = [
      ["South Korea", "North Korea"],
      ["Ireland", "Iceland"],
      ["Zambia", "Gambia"],
      ["Niger", "Nigeria"],
      ["Austria", "Australia"],
    ];
    for (const [a, b] of pairs) {
      const other = getCountryMeta(b);
      expect(isCorrectGuess(a.replace(/ /g, ""), other)).toBe(false);
      expect(isCorrectGuess(a, other)).toBe(false);
    }
  });
});

describe("nearestNames", () => {
  const pool = ["Nigeria", "Niger", "Iceland", "Ireland", "Chad", "Switzerland"];

  it("offers the country a misspelling was reaching for", () => {
    expect(nearestNames("nigeira", pool)).toEqual(["Nigeria"]);
    expect(nearestNames("switserlnd", pool)).toEqual(["Switzerland"]);
  });

  it("offers both when two are equally close, rather than guessing", () => {
    // One letter from Nigeria and one from Niger: a real ambiguity, and the
    // reason this returns two.
    expect(nearestNames("nigera", pool).sort()).toEqual(["Niger", "Nigeria"]);
    expect(nearestNames("irceland", pool).sort()).toEqual(["Iceland", "Ireland"]);
  });

  it("offers nothing for a different word altogether", () => {
    expect(nearestNames("banana", pool)).toEqual([]);
  });

  it("stays quiet on two letters, where everything is one slip from something", () => {
    expect(nearestNames("ch", pool)).toEqual([]);
  });
});

describe("the short forms people type", () => {
  it.each([
    ["car", "Central African Republic"],
    ["CAR", "Central African Republic"],
    ["png", "Papua New Guinea"],
    ["nz", "New Zealand"],
    ["cape verde", "Cabo Verde"],
    ["bosnia", "Bosnia and Herzegovina"],
    ["st lucia", "Saint Lucia"],
    ["dprk", "North Korea"],
  ])("accepts %s for %s", (typed, geoName) => {
    expect(isCorrectGuess(typed, getCountryMeta(geoName))).toBe(true);
  });

  it("gives an ambiguous one to nobody", () => {
    // Both Koreas, and both "DR"s, are a guess at which one you meant.
    expect(isCorrectGuess("korea", getCountryMeta("South Korea"))).toBe(false);
    expect(isCorrectGuess("korea", getCountryMeta("North Korea"))).toBe(false);
    expect(isCorrectGuess("dr", getCountryMeta("Dominican Republic"))).toBe(false);
  });
});
