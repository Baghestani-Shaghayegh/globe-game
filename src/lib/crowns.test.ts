import { describe, expect, it } from "vitest";
import {
  CROWN_REGIONS,
  CROWN_RUN,
  CROWN_TYPES,
  crownBucket,
  crownCatalogue,
  crownFeat,
  crownTitle,
} from "./crowns";
import { GAME_TYPES, gamePath, recordKey } from "../data/modes";

describe("the bucket a crown is contested in", () => {
  // The whole design rests on this: the crown bucket has to be exactly the key
  // a full, untimed, relaxed run over the countries list writes. If these ever
  // drift, the crown is contested in a bucket nothing is ever filed under and
  // no one can win it — silently.
  it("is the key a full untimed run actually files under", () => {
    for (const type of CROWN_TYPES) {
      expect(crownBucket(type)).toBe(recordKey(type, "easy", null, "relaxed", null));
    }
  });

  it("is a different bucket from a short round", () => {
    for (const type of CROWN_TYPES) {
      expect(crownBucket(type)).not.toBe(recordKey(type, "easy", null, "relaxed", 10));
    }
  });

  it("is a different bucket from a timed run", () => {
    for (const type of CROWN_TYPES) {
      expect(crownBucket(type)).not.toBe(recordKey(type, "easy", 300, "relaxed", null));
    }
  });

  it("is a different bucket from blitz or sudden death", () => {
    for (const type of CROWN_TYPES) {
      expect(crownBucket(type)).not.toBe(recordKey(type, "easy", null, "blitz", null));
      expect(crownBucket(type)).not.toBe(recordKey(type, "easy", null, "sudden", null));
    }
  });

  it("is a different bucket per game type, so six crowns cannot collide", () => {
    const buckets = CROWN_TYPES.map((type) => crownBucket(type));
    expect(new Set(buckets).size).toBe(buckets.length);
  });

  // A region cleared is not the world cleared.
  it("is not a regional board", () => {
    for (const type of CROWN_TYPES) {
      for (const mode of ["europe", "africa", "asia", "americas", "oceania"]) {
        expect(crownBucket(type)).not.toBe(
          recordKey(type, mode, null, "relaxed", null)
        );
      }
    }
  });
});

describe("what the crowns are called", () => {
  it("covers every game type the menu offers", () => {
    expect(CROWN_TYPES).toEqual(GAME_TYPES.map((option) => option.id));
  });

  it("gives every crown its own title and feat", () => {
    const titles = CROWN_TYPES.map(crownTitle);
    const feats = CROWN_TYPES.map(crownFeat);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(feats).size).toBe(feats.length);
    expect(titles.every(Boolean)).toBe(true);
    expect(feats.every(Boolean)).toBe(true);
  });

  it("makes the globe the headline one", () => {
    expect(crownTitle("name")).toBe("World Namer");
    expect(crownTitle("flag")).toBe("Flag Reader");
  });
});

describe("the link on a crown card", () => {
  // The card is a door: press it and you are playing for that crown. If the
  // link and the bucket ever describe different rounds, the card sends people
  // to a game whose result is filed somewhere the crown never looks — and
  // nothing about that failure is visible.
  it("starts the very run the crown is contested in", () => {
    for (const type of CROWN_TYPES) {
      const href = gamePath(
        type,
        CROWN_RUN.mode,
        CROWN_RUN.limit,
        CROWN_RUN.rules,
        CROWN_RUN.count
      );
      const [path, query] = href.split("?");
      const params = new URLSearchParams(query ?? "");

      // The whole list, untimed, relaxed — the same three things the bucket
      // means, read off the URL a player would actually open.
      expect(params.get("count")).toBe("all");
      expect(params.get("limit")).toBeNull();
      expect(params.get("rules")).toBeNull();
      expect(path.endsWith(`/${CROWN_RUN.mode}`)).toBe(true);

      // And that round files under exactly this crown's bucket.
      expect(recordKey(type, CROWN_RUN.mode, CROWN_RUN.limit, CROWN_RUN.rules, CROWN_RUN.count))
        .toBe(crownBucket(type));
    }
  });
});

describe("the catalogue", () => {
  it("is the six world crowns and one per continent", () => {
    const all = crownCatalogue();
    expect(all.filter((c) => c.tier === "world")).toHaveLength(CROWN_TYPES.length);
    expect(all.filter((c) => c.tier === "region")).toHaveLength(CROWN_REGIONS.length);
  });

  it("has no two crowns sharing an id", () => {
    const ids = crownCatalogue().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contests a world crown in one bucket and a continent in every game type", () => {
    for (const crown of crownCatalogue()) {
      expect(crown.buckets.length).toBe(
        crown.tier === "world" ? 1 : CROWN_TYPES.length
      );
      expect(new Set(crown.buckets).size).toBe(crown.buckets.length);
    }
  });

  it("never lets a continent bucket collide with a world one", () => {
    const world = new Set(
      crownCatalogue().filter((c) => c.tier === "world").flatMap((c) => c.buckets)
    );
    const regional = crownCatalogue()
      .filter((c) => c.tier === "region")
      .flatMap((c) => c.buckets);
    expect(regional.filter((bucket) => world.has(bucket))).toEqual([]);
  });

  it("starts every crown unheld", () => {
    expect(crownCatalogue().every((c) => c.holder === null && c.heldIn === null)).toBe(
      true
    );
  });

  // Half of them used to be kings, in a game about the whole world.
  it("crowns nobody a king", () => {
    for (const title of crownCatalogue().map((c) => c.title)) {
      expect(title).not.toMatch(/\b(king|queen|lord|lady)\b/i);
    }
  });

  it("gets the possessive right on a continent that ends in s", () => {
    const titles = crownCatalogue().map((c) => c.title);
    expect(titles).toContain("Americas' fastest");
    expect(titles).toContain("Europe's fastest");
    expect(titles.some((t) => t.includes("s's"))).toBe(false);
  });
});
