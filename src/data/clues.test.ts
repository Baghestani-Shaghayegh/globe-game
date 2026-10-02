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

  it("gives every listed country five clues, for the five-clue daily", () => {
    const off = Object.entries(CLUES)
      .filter(([, clues]) => clues.length !== 5)
      .map(([name, clues]) => `${name}: ${clues.length}`);
    expect(off).toEqual([]);
  });

  // The capital round asks that. As a clue it's the answer by another name.
  it("never states the capital", () => {
    const told = Object.entries(CLUES).flatMap(([name, clues]) =>
      clues.filter((c) => /is (its|the) capital/i.test(c)).map((c) => `${name}: "${c}"`)
    );
    expect(told).toEqual([]);
  });

  // The name's stem catches the people and the language as well: "Italian"
  // in a clue about Italy. The irregular ones are listed.
  it("doesn't give the country away through its people or language", () => {
    const IRREGULAR: Record<string, string[]> = {
      Spain: ["spanish"],
      Netherlands: ["dutch"],
      Switzerland: ["swiss"],
      France: ["french"],
      Thailand: ["thai"],
      Finland: ["finn"],
      Poland: ["polish", "pole"],
      Ireland: ["irish"],
      Philippines: ["filipino"],
      Madagascar: ["malagasy"],
      Denmark: ["danish", "dane"],
      Laos: ["lao"],
      USA: ["american"],
      England: ["british", "english", "britain"],
      "New Zealand": ["kiwi bird lives"],
      Greece: ["greek"],
    };
    const GENERIC = new Set([
      "republic", "islands", "island", "saint", "united", "democratic", "south",
      "north", "east", "west", "central", "the", "and", "city", "new", "coast",
      "equatorial", "kingdom", "states", "arab", "great",
    ]);
    const plain = (text: string) =>
      text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const leaks: string[] = [];
    for (const [geoName, clues] of Object.entries(CLUES)) {
      const meta = getCountryMeta(geoName);
      const stems = [meta.displayName, meta.geoName]
        .flatMap((n) => plain(n).split(/[^a-z]+/))
        .filter((w) => w.length >= 4 && !GENERIC.has(w))
        .map((w) => w.slice(0, Math.min(5, Math.max(4, w.length - 3))));
      const words = [...stems, ...meta.aliases.filter((a) => a.length > 3).map(plain)];
      const irregular = (IRREGULAR[geoName] ?? []).filter((w) => !w.includes(" "));
      for (const clue of clues) {
        const text = plain(clue);
        const hit =
          words.find((w) => new RegExp(`\\b${w}`).test(text)) ??
          irregular.find((w) => new RegExp(`\\b${w}`).test(text));
        if (hit) leaks.push(`${geoName}: "${clue}" (${hit})`);
      }
    }
    expect(leaks).toEqual([]);
  });

  // A clue goes on a shared card and is read by people from the place it's
  // about. These words mark the kind of clue that was taken out in October
  // 2026: wars, disasters and hardship as the thing a country is known for.
  it("doesn't make a country famous for war, disaster or hardship", () => {
    const BANNED =
      /\b((?<!star )wars?|invaded|invasion|occupation|occupied|genocide|massacre|bomb|nuclear test|poorest|poverty|famine|ethnic|banana republic|slaves?|disaster|chernobyl|divided since)\b/i;
    const hits = Object.entries(CLUES).flatMap(([name, clues]) =>
      clues.filter((c) => BANNED.test(c)).map((c) => `${name}: "${c}"`)
    );
    expect(hits).toEqual([]);
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
