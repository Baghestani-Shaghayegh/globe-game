import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PAR,
  MIN_PAR,
  connectable,
  isConnected,
  loadConnect,
  parBetween,
  puzzleFor,
  saveConnect,
  scoreFor,
  shortestPath,
  touchesChain,
  type ConnectResult,
} from "./connect";
import { resolveName } from "./answerMatch";
import { BORDERS, neighboursOf } from "../data/borders";

/** resolveName over the connect pool, which it used to default to. */
const resolve = (typed: string) => resolveName(typed, connectable());

beforeEach(() => localStorage.clear());

describe("the border data", () => {
  it("is symmetric — if A borders B then B borders A", () => {
    for (const [name, neighbours] of Object.entries(BORDERS)) {
      for (const other of neighbours) {
        expect(neighboursOf(other)).toContain(name);
      }
    }
  });

  it("has nobody bordering themselves", () => {
    for (const [name, neighbours] of Object.entries(BORDERS)) {
      expect(neighbours).not.toContain(name);
    }
  });

  it("lists no duplicates", () => {
    for (const neighbours of Object.values(BORDERS)) {
      expect(new Set(neighbours).size).toBe(neighbours.length);
    }
  });

  it("knows the borders that exist", () => {
    expect(neighboursOf("Portugal")).toEqual(["Spain"]);
    expect(neighboursOf("Canada")).toEqual(["USA"]);
    expect(neighboursOf("China")).toHaveLength(14);
    expect(neighboursOf("Russia")).toHaveLength(14);
  });

  it("knows France reaches Brazil, because French Guiana does", () => {
    expect(neighboursOf("France")).toContain("Brazil");
    expect(neighboursOf("France")).toContain("Suriname");
  });

  it.each([
    ["Spain", "Morocco"],
    ["England", "France"],
    ["Sweden", "Denmark"],
    ["Japan", "South Korea"],
    ["USA", "Russia"],
    ["Australia", "Indonesia"],
  ])("does not invent a border across water: %s–%s", (a, b) => {
    expect(neighboursOf(a)).not.toContain(b);
  });

  it("leaves islands out rather than listing them as empty", () => {
    for (const island of ["Japan", "Iceland", "Madagascar", "Cuba", "Australia"]) {
      expect(BORDERS[island]).toBeUndefined();
      expect(neighboursOf(island)).toEqual([]);
    }
  });
});

describe("shortestPath", () => {
  it("walks a country to itself in one step", () => {
    expect(shortestPath("France", "France")).toEqual(["France"]);
  });

  it("finds a direct border", () => {
    expect(shortestPath("Portugal", "Spain")).toEqual(["Portugal", "Spain"]);
  });

  it("finds a real route across a continent", () => {
    const path = shortestPath("Portugal", "Poland");
    expect(path).not.toBeNull();
    expect(path![0]).toBe("Portugal");
    expect(path![path!.length - 1]).toBe("Poland");
    // Every consecutive pair must actually share a border.
    for (let i = 1; i < path!.length; i += 1) {
      expect(neighboursOf(path![i - 1])).toContain(path![i]);
    }
  });

  it("returns the shortest route, not merely a route", () => {
    // Portugal to Germany: Spain, France, Germany. Nothing shorter exists.
    expect(shortestPath("Portugal", "Germany")).toEqual([
      "Portugal",
      "Spain",
      "France",
      "Germany",
    ]);
  });

  it("gives up on an island", () => {
    expect(shortestPath("France", "Japan")).toBeNull();
    expect(shortestPath("Iceland", "Norway")).toBeNull();
  });

  it("crosses between continents where the land does", () => {
    // Africa to Asia through Egypt and Israel.
    const path = shortestPath("Morocco", "India");
    expect(path).not.toBeNull();
    expect(path).toContain("Egypt");
  });
});

describe("parBetween", () => {
  it("counts only the countries in between", () => {
    expect(parBetween("Portugal", "Spain")).toBe(0);
    expect(parBetween("Portugal", "France")).toBe(1);
    expect(parBetween("Portugal", "Germany")).toBe(2);
  });

  it("is null where no land route exists", () => {
    expect(parBetween("France", "Australia")).toBeNull();
  });
});

describe("isConnected", () => {
  it("accepts a chain that actually walks the border", () => {
    expect(isConnected("Portugal", "Germany", ["Spain", "France"])).toBe(true);
  });

  it("accepts a longer way round, because any valid chain counts", () => {
    expect(
      isConnected("Portugal", "Germany", ["Spain", "France", "Switzerland", "Austria"])
    ).toBe(true);
  });

  it("rejects a chain with a gap in it", () => {
    expect(isConnected("Portugal", "Germany", ["Spain", "Italy"])).toBe(false);
  });

  it("rejects a chain that doesn't reach the far end", () => {
    expect(isConnected("Portugal", "Germany", ["Spain"])).toBe(false);
  });

  it("accepts an empty chain only where the ends already touch", () => {
    expect(isConnected("Portugal", "Spain", [])).toBe(true);
    expect(isConnected("Portugal", "Germany", [])).toBe(false);
  });
});

describe("touchesChain", () => {
  it("accepts a country next to one of the ends", () => {
    expect(touchesChain("Portugal", "Germany", [], "Spain")).toBe(true);
    expect(touchesChain("Portugal", "Germany", [], "France")).toBe(true);
  });

  it("rejects one that floats free of everything placed", () => {
    expect(touchesChain("Portugal", "Germany", [], "Thailand")).toBe(false);
  });

  it("accepts a country next to something already in the chain", () => {
    expect(touchesChain("Portugal", "Germany", ["Spain"], "France")).toBe(true);
  });
});

describe("puzzleFor", () => {
  it("gives everyone the same pair on the same day", () => {
    expect(puzzleFor("2026-09-10")).toEqual(puzzleFor("2026-09-10"));
  });

  it("sets a pair that is neither trivial nor hopeless", () => {
    for (const day of ["2026-09-10", "2026-09-11", "2026-09-12", "2026-10-01", "2027-03-14"]) {
      const puzzle = puzzleFor(day);
      expect(puzzle).not.toBeNull();
      expect(puzzle!.par).toBeGreaterThanOrEqual(MIN_PAR);
      expect(puzzle!.par).toBeLessThanOrEqual(MAX_PAR);
    }
  });

  it("always sets a pair that can actually be walked", () => {
    for (let i = 0; i < 40; i += 1) {
      const day = `2026-09-${String((i % 28) + 1).padStart(2, "0")}`;
      const puzzle = puzzleFor(day);
      expect(puzzle).not.toBeNull();
      expect(parBetween(puzzle!.from, puzzle!.to)).toBe(puzzle!.par);
    }
  });

  it("changes from day to day", () => {
    const week = ["10", "11", "12", "13", "14", "15", "16"].map(
      (d) => `${puzzleFor(`2026-09-${d}`)!.from}→${puzzleFor(`2026-09-${d}`)!.to}`
    );
    expect(new Set(week).size).toBeGreaterThan(4);
  });

  it("never sets an island as an end", () => {
    for (let i = 1; i <= 28; i += 1) {
      const puzzle = puzzleFor(`2026-11-${String(i).padStart(2, "0")}`)!;
      expect(neighboursOf(puzzle.from).length).toBeGreaterThan(0);
      expect(neighboursOf(puzzle.to).length).toBeGreaterThan(0);
    }
  });

  it("has no puzzle to set from a pool of one", () => {
    expect(puzzleFor("2026-09-10", ["France"])).toBeNull();
  });
});

describe("connectable", () => {
  it("offers only sovereign countries with land borders", () => {
    const pool = connectable();
    expect(pool.length).toBeGreaterThan(120);
    expect(pool).not.toContain("Japan");
    expect(pool).toContain("France");
  });
});

describe("scoring", () => {
  const result = (over: Partial<ConnectResult> = {}): ConnectResult => ({
    day: "2026-09-10",
    number: 253,
    from: "Portugal",
    to: "Germany",
    par: 2,
    chain: ["Spain", "France"],
    solved: true,
    wrong: 0,
    ...over,
  });

  it("pays full marks for matching par", () => {
    expect(scoreFor(result())).toBe(1000);
  });

  it("costs something for a longer way round", () => {
    expect(
      scoreFor(result({ chain: ["Spain", "France", "Switzerland", "Austria"] }))
    ).toBe(1000 - 2 * 100);
  });

  it("costs something for each country that touched nothing", () => {
    expect(scoreFor(result({ wrong: 3 }))).toBe(1000 - 150);
  });

  it("never drops below a floor", () => {
    expect(scoreFor(result({ wrong: 40 }))).toBe(100);
  });

  it("pays nothing for a chain that never connected", () => {
    expect(scoreFor(result({ solved: false }))).toBe(0);
  });
});

describe("the saved round", () => {
  const result: ConnectResult = {
    day: "2026-09-10",
    number: 253,
    from: "Portugal",
    to: "Germany",
    par: 2,
    chain: ["Spain"],
    solved: false,
    wrong: 1,
  };

  it("comes back on the same day", () => {
    saveConnect(result);
    expect(loadConnect("2026-09-10")).toEqual(result);
  });

  it("is ignored on a different day", () => {
    saveConnect(result);
    expect(loadConnect("2026-09-11")).toBeNull();
  });

  it("starts fresh on a corrupt store", () => {
    localStorage.setItem("worldguess.connect.v1", "{not json");
    expect(loadConnect("2026-09-10")).toBeNull();
  });
});


describe("resolveName", () => {
  it("takes the plain name", () => {
    expect(resolve("France")).toBe("France");
  });

  it("ignores case and stray spaces", () => {
    expect(resolve("  fRaNcE ")).toBe("France");
  });

  it("takes an alias the game already knows", () => {
    expect(resolve("USA")).toBe("USA");
    expect(resolve("United States")).toBe("USA");
  });

  it("forgives a small typo", () => {
    expect(resolve("Portugual")).toBe("Portugal");
  });

  it("returns null for something that isn't a country", () => {
    expect(resolve("Atlantis")).toBeNull();
    expect(resolve("")).toBeNull();
  });

  it("returns null for a country with no land borders", () => {
    // Islands aren't in the connectable pool, so they can't be played.
    expect(resolve("Japan")).toBeNull();
  });
});
