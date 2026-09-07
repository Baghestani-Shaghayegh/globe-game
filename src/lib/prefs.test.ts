import { beforeEach, describe, expect, it } from "vitest";
import { hintsEnabled, setHintsEnabled } from "./prefs";

beforeEach(() => localStorage.clear());

describe("preferences", () => {
  it("has hints on until told otherwise", () => {
    expect(hintsEnabled()).toBe(true);
  });

  it("remembers being turned off, and back on", () => {
    setHintsEnabled(false);
    expect(hintsEnabled()).toBe(false);
    setHintsEnabled(true);
    expect(hintsEnabled()).toBe(true);
  });

  it("falls back to the default on a corrupt store", () => {
    localStorage.setItem("worldguess.prefs.v1", "not json{");
    expect(hintsEnabled()).toBe(true);
  });

  it("ignores a value of the wrong type", () => {
    localStorage.setItem("worldguess.prefs.v1", JSON.stringify({ hints: "no" }));
    expect(hintsEnabled()).toBe(true);
  });

  it("is stored apart from records", () => {
    setHintsEnabled(false);
    expect(localStorage.getItem("worldguess.records.v3")).toBeNull();
  });
});
