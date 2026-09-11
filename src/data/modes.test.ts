import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUND_LENGTH,
  gamePath,
  parseCount,
  recordKey,
} from "./modes";

describe("round length", () => {
  it("defaults to a short round when the URL says nothing", () => {
    expect(parseCount(null)).toBe(DEFAULT_ROUND_LENGTH);
    expect(parseCount("")).toBe(DEFAULT_ROUND_LENGTH);
  });

  it("accepts only the lengths on offer", () => {
    expect(parseCount("25")).toBe(25);
    expect(parseCount("all")).toBe(null);
    // A hand-edited URL can't invent a 3-country round.
    expect(parseCount("3")).toBe(DEFAULT_ROUND_LENGTH);
    expect(parseCount("banana")).toBe(DEFAULT_ROUND_LENGTH);
  });

  it("writes the length into the path even when it is the default", () => {
    expect(gamePath("find", "europe", null, "relaxed", 10)).toBe(
      "/find/europe?count=10"
    );
    expect(gamePath("find", "europe", null, "relaxed", null)).toBe(
      "/find/europe?count=all"
    );
  });

  // A ten-country run and a 167-country run are not the same feat, so they
  // must not share a best time.
  it("keys short rounds apart from full ones", () => {
    expect(recordKey("find", "easy", null, "relaxed", 10)).toBe("find:easy#10");
    expect(recordKey("find", "easy", null, "relaxed", null)).toBe("find:easy");
    expect(recordKey("find", "easy", 180, "blitz", 25)).toBe(
      "blitz:find:easy@180#25"
    );
  });

  it("leaves keys written before round lengths existed alone", () => {
    expect(recordKey("find", "easy", null)).toBe("find:easy");
  });
});
