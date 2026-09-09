import { beforeEach, describe, expect, it } from "vitest";
import {
  BOX_DAYS,
  SESSION_SIZE,
  TOP_BOX,
  buildQueue,
  clearPractice,
  dueAfter,
  dueCount,
  isDue,
  loadDeck,
  nextBox,
  nextSession,
  recallsFrom,
  review,
  saveReview,
  type Deck,
} from "./practice";
import type { CountryRow } from "./countryStats";

beforeEach(() => localStorage.clear());

const NOW = Date.parse("2026-09-09T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const row = (name: string, over: Partial<CountryRow> = {}): CountryRow => ({
  geoName: name,
  displayName: name,
  continents: ["europe"],
  seen: 1,
  first: 0,
  fumbled: 0,
  missed: 1,
  accuracy: 0,
  ...over,
});

describe("the ladder", () => {
  it("widens the gap at every step", () => {
    for (let box = 1; box <= TOP_BOX; box += 1) {
      expect(BOX_DAYS[box]).toBeGreaterThan(BOX_DAYS[box - 1]);
    }
  });

  it("brings a bottom-box country back immediately", () => {
    expect(dueAfter(0, NOW)).toBe(new Date(NOW).toISOString());
  });

  it("pushes the top box a month out", () => {
    expect(Date.parse(dueAfter(TOP_BOX, NOW)) - NOW).toBe(35 * DAY);
  });

  it("clamps a box outside the ladder", () => {
    expect(dueAfter(-3, NOW)).toBe(dueAfter(0, NOW));
    expect(dueAfter(99, NOW)).toBe(dueAfter(TOP_BOX, NOW));
  });
});

describe("nextBox", () => {
  it("promotes a clean answer", () => {
    expect(nextBox(0, "clean")).toBe(1);
    expect(nextBox(3, "clean")).toBe(4);
  });

  it("stops promoting at the top", () => {
    expect(nextBox(TOP_BOX, "clean")).toBe(TOP_BOX);
  });

  it("holds a country that was right, but only on the second try", () => {
    expect(nextBox(3, "slow")).toBe(3);
  });

  it("sends a miss back to the bottom, however well it was known", () => {
    expect(nextBox(TOP_BOX, "missed")).toBe(0);
    expect(nextBox(0, "missed")).toBe(0);
  });
});

describe("isDue", () => {
  it("is due on the stroke of the hour, not after it", () => {
    expect(isDue({ box: 1, dueAt: new Date(NOW).toISOString() }, NOW)).toBe(true);
  });

  it("is not due while there is time left", () => {
    expect(isDue({ box: 1, dueAt: new Date(NOW + 1000).toISOString() }, NOW)).toBe(false);
  });

  it("treats an unreadable date as due, rather than hiding the country forever", () => {
    expect(isDue({ box: 1, dueAt: "not a date" }, NOW)).toBe(true);
  });
});

describe("buildQueue", () => {
  it("is empty for a player who has never slipped", () => {
    expect(buildQueue([row("France", { missed: 0, first: 1, accuracy: 100 })], {}, NOW)).toEqual([]);
  });

  it("seeds from history, so there is something to practise on day one", () => {
    const queue = buildQueue([row("Chad"), row("Mali")], {}, NOW);
    expect(queue).toContain("Chad");
    expect(queue).toContain("Mali");
  });

  it("puts the country missed outright above the one got on the retry", () => {
    const queue = buildQueue(
      [
        row("Retry", { missed: 0, fumbled: 1, seen: 1 }),
        row("Blank", { missed: 1, fumbled: 0, seen: 1 }),
      ],
      {},
      NOW
    );
    expect(queue[0]).toBe("Blank");
  });

  it("leaves out a card that isn't due yet", () => {
    const deck: Deck = {
      Chad: { box: 3, dueAt: new Date(NOW + 5 * DAY).toISOString() },
    };
    expect(buildQueue([row("Chad")], deck, NOW)).toEqual([]);
  });

  it("brings a card back once its time comes", () => {
    const deck: Deck = {
      Chad: { box: 3, dueAt: new Date(NOW - 1000).toISOString() },
    };
    expect(buildQueue([row("Chad")], deck, NOW)).toEqual(["Chad"]);
  });

  it("asks for the lowest box first — those are the ones being lost", () => {
    const deck: Deck = {
      Known: { box: 4, dueAt: new Date(NOW - DAY).toISOString() },
      Shaky: { box: 0, dueAt: new Date(NOW - DAY).toISOString() },
    };
    expect(buildQueue([], deck, NOW)[0]).toBe("Shaky");
  });

  it("puts due cards before countries never practised", () => {
    const deck: Deck = {
      Due: { box: 2, dueAt: new Date(NOW - DAY).toISOString() },
    };
    const queue = buildQueue([row("Fresh")], deck, NOW);
    expect(queue).toEqual(["Due", "Fresh"]);
  });

  it("never repeats a country", () => {
    const deck: Deck = {
      Chad: { box: 0, dueAt: new Date(NOW - DAY).toISOString() },
    };
    const queue = buildQueue([row("Chad")], deck, NOW);
    expect(queue).toEqual(["Chad"]);
  });

  it("keeps a session short", () => {
    const many = Array.from({ length: 40 }, (_, i) => row(`Country ${i}`));
    expect(buildQueue(many, {}, NOW)).toHaveLength(SESSION_SIZE);
  });
});

describe("review", () => {
  it("promotes and reschedules a clean answer", () => {
    const deck = review({ Chad: "clean" }, {}, NOW);
    expect(deck.Chad).toEqual({
      box: 1,
      dueAt: new Date(NOW + DAY).toISOString(),
    });
  });

  it("drops a missed country to the bottom and asks again at once", () => {
    const deck = review(
      { Chad: "missed" },
      { Chad: { box: 5, dueAt: new Date(NOW).toISOString() } },
      NOW
    );
    expect(deck.Chad).toEqual({ box: 0, dueAt: new Date(NOW).toISOString() });
  });

  it("leaves countries the round didn't ask about alone", () => {
    const before: Deck = { Mali: { box: 2, dueAt: "2026-10-01T00:00:00.000Z" } };
    expect(review({ Chad: "clean" }, before, NOW).Mali).toEqual(before.Mali);
  });

  it("doesn't mutate the deck it was given", () => {
    const before: Deck = { Chad: { box: 1, dueAt: "2026-09-10T00:00:00.000Z" } };
    review({ Chad: "clean" }, before, NOW);
    expect(before.Chad).toEqual({ box: 1, dueAt: "2026-09-10T00:00:00.000Z" });
  });

  it("takes four clean answers to climb from the bottom to box 4", () => {
    let deck: Deck = {};
    for (let i = 0; i < 4; i += 1) deck = review({ Chad: "clean" }, deck, NOW);
    expect(deck.Chad!.box).toBe(4);
  });
});

describe("recallsFrom", () => {
  it("reads a round the way the game reports it", () => {
    expect(
      recallsFrom({
        found: ["Clean", "Retried"],
        fumbled: ["Retried"],
        missed: ["Gone"],
      })
    ).toEqual({ Clean: "clean", Retried: "slow", Gone: "missed" });
  });

  it("copes with a round where nothing was asked", () => {
    expect(recallsFrom({ found: [], fumbled: [], missed: [] })).toEqual({});
  });
});

describe("the stored deck", () => {
  it("saves a review and reads it back", () => {
    saveReview({ Chad: "clean" }, NOW);
    expect(loadDeck().Chad).toEqual({
      box: 1,
      dueAt: new Date(NOW + DAY).toISOString(),
    });
  });

  it("starts fresh on a corrupt store", () => {
    localStorage.setItem("worldguess.practice.v1", "{not json");
    expect(loadDeck()).toEqual({});
  });

  it("drops entries that aren't cards", () => {
    localStorage.setItem(
      "worldguess.practice.v1",
      JSON.stringify({ Chad: { box: 1, dueAt: "2026-09-10T00:00:00.000Z" }, Mali: 7 })
    );
    expect(Object.keys(loadDeck())).toEqual(["Chad"]);
  });

  it("rejects a box outside the ladder", () => {
    localStorage.setItem(
      "worldguess.practice.v1",
      JSON.stringify({ Chad: { box: 99, dueAt: "2026-09-10T00:00:00.000Z" } })
    );
    expect(loadDeck()).toEqual({});
  });

  it("counts nothing due and nothing mastered for a new player", () => {
    expect(dueCount(NOW)).toBe(0);
    expect(nextSession(NOW)).toEqual([]);
  });

  it("clears", () => {
    saveReview({ Chad: "clean" }, NOW);
    clearPractice();
    expect(loadDeck()).toEqual({});
  });
});
