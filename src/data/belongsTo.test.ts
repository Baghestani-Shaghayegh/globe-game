import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BELONGS_TO, getCountryMeta, standsFor } from "./countries";

const onMap = new Set(
  (JSON.parse(readFileSync("public/data/world.geojson", "utf8")) as {
    features: { properties: { name: string } }[];
  }).features.map((f) => f.properties.name)
);

describe("which country a territory goes with", () => {
  it("only pairs a territory on the map with a country on the map", () => {
    for (const [territory, country] of Object.entries(BELONGS_TO)) {
      expect(onMap.has(territory), territory).toBe(true);
      expect(getCountryMeta(territory).tier, territory).toBe("territory");
      expect(onMap.has(country), country).toBe(true);
      expect(getCountryMeta(country).tier, country).toBe("country");
    }
  });

  it("leaves the disputed places alone", () => {
    for (const place of [
      "Kosovo",
      "Northern Cyprus",
      "Somaliland",
      "Western Sahara",
      "Falkland Islands",
      "South Georgia and the South Sandwich Islands",
      "Gibraltar",
      "British Indian Ocean Territory",
    ]) {
      expect(BELONGS_TO[place], place).toBeUndefined();
    }
  });

  it("makes a click on Hong Kong a click on China, when China is asked", () => {
    expect(standsFor("Hong Kong", new Set(["China"]))).toBe("China");
    expect(standsFor("Hong Kong", new Set(["Japan"]))).toBeNull();
    // On the full map Hong Kong is asked about in its own right.
    expect(standsFor("Hong Kong", new Set(["China", "Hong Kong"]))).toBe("Hong Kong");
    expect(standsFor("Kosovo", new Set(["Serbia"]))).toBeNull();
  });
});
