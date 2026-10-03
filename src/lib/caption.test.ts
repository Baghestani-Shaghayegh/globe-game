import { describe, expect, it } from "vitest";
import { videoCaption } from "./caption";
import type { Replay, ReplayEvent, ReplayGame } from "./replay";

const run = (game: Partial<ReplayGame>, result: Partial<Replay["result"]>, ev: ReplayEvent[] = []): Replay => ({
  v: 1,
  game: { type: "name", mode: "easy", label: "Name it · Countries only", bucket: "", ...game },
  at: "2026-10-03T10:00:00.000Z",
  result: { ms: 252_000, points: 0, found: 0, total: 0, ...result },
  cam: [],
  ev,
});

describe("a video's caption", () => {
  it("tells a globe round in its own numbers", () => {
    expect(videoCaption(run({}, { found: 47, total: 50 }))).toBe(
      "Named 47 of 50 countries in 4:12 on GuessGlobe. Tag a friend who can beat that."
    );
    expect(videoCaption(run({ type: "flag" }, { found: 20, total: 20 }))).toBe(
      "Matched all 20 flags in 4:12 on GuessGlobe. Tag a friend who can beat that."
    );
  });

  it("names the daily hunt", () => {
    expect(videoCaption(run({ type: "find", mode: "daily" }, { found: 9, total: 10, ms: 102_000 }))).toBe(
      "Found 9 of 10 countries in 1:42 on today's GuessGlobe Country hunt. Tag a friend who can beat that."
    );
  });

  it("counts a mystery's guesses, and owns up to a loss", () => {
    const g = (km: number): ReplayEvent => [0, "g", "Peru", km];
    expect(videoCaption(run({ type: "mystery", mode: "daily" }, { found: 1, total: 1 }, [g(900), g(300), g(0)]))).toBe(
      "Found today's GuessGlobe mystery country in 3 guesses. Tag a friend who can beat that."
    );
    expect(videoCaption(run({ type: "mystery", mode: "daily" }, { found: 0, total: 1 }))).toBe(
      "Today's GuessGlobe mystery country beat me. Tag a friend who'd get it."
    );
  });

  it("works out the clue from the score", () => {
    expect(videoCaption(run({ type: "clues", mode: "daily" }, { found: 1, total: 1, points: 800 }))).toBe(
      "Got today's GuessGlobe country on clue 2 of 5. Tag a friend who can beat that."
    );
  });

  it("tells someone else's run in their name", () => {
    expect(videoCaption(run({ type: "bigger", mode: "streak" }, { found: 9, total: 10 }), "Mina")).toBe(
      "Mina got 9 in a row on GuessGlobe's Which is bigger? Tag a friend who can beat that."
    );
    expect(videoCaption(run({ type: "mystery", mode: "daily" }, { found: 0, total: 1 }), "Mina")).toBe(
      "Today's GuessGlobe mystery country beat Mina. Tag a friend who'd get it."
    );
  });

  it("never gives away a daily's answer", () => {
    const answer = "Portugal";
    for (const type of ["mystery", "clues"] as const) {
      for (const found of [0, 1]) {
        expect(videoCaption(run({ type, mode: "daily", answer }, { found, total: 1, points: 600 }))).not.toContain(answer);
      }
    }
  });
});
