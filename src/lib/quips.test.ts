import { describe, expect, it } from "vitest";
import { OCEAN_MISS, VERY_FAR_KM, missQuip, wrongNameQuip } from "./quips";

/** Always take the first line of whichever pool was chosen. */
const first = () => 0;

describe("what the game says when you miss", () => {
  it("tells a neighbour it was a neighbour", () => {
    expect(missQuip("France", "Spain", 1000, first)).toContain("One border out");
  });

  it("says so when the miss is on the right continent", () => {
    // Not bordering, same continent.
    const said = missQuip("Portugal", "Poland", 2000, first);
    expect(said).toContain("Right continent");
  });

  it("says so when it is a different continent altogether", () => {
    expect(missQuip("Chile", "Norway", 5000, first)).toContain(
      "Different continent"
    );
  });

  // Distance wins over continent: a miss across the Pacific is funnier than
  // it is instructive, and "right continent" would be a strange thing to say.
  it("calls out a very long miss over anything else", () => {
    expect(missQuip("Chile", "Norway", VERY_FAR_KM, first)).toContain(
      "other side of the planet"
    );
  });

  it("names the country that was actually clicked", () => {
    expect(missQuip("Brazil", "Peru", 2000, first)).toContain("Brazil");
  });

  it("never leaves a placeholder in the text", () => {
    const pairs: [string, string][] = [
      ["France", "Spain"],
      ["Portugal", "Poland"],
      ["Chile", "Norway"],
      ["Brazil", "Peru"],
    ];
    for (const [clicked, target] of pairs) {
      for (const km of [null, 500, 20_000]) {
        for (let i = 0; i < 3; i += 1) {
          const said = missQuip(clicked, target, km, () => i);
          expect(said).not.toContain("{");
          expect(said.length).toBeGreaterThan(8);
        }
      }
    }
  });

  it("has something to say about the sea", () => {
    expect(OCEAN_MISS.length).toBeGreaterThan(1);
    for (const line of OCEAN_MISS) expect(line.length).toBeGreaterThan(8);
  });
});

describe("what it says about a wrong name", () => {
  it("is short enough to read while still typing", () => {
    for (let i = 0; i < 8; i += 1) {
      const said = wrongNameQuip(() => i);
      expect(said.length).toBeLessThanOrEqual(30);
      expect(said.length).toBeGreaterThan(2);
    }
  });

  it("has more than one thing to say", () => {
    const seen = new Set(
      Array.from({ length: 8 }, (_, i) => wrongNameQuip(() => i))
    );
    expect(seen.size).toBeGreaterThan(4);
  });
});
