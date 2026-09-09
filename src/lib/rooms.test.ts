import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  isCompleteCode,
  normalizeCode,
  pickQuestions,
  secondsLeft,
  standings,
  type Room,
  type RoomPlayer,
} from "./rooms";

const room = (over: Partial<Room> = {}): Room => ({
  id: 1,
  code: "AFNNSE",
  host_id: "h",
  status: "playing",
  game_type: "find",
  mode_id: "easy",
  question_seconds: 15,
  questions: ["France", "Peru"],
  current_index: 0,
  question_started_at: "2026-09-09T12:00:00.000Z",
  started_at: "2026-09-09T12:00:00.000Z",
  ended_at: null,
  ...over,
});

const player = (id: string, score: number, joined: string): RoomPlayer => ({
  room_id: 1,
  user_id: id,
  score,
  joined_at: joined,
});

describe("normalizeCode", () => {
  it.each([
    ["afnnse", "AFNNSE"],
    ["AFN NSE", "AFNNSE"],
    ["afn-nse", "AFNNSE"],
    ["  AFNNSE  ", "AFNNSE"],
  ])("cleans %s up to %s", (raw, expected) => {
    expect(normalizeCode(raw)).toBe(expected);
  });

  it("reads a typed zero as the letter O, since codes never contain digits 0 or 1", () => {
    expect(normalizeCode("Z0MB1E")).toBe("ZOMBIE");
  });

  it("stops at six characters", () => {
    expect(normalizeCode("ABCDEFGHIJ")).toBe("ABCDEF");
  });
});

describe("isCompleteCode", () => {
  it("accepts a full code in the room alphabet", () => {
    expect(isCompleteCode("afnnse")).toBe(true);
  });

  it("rejects a short one", () => {
    expect(isCompleteCode("AFNNS")).toBe(false);
  });

  it("rejects letters the server never issues", () => {
    // O and I are not in the alphabet — a code containing them can't be real.
    expect(CODE_ALPHABET.includes("O")).toBe(false);
    expect(isCompleteCode("ZOMBIE")).toBe(false);
  });
});

describe("pickQuestions", () => {
  it("takes the asked-for number", () => {
    expect(pickQuestions(["a", "b", "c", "d", "e"], 3)).toHaveLength(3);
  });

  it("never repeats a country", () => {
    const picked = pickQuestions(["a", "b", "c", "d", "e"], 5);
    expect(new Set(picked).size).toBe(5);
  });

  it("asks for no more than the map holds", () => {
    expect(pickQuestions(["a", "b"], 10)).toHaveLength(2);
  });

  it("leaves the caller's list alone", () => {
    const names = ["a", "b", "c"];
    pickQuestions(names, 3);
    expect(names).toEqual(["a", "b", "c"]);
  });

  it("shuffles rather than slicing off the front", () => {
    // A random() pinned to 0 makes every swap trade with index 0, which
    // rotates the list. The point is that the order moves at all — a slice
    // off the front would come back untouched.
    expect(pickQuestions(["a", "b", "c", "d"], 4, () => 0)).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
  });
});

describe("secondsLeft", () => {
  const started = Date.parse("2026-09-09T12:00:00.000Z");

  it("is the whole window at the moment a question opens", () => {
    expect(secondsLeft(room(), started)).toBe(15);
  });

  it("counts down", () => {
    expect(secondsLeft(room(), started + 5_000)).toBe(10);
  });

  it("rounds up, so 0 means genuinely over", () => {
    expect(secondsLeft(room(), started + 14_500)).toBe(1);
    expect(secondsLeft(room(), started + 15_000)).toBe(0);
  });

  it("never goes negative", () => {
    expect(secondsLeft(room(), started + 90_000)).toBe(0);
  });

  it("is zero in the lobby and after the match", () => {
    expect(secondsLeft(room({ status: "lobby" }), started)).toBe(0);
    expect(secondsLeft(room({ status: "done" }), started)).toBe(0);
    expect(secondsLeft(room({ question_started_at: null }), started)).toBe(0);
  });
});

describe("standings", () => {
  it("puts the highest score first", () => {
    const rows = standings([
      player("a", 300, "2026-09-09T12:00:00Z"),
      player("b", 900, "2026-09-09T12:00:01Z"),
    ]);
    expect(rows.map((r) => r.user_id)).toEqual(["b", "a"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("splits a tie by who joined first", () => {
    const rows = standings([
      player("late", 500, "2026-09-09T12:00:05Z"),
      player("early", 500, "2026-09-09T12:00:00Z"),
    ]);
    expect(rows.map((r) => r.user_id)).toEqual(["early", "late"]);
  });

  it("gives tied players the same rank, so a draw reads as a draw", () => {
    const rows = standings([
      player("a", 500, "2026-09-09T12:00:00Z"),
      player("b", 500, "2026-09-09T12:00:01Z"),
      player("c", 100, "2026-09-09T12:00:02Z"),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("leaves the caller's list alone", () => {
    const players = [
      player("a", 100, "2026-09-09T12:00:00Z"),
      player("b", 900, "2026-09-09T12:00:01Z"),
    ];
    standings(players);
    expect(players.map((p) => p.user_id)).toEqual(["a", "b"]);
  });

  it("copes with an empty room", () => {
    expect(standings([])).toEqual([]);
  });
});
