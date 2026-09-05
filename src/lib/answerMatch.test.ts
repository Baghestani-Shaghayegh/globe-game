import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allowedSlips,
  editDistance,
  isCorrectGuess,
  normalizeAnswer,
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
