import { describe, expect, it } from "vitest";
import { isCorrectGuess, normalizeAnswer } from "./answerMatch";
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

  // Documents today's behaviour: a single slip is still wrong. Typo tolerance
  // is unbuilt, and this is the test that will change when it lands.
  it("does not yet forgive a typo", () => {
    expect(accepts("Kyrgyzstan", "Kyrgystan")).toBe(false);
  });
});
