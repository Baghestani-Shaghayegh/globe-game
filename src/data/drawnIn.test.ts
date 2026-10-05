import { describe, expect, it } from "vitest";
import { getCountryMeta } from "./countries";
import { drawnIn, getMode } from "./modes";

const mode = (id: string) => {
  const found = getMode(id);
  if (!found) throw new Error(id);
  return found;
};

describe("what a round draws", () => {
  it("leaves territories off a countries-only map", () => {
    for (const place of ["Hong Kong", "Greenland", "Western Sahara", "Kosovo"]) {
      expect(drawnIn(mode("easy"), getCountryMeta(place)), place).toBe(false);
    }
    expect(drawnIn(mode("easy"), getCountryMeta("China"))).toBe(true);
  });

  it("keeps them on the full map, where they are asked", () => {
    expect(drawnIn(mode("hard"), getCountryMeta("Hong Kong"))).toBe(true);
  });

  it("leaves them off the continent rounds too", () => {
    expect(drawnIn(mode("europe"), getCountryMeta("Faroe Islands"))).toBe(false);
    expect(drawnIn(mode("europe"), getCountryMeta("France"))).toBe(true);
  });
});
