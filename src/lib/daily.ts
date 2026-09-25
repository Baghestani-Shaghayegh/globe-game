import { type GameType } from "../data/modes";

/**
 * The daily challenge: one round, the same for everyone, changing at midnight
 * UTC.
 *
 * Everything is derived from the date, so no server is needed to agree on what
 * today's round is — two people on opposite sides of the world get the same
 * countries in the same order from the same arithmetic.
 */
export const DAILY_COUNTRIES = 10;

/**
 * What the daily's points are multiplied by before they are filed.
 *
 * Without it the daily is the worst-paying thing in the game: ten countries
 * against a hundred and sixty-seven, so the board rewarded whoever ground the
 * longest mode and the one round everybody plays together counted for least.
 * Doubling does not make it the fastest way to points — a marathon still pays
 * more in absolute terms — it makes playing the daily worth the two minutes
 * rather than a sentimental detour.
 *
 * Two, because a player has to be able to hold it in their head. "Counts
 * double" is a rule; "counts 1.6x" is a patch note.
 */
export const DAILY_MULTIPLIER = 2;

/**
 * How long the daily gives you for its ten countries.
 *
 * A countdown rather than a clock that counts up. The difference is what the
 * round asks of you: counting up, the question was "how fast were you", and a
 * player who could not name a country was free to sit on it. Counting down,
 * the ten are a budget — thirty seconds each on average — and deciding to
 * pass on one you do not know is part of playing it.
 *
 * Five minutes rather than three. The day's countries are drawn from the whole
 * world, so a round can easily contain three you have never heard of; three
 * minutes would have made those rounds unwinnable through no fault of the
 * player, which is a lottery, not a challenge. Five is loose enough that
 * knowing the countries is enough to finish, and tight enough that the clock
 * is real.
 *
 * It is also one of the limits the rest of the game already offers, so the
 * bucket this files under reads back as "Daily · 5 min" rather than a number
 * nothing else uses.
 */
export const DAILY_LIMIT_SECONDS = 300;
export const DAILY_LIMIT_MS = DAILY_LIMIT_SECONDS * 1_000;

/**
 * How long a once-a-day puzzle took, in a shape the scores table will accept.
 *
 * The column is checked to be between a second and a day. A puzzle you open,
 * leave, and come back to tomorrow would otherwise file a week — and one
 * solved in a few seconds flat would file less than the floor. Both are
 * clamped rather than rejected: the time is a detail on a board ranked by
 * points, and losing the whole score over it would be the wrong trade.
 */
export const MIN_RUN_MS = 1_000;
export const MAX_RUN_MS = 86_400_000;

export function elapsedMs(startedAt: number | undefined, now = Date.now()): number {
  if (!startedAt) return MIN_RUN_MS;
  return Math.min(MAX_RUN_MS, Math.max(MIN_RUN_MS, now - startedAt));
}

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

/**
 * The ways to play, rotated by the date rather than picked at random.
 *
 * Taken from the list itself: a hand-written copy fell behind twice while game
 * types were being added, and a daily that silently never offers one of them
 * is the kind of bug nobody reports.
 */
/**
 * Builds the round for a given day from a pool of eligible countries.
 *
 * The pool is passed in rather than read here so the caller can supply only
 * countries the chosen game type can actually ask for — a flag round needs a
 * flag, a famous-for round needs a clue.
 */
/**
 * Which game today's daily is played as.
 *
 * Always naming the country. It used to rotate through all six game types by
 * date, which meant the card on the menu could not say what you were about to
 * play — and the card is called Country hunt, so on a flags day it was simply
 * wrong. One game, the same one every day, is also the only version of this
 * that everybody's score is comparable across.
 *
 * Still a function of the day rather than a constant: the leaderboard builds
 * the day's bucket key through here, and results saved on an earlier rotation
 * still carry the type they were played as.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dailyType(_day: string): GameType {
  return "name";
}

export function challengeFor(day: string, pool: string[]): Challenge {
  const number = dayNumber(day);
  const type = dailyType(day);

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

/**
 * How often each score has come up on the daily, from ten down to none.
 *
 * The bar chart of guesses is the most copied thing about Wordle, and it is
 * copied because it turns a run of days into a shape a player recognises as
 * theirs. Every day is one row of ten, so the bins are fixed rather than
 * derived — a day with a different length is left out rather than squeezed
 * into a scale it does not belong on.
 */
export function scoreSpread(): { found: number; days: number }[] {
  const results = Object.values(read()).filter(
    (result): result is DailyResult =>
      typeof result?.points === "number" && result.total === DAILY_COUNTRIES
  );

  return Array.from({ length: DAILY_COUNTRIES + 1 }, (_, index) => {
    const found = DAILY_COUNTRIES - index;
    return { found, days: results.filter((r) => r.found === found).length };
  });
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

/**
 * The streak, and the two things a player actually wants to know about it:
 * whether today is already counted, and whether this is the best they have
 * done.
 *
 * Built from the days already on file rather than a counter of its own, so
 * switching the display on does not reset anyone and a day played before any
 * of this existed still counts. The Country hunt is the only daily that keeps
 * a per-day history — Mystery and Connect store today's result and nothing
 * else — so it is the one the streak is built on.
 */
export type Streak = {
  /** Consecutive days up to today, or up to yesterday if today is unplayed. */
  days: number;
  /** Whether today is already in the count. */
  playedToday: boolean;
  /** The longest run on file, this one included. */
  best: number;
};

export function streakState(today: string = dayKey()): Streak {
  const played = playedDays();
  const set = new Set(played);

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  // playedDays is newest first, so walking it backwards goes forwards in time
  // and a run is a day that follows the one before it.
  for (const day of [...played].reverse()) {
    run = previous !== null && previousDay(day) === previous ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return { days: streak(today), playedToday: set.has(today), best };
}

function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10);
}


