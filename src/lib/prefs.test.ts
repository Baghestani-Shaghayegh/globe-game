import { beforeEach, describe, expect, it } from "vitest";
import {
  globeThemeId,
  hintsEnabled,
  setHintsEnabled,
  soundEnabled,
} from "./prefs";

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

describe("carrying v1 preferences forward", () => {
  const V1 = "worldguess.prefs.v1";
  const V2 = "worldguess.prefs.v2";

  beforeEach(() => {
    localStorage.clear();
  });

  // The bug this exists for: v1 saved the default palette as though it were a
  // choice, so anyone who had ever changed a setting was pinned to the old
  // default when the default moved.
  it("drops a palette nobody actually chose", () => {
    localStorage.setItem(
      V1,
      JSON.stringify({ hints: false, sound: true, globeTheme: "atlantic" })
    );
    expect(globeThemeId()).toBe("");
  });

  it("keeps the settings that were real choices", () => {
    localStorage.setItem(
      V1,
      JSON.stringify({ hints: false, sound: false, globeTheme: "atlantic" })
    );
    expect(hintsEnabled()).toBe(false);
    expect(soundEnabled()).toBe(false);
  });

  it("runs once and then leaves v1 behind", () => {
    localStorage.setItem(
      V1,
      JSON.stringify({ hints: false, sound: true, globeTheme: "atlantic" })
    );
    hintsEnabled();
    expect(localStorage.getItem(V1)).toBe(null);
    expect(localStorage.getItem(V2)).not.toBe(null);
  });

  it("never overwrites preferences already on v2", () => {
    localStorage.setItem(
      V2,
      JSON.stringify({ hints: true, sound: true, globeTheme: "emerald" })
    );
    localStorage.setItem(
      V1,
      JSON.stringify({ hints: false, sound: false, globeTheme: "atlantic" })
    );
    expect(globeThemeId()).toBe("emerald");
    expect(hintsEnabled()).toBe(true);
  });

  it("leaves a deliberate palette alone once it is on v2", () => {
    setHintsEnabled(false);
    localStorage.setItem(
      V2,
      JSON.stringify({ hints: false, sound: true, globeTheme: "vintage" })
    );
    expect(globeThemeId()).toBe("vintage");
  });
});

