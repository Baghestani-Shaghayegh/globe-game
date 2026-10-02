import { beforeEach, describe, expect, it } from "vitest";
import { CLUES } from "../data/clues";
import {
  clueMarks,
  cluePuzzleFor,
  cluesShown,
  dailyClues,
  foundOn,
  loadClues,
  play,
  saveClues,
  scoreFor,
  type CluesResult,
} from "./fiveClues";
import { frameAt } from "./replayFrame";
import type { Replay } from "./replay";

beforeEach(() => localStorage.clear());

const pool = Object.keys(CLUES);

function fresh(answer = "Peru"): CluesResult {
  return { day: "2026-10-02", number: 275, answer, guesses: [], solved: false, startedAt: 0 };
}

describe("today's country", () => {
  it("is the same for everyone on a day", () => {
    expect(cluePuzzleFor("2026-10-02", pool)).toBe(cluePuzzleFor("2026-10-02", [...pool].reverse()));
  });

  it("doesn't come back until every country has had its day", () => {
    const seen = new Set<string>();
    const start = Date.UTC(2026, 9, 2);
    for (let i = 0; i < pool.length; i += 1) {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      seen.add(cluePuzzleFor(day, pool)!);
    }
    expect(seen.size).toBe(pool.length);
  });

  it("starts with the hardest clue", () => {
    expect(dailyClues("Peru")[0]).toBe(CLUES.Peru[4]);
    expect(dailyClues("Peru")[4]).toBe(CLUES.Peru[0]);
  });
});

describe("a round", () => {
  it("turns over a clue for each miss, and scores by the clue it's found on", () => {
    let r = fresh();
    expect(cluesShown(r)).toBe(1);
    r = play(r, "Chile", 1000);
    r = play(r, null, 2000);
    expect(cluesShown(r)).toBe(3);
    r = play(r, "Peru", 3000);
    expect(r.solved).toBe(true);
    expect(foundOn(r)).toBe(3);
    expect(scoreFor(r)).toBe(600);
    expect(clueMarks(r)).toEqual(["missed", "skipped", "found", "unused", "unused"]);
    expect(cluesShown(r)).toBe(5);
  });

  it("is lost after five misses, and scores nothing", () => {
    let r = fresh();
    for (const g of ["Chile", "Bolivia", null, "Ecuador", "Brazil"]) r = play(r, g, 5000);
    expect(r.lost).toBe(true);
    expect(r.solved).toBe(false);
    expect(scoreFor(r)).toBe(0);
    // Nothing more goes on once it's over.
    expect(play(r, "Peru").guesses).toHaveLength(5);
  });

  it("is worth 1,000 on the first clue", () => {
    expect(scoreFor(play(fresh(), "Peru", 1000))).toBe(1000);
  });
});

describe("kept on the device", () => {
  it("comes back for the same day only", () => {
    saveClues(play(fresh(), "Peru", 1000));
    expect(loadClues("2026-10-02")?.solved).toBe(true);
    expect(loadClues("2026-10-03")).toBeNull();
  });

  it("starts fresh on a corrupt value", () => {
    localStorage.setItem("worldguess.clues.v1", "{not json");
    expect(loadClues("2026-10-02")).toBeNull();
    localStorage.setItem(
      "worldguess.clues.v1",
      JSON.stringify({ ...fresh(), guesses: [1, 2, 3] })
    );
    expect(loadClues("2026-10-02")).toBeNull();
  });
});

describe("the recording", () => {
  it("keeps every miss red, and counts the clues turned over", () => {
    const replay: Replay = {
      v: 1,
      game: { type: "clues", mode: "daily", label: "Five clues #275", bucket: "clues:daily", answer: "Peru" },
      at: "2026-10-02T10:00:00.000Z",
      result: { ms: 9000, points: 600, found: 1, total: 1 },
      cam: [],
      ev: [
        [2000, "x", "Chile"],
        [2000, "h", "clue"],
        [5000, "x", null],
        [5000, "h", "clue"],
        [9000, "ok", "Peru", 600],
      ],
    };
    const f = frameAt(replay, 8000);
    expect(f.missed).toEqual(["Chile"]);
    expect(f.hints).toHaveLength(2);
    expect(frameAt(replay, 9100).found.has("Peru")).toBe(true);
  });
});
