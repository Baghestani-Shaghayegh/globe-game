import { allCountries, type CountryRow } from "./countryStats";

/**
 * Spaced repetition over the countries that keep getting away.
 *
 * A Leitner ladder: get one right cleanly and it moves up a box and won't be
 * asked again for longer; miss it and it drops to the bottom and comes back
 * tomorrow. The intervals widen fast, because the point is to spend practice
 * time on the eight countries you keep losing rather than the hundred you
 * already know.
 */

/** How long each box waits before a country is due again, in days. */
export const BOX_DAYS = [0, 1, 3, 7, 16, 35] as const;
export const TOP_BOX = BOX_DAYS.length - 1;

/** How many countries one practice round asks about. */
export const SESSION_SIZE = 8;

const KEY = "worldguess.practice.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

export type Card = {
  /** 0 is "just missed this", 5 is "known cold". */
  box: number;
  /** When it should next be asked, as an ISO timestamp. */
  dueAt: string;
};

export type Deck = Record<string, Card | undefined>;

/** How a country went in a practice round. */
export type Recall = "clean" | "slow" | "missed";

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false;
  const { box, dueAt } = value as Card;
  return (
    typeof box === "number" &&
    Number.isInteger(box) &&
    box >= 0 &&
    box <= TOP_BOX &&
    typeof dueAt === "string"
  );
}

function read(): Deck {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Deck).filter(([, card]) => isCard(card))
    );
  } catch {
    return {};
  }
}

function write(deck: Deck) {
  try {
    localStorage.setItem(KEY, JSON.stringify(deck));
  } catch {
    /* practice still works within the session */
  }
}

/** Where a box's next review falls. */
export function dueAfter(box: number, from: number): string {
  const days = BOX_DAYS[Math.max(0, Math.min(TOP_BOX, box))];
  return new Date(from + days * DAY_MS).toISOString();
}

/**
 * The box a card moves to.
 *
 * A clean answer promotes. A slow one — right, but only after a wrong guess —
 * holds it where it is: the country was recalled, but not comfortably. A miss
 * sends it back to the bottom, however well it was known before, because the
 * evidence just changed.
 */
export function nextBox(box: number, recall: Recall): number {
  if (recall === "missed") return 0;
  if (recall === "slow") return box;
  return Math.min(TOP_BOX, box + 1);
}

export function isDue(card: Card, now: number): boolean {
  const due = Date.parse(card.dueAt);
  return Number.isNaN(due) || due <= now;
}

/**
 * What to practise, worst first.
 *
 * Two sources feed it: cards already in the deck that have come round again,
 * and countries the player has slipped on but never practised. The second is
 * what makes the feature work on day one — the history is already there, so
 * there is something to practise before anyone has practised anything.
 */
export function buildQueue(
  countries: CountryRow[],
  deck: Deck,
  now: number,
  limit = SESSION_SIZE
): string[] {
  const due = Object.entries(deck)
    .filter((entry): entry is [string, Card] => isCard(entry[1]))
    .filter(([, card]) => isDue(card, now))
    // The bottom of the ladder is the most urgent, then whatever waited longest.
    .sort(
      (a, b) =>
        a[1].box - b[1].box || Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt)
    )
    .map(([name]) => name);

  const weight = (row: CountryRow) => row.missed * 2 + row.fumbled;
  const unseen = countries
    .filter((row) => !deck[row.geoName] && weight(row) > 0)
    .sort(
      (a, b) =>
        weight(b) - weight(a) ||
        a.accuracy - b.accuracy ||
        a.displayName.localeCompare(b.displayName)
    )
    .map((row) => row.geoName);

  return [...new Set([...due, ...unseen])].slice(0, limit);
}

/** Files a round's results and returns the updated deck. */
export function review(
  results: Record<string, Recall>,
  deck: Deck,
  now: number
): Deck {
  const updated: Deck = { ...deck };
  for (const [name, recall] of Object.entries(results)) {
    const box = nextBox(updated[name]?.box ?? 0, recall);
    updated[name] = { box, dueAt: dueAfter(box, now) };
  }
  return updated;
}

/** Turns a finished round into per-country outcomes. */
export function recallsFrom(outcome: {
  found: string[];
  fumbled: string[];
  missed: string[];
}): Record<string, Recall> {
  const fumbled = new Set(outcome.fumbled);
  const results: Record<string, Recall> = {};
  for (const name of outcome.found) {
    results[name] = fumbled.has(name) ? "slow" : "clean";
  }
  for (const name of outcome.missed) results[name] = "missed";
  return results;
}

// ---- The stored deck ------------------------------------------------------

export function loadDeck(): Deck {
  return read();
}

export function saveReview(results: Record<string, Recall>, now = Date.now()) {
  write(review(results, read(), now));
}

/** What to practise next, read from storage. */
export function nextSession(now = Date.now(), limit = SESSION_SIZE): string[] {
  return buildQueue(allCountries(), read(), now, limit);
}

/** How many countries are waiting, for the line on the menu. */
export function dueCount(now = Date.now()): number {
  return buildQueue(allCountries(), read(), now, Number.MAX_SAFE_INTEGER).length;
}

/** Countries that have graduated — top box, not due for a month. */
export function masteredCount(now = Date.now()): number {
  return Object.values(read()).filter(
    (card) => isCard(card) && card.box === TOP_BOX && !isDue(card, now)
  ).length;
}

export function clearPractice() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored means nothing to clear */
  }
}
