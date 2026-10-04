import { describe, expect, it } from "vitest";
import { cluesGrid, connectGrid, huntGrid, mysteryGrid } from "./shareGrid";

describe("share grids", () => {
  it("shows a find on clue 2 as a used clue, the find, then three unused", () => {
    expect(cluesGrid(["missed", "found", "unused", "unused", "unused"])).toBe("⬛🟩⬜⬜⬜");
  });

  it("counts a skipped clue as used, and a lost round as five used", () => {
    expect(cluesGrid(["skipped", "found", "unused", "unused", "unused"])).toBe("⬛🟩⬜⬜⬜");
    expect(cluesGrid(["missed", "missed", "missed", "missed", "missed"])).toBe("⬛⬛⬛⬛⬛");
  });

  it("gives the mystery one square per guess", () => {
    expect(mysteryGrid(3, true)).toBe("⬛⬛🟩");
    expect(mysteryGrid(1, true)).toBe("🟩");
    expect(mysteryGrid(4, false)).toBe("⬛⬛⬛⬛");
  });

  it("keeps the end of a long mystery search", () => {
    expect(mysteryGrid(30, true)).toBe("⬛⬛⬛⬛⬛⬛⬛⬛⬛🟩");
  });

  it("gives Connect a green per step and a black per wrong turn", () => {
    expect(connectGrid(3, 2)).toBe("🟩🟩🟩⬛⬛");
    expect(connectGrid(20, 5)).toHaveLength(12 * "🟩".length);
  });

  it("marks the hunt by how each country went", () => {
    expect(huntGrid(["first", "retried", "missed"])).toBe("🟩🟨⬜");
  });

  it("never carries a name, a clue or a distance", () => {
    const all = [
      cluesGrid(["missed", "found", "unused", "unused", "unused"]),
      mysteryGrid(5, true),
      connectGrid(4, 1),
      huntGrid(["first", "missed"]),
    ].join("");
    expect(all).not.toMatch(/[A-Za-z0-9]/);
  });
});
