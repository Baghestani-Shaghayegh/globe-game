import { beforeEach, describe, expect, it } from "vitest";
import { appearance, setAppearance } from "./appearance";

beforeEach(() => localStorage.clear());

describe("appearance", () => {
  it("is dark until somebody picks otherwise", () => {
    expect(appearance()).toBe("dark");
  });

  it("remembers a choice", () => {
    setAppearance("light");
    expect(appearance()).toBe("light");
    setAppearance("system");
    expect(appearance()).toBe("system");
  });

  it("starts fresh on a corrupt value", () => {
    localStorage.setItem("worldguess.appearance.v1", "purple");
    expect(appearance()).toBe("dark");
  });

});
