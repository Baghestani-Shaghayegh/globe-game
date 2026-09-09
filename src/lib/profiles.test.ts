import { describe, expect, it } from "vitest";
import {
  USERNAME_PATTERN,
  describeSaveError,
  hasUnsavedChanges,
  usernameProblem,
} from "./profiles";

describe("usernameProblem", () => {
  it.each(["sara", "Sara_97", "abc", "sixteen_chars_16"])(
    "accepts %s",
    (name) => {
      expect(usernameProblem(name)).toBeNull();
      expect(USERNAME_PATTERN.test(name)).toBe(true);
    }
  );

  it.each([
    ["ab", "At least 3 characters."],
    ["  a  ", "At least 3 characters."],
    ["seventeen_chars_x", "At most 16 characters."],
    ["has space", "Letters, numbers and underscores only."],
    ["emoji🌍", "Letters, numbers and underscores only."],
    ["dash-name", "Letters, numbers and underscores only."],
  ])("rejects %s", (name, message) => {
    expect(usernameProblem(name)).toBe(message);
  });

  it("ignores surrounding whitespace when measuring", () => {
    expect(usernameProblem("  sara  ")).toBeNull();
  });
});

describe("describeSaveError", () => {
  it("turns a unique violation into a name clash", () => {
    expect(describeSaveError({ code: "23505" })).toMatch(/taken/);
  });

  it("turns a check violation into the naming rule", () => {
    expect(describeSaveError({ code: "23514" })).toMatch(/underscores/);
  });

  it("passes anything else through", () => {
    expect(describeSaveError({ message: "network down" })).toBe("network down");
  });

  it("has something to say about an error with no message", () => {
    expect(describeSaveError(null)).toMatch(/Try again/);
  });
});

describe("hasUnsavedChanges", () => {
  const saved = { id: "u1", username: "sara", country: "ir" };

  it("says no when the form matches what's on file", () => {
    expect(hasUnsavedChanges("sara", "ir", saved)).toBe(false);
  });

  it("notices a changed name", () => {
    expect(hasUnsavedChanges("sara2", "ir", saved)).toBe(true);
  });

  it("notices a changed flag", () => {
    expect(hasUnsavedChanges("sara", "de", saved)).toBe(true);
  });

  it("notices a flag being cleared", () => {
    expect(hasUnsavedChanges("sara", "", saved)).toBe(true);
  });

  it("treats an empty flag and no flag as the same", () => {
    expect(hasUnsavedChanges("sara", "", { ...saved, country: null })).toBe(false);
  });

  it("ignores whitespace the player didn't mean to add", () => {
    expect(hasUnsavedChanges("  sara  ", "ir", saved)).toBe(false);
  });

  it("has nothing to save before a name is typed", () => {
    expect(hasUnsavedChanges("", "", null)).toBe(false);
  });

  it("has something to save as soon as a new player types one", () => {
    expect(hasUnsavedChanges("sara", "", null)).toBe(true);
  });
});
