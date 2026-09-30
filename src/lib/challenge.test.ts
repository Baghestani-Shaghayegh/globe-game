import { beforeEach, describe, expect, it } from "vitest";
import {
  challengeFromUrl,
  challengeLink,
  cleanName,
  decodeChallenge,
  encodeChallenge,
  savedShareName,
  saveShareName,
  verdict,
  type Challenge,
} from "./challenge";

const sara: Challenge = {
  name: "Sara",
  game: "find:europe",
  score: 9,
  higherWins: true,
  ms: 134_000,
  said: "found 9/10 in 2:14",
};

beforeEach(() => localStorage.clear());

describe("a challenge link", () => {
  it("carries the result there and back", () => {
    expect(decodeChallenge(encodeChallenge(sara))).toEqual(sara);
  });

  it("survives names and places outside plain English", () => {
    const c = { ...sara, name: "Zoë 🌍", said: "found São Tomé in 3 guesses" };
    expect(decodeChallenge(encodeChallenge(c))).toEqual(c);
  });

  it("is safe to paste anywhere", () => {
    expect(encodeChallenge(sara)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("replaces the challenge it was opened with rather than adding one", () => {
    const first = challengeLink(sara, "https://worldguess.test/find/europe?rules=relaxed");
    const mine = { ...sara, name: "Jou", score: 10 };
    const second = challengeLink(mine, first);
    const url = new URL(second);
    expect(url.searchParams.getAll("vs")).toHaveLength(1);
    expect(url.searchParams.get("rules")).toBe("relaxed");
    expect(challengeFromUrl(url.search)?.name).toBe("Jou");
  });

  it("reads as nothing when it isn't one", () => {
    expect(decodeChallenge(null)).toBeNull();
    expect(decodeChallenge("not-base64!!")).toBeNull();
    expect(decodeChallenge(encodeChallenge(sara).slice(0, 10))).toBeNull();
    expect(decodeChallenge(btoa(JSON.stringify({ n: "x", g: "y", s: "nine", x: "" })))).toBeNull();
    expect(decodeChallenge("a".repeat(2000))).toBeNull();
  });

  it("keeps a name short and printable", () => {
    expect(cleanName("  <b>Sara</b>  ")).toBe("bSara/b");
    expect(cleanName("")).toBe("A friend");
    expect(cleanName("x".repeat(40))).toHaveLength(16);
  });
});

describe("who won", () => {
  it("goes on the score first", () => {
    expect(verdict({ ...sara, score: 10, ms: 999_000 }, sara)).toBe("won");
    expect(verdict({ ...sara, score: 8, ms: 1 }, sara)).toBe("lost");
  });

  it("counts fewer as better where fewer is better", () => {
    const mystery = { ...sara, game: "mystery:2026-09-30", score: 5, higherWins: false };
    expect(verdict({ ...mystery, score: 3 }, mystery)).toBe("won");
    expect(verdict({ ...mystery, score: 7 }, mystery)).toBe("lost");
  });

  it("settles a tie on time", () => {
    expect(verdict({ ...sara, ms: 120_000 }, sara)).toBe("won");
    expect(verdict({ ...sara, ms: 150_000 }, sara)).toBe("lost");
    expect(verdict(sara, sara)).toBe("tied");
    // The same time as shown is the same time.
    expect(verdict({ ...sara, ms: 134_600 }, sara)).toBe("tied");
  });

  it("won't compare different games — yesterday's daily isn't today's", () => {
    expect(verdict({ ...sara, game: "daily:2026-09-30" }, { ...sara, game: "daily:2026-09-29" })).toBeNull();
  });
});

describe("the name on a challenge", () => {
  it("is remembered", () => {
    saveShareName("Sara");
    expect(savedShareName()).toBe("Sara");
  });

  it("starts empty", () => {
    expect(savedShareName()).toBe("");
  });
});
