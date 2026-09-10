import type { GameType } from "../data/modes";

/**
 * The daily challenge: one round, the same for everyone, changing at midnight
 * UTC.
 *
 * Everything is derived from the date, so no server is needed to agree on what
 * today's round is — two people on opposite sides of the world get the same
 * countries in the same order from the same arithmetic.
 */
export const DAILY_COUNTRIES = 10;

/** The date key a challenge is identified by, in UTC so it turns over at once. */
export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** How many days a date is since the game's epoch, for numbering rounds. */
const EPOCH = Date.UTC(2026, 0, 1);

export function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000) + 1;
}

/** The day written out for a human, in the same UTC terms it was chosen. */
export function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** A small, fast, well-behaved PRNG — enough to shuffle a list reproducibly. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Challenge = {
  day: string;
  number: number;
  type: GameType;
  /** The countries to ask for, in the order everyone gets them. */
  countries: string[];
};

/** The four ways to play, rotated by the date rather than picked at random. */
const TYPES: GameType[] = ["name", "find", "flag", "famous"];

/**
 * Builds the round for a given day from a pool of eligible countries.
 *
 * The pool is passed in rather than read here so the caller can supply only
 * countries the chosen game type can actually ask for — a flag round needs a
 * flag, a famous-for round needs a clue.
 */
export function challengeFor(day: string, pool: string[]): Challenge {
  const number = dayNumber(day);
  const type = TYPES[Math.abs(number) % TYPES.length];

  const random = mulberry32(hash(day));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    day,
    number,
    type,
    countries: shuffled.slice(0, Math.min(DAILY_COUNTRIES, shuffled.length)),
  };
}

/** How each country in the day's round went, for the shareable card. */
export type Outcome = "first" | "retried" | "missed";

export type DailyResult = {
  day: string;
  number: number;
  type: GameType;
  points: number;
  found: number;
  total: number;
  ms: number;
  outcomes: Outcome[];
};

const KEY = "worldguess.daily.v1";

function read(): Record<string, DailyResult> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, DailyResult>)
      : {};
  } catch {
    return {};
  }
}

export function resultFor(day: string): DailyResult | null {
  const stored = read()[day];
  return stored && typeof stored.points === "number" ? stored : null;
}

export function saveResult(result: DailyResult) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...read(), [result.day]: result })
    );
  } catch {
    /* the round still counts, it just won't be remembered */
  }
}

/** Every day played, newest first — the basis of the streak. */
export function playedDays(): string[] {
  return Object.keys(read()).sort().reverse();
}

/** Consecutive days played up to and including today, or yesterday. */
export function streak(today: string = dayKey()): number {
  const played = new Set(playedDays());
  if (played.size === 0) return 0;

  const start = played.has(today) ? today : previousDay(today);
  if (!played.has(start)) return 0;

  let count = 0;
  let day = start;
  while (played.has(day)) {
    count++;
    day = previousDay(day);
  }
  return count;
}

function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10);
}

const SQUARES: Record<Outcome, string> = {
  first: "🟩",
  retried: "🟨",
  missed: "⬜",
};

/** The text people paste elsewhere. Deliberately spoiler-free. */
export function shareText(result: DailyResult): string {
  const label = {
    name: "Name it",
    find: "Find it",
    flag: "Flags",
    famous: "Famous for",
  }[result.type];
  const squares = result.outcomes.map((o) => SQUARES[o]).join("");
  return [
    `WorldGuess #${result.number} — ${label}`,
    `${result.found}/${result.total} · ${result.points.toLocaleString()} pts`,
    squares,
  ].join("\n");
}
