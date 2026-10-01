import { BORDERS, neighboursOf } from "../data/borders";
import { DAILY_MULTIPLIER, hash, mulberry32, dayNumber, elapsedMs } from "./daily";
import { postRun } from "./leaderboard";
import { getCountryMeta } from "../data/countries";

/**
 * Connect the countries: two ends, and the player names a chain of countries
 * that walks from one to the other over land.
 *
 * Any valid chain counts, not one blessed answer. The shortest route is the
 * par to beat rather than the only way through — half the pleasure is finding
 * a longer way round when the direct one won't come to you.
 */

export type Puzzle = {
  day: string;
  number: number;
  from: string;
  to: string;
  /** Length of the shortest chain between the ends, not counting them. */
  par: number;
};

/** Breadth-first, so the first route found is the shortest. */
export function shortestPath(from: string, to: string): string[] | null {
  if (from === to) return [from];
  const cameFrom = new Map<string, string | null>([[from, null]]);
  const queue = [from];

  while (queue.length) {
    const at = queue.shift()!;
    for (const next of neighboursOf(at)) {
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, at);
      if (next === to) {
        const path: string[] = [];
        for (let step: string | null = to; step; step = cameFrom.get(step) ?? null) {
          path.unshift(step);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Steps over land from one country to every country it can reach. */
export function hopsFrom(start: string): Map<string, number> {
  const hops = new Map<string, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const at = queue.shift()!;
    for (const next of neighboursOf(at)) {
      if (hops.has(next)) continue;
      hops.set(next, hops.get(at)! + 1);
      queue.push(next);
    }
  }
  return hops;
}

/**
 * How a placed country sits against the best way through, the way Travle
 * colours its guesses: on a shortest route, a short detour off one, or the
 * wrong way altogether.
 *
 * Jou asked for this: with every placed country the same green, a player who
 * went the long way round could not see which of their picks had cost them,
 * or how the short route would have gone.
 */
export type Grade = "best" | "near" | "far";

/** Extra steps beyond which a detour stops being "near". */
export const NEAR_DETOUR = 2;

export function gradeFor(
  name: string,
  fromHops: Map<string, number>,
  toHops: Map<string, number>,
  par: number
): Grade {
  const a = fromHops.get(name);
  const b = toHops.get(name);
  if (a === undefined || b === undefined) return "far";
  // A route through here is a + b steps end to end; the shortest is par + 1.
  const detour = a + b - (par + 1);
  if (detour <= 0) return "best";
  return detour <= NEAR_DETOUR ? "near" : "far";
}

/** How many countries lie between two ends by the shortest route. */
export function parBetween(from: string, to: string): number | null {
  const path = shortestPath(from, to);
  return path ? path.length - 2 : null;
}

/** Whether a chain actually walks from one end to the other. */
export function isConnected(from: string, to: string, chain: string[]): boolean {
  const full = [from, ...chain, to];
  for (let i = 1; i < full.length; i += 1) {
    if (!neighboursOf(full[i - 1]).includes(full[i])) return false;
  }
  return true;
}

/**
 * The walk from one end to the other through the countries named, or null.
 *
 * Not every name has to end up on the route. Players think out loud, and a
 * country that borders the chain but leads nowhere is a guess made, not a
 * chain broken — so the puzzle is done the moment some of what was named
 * walks the whole way. Breadth-first over the named countries alone, so the
 * route returned is the shortest one they've actually earned.
 */
export function routeThrough(
  from: string,
  to: string,
  placed: string[]
): string[] | null {
  const allowed = new Set(placed);
  const cameFrom = new Map<string, string | null>([[from, null]]);
  const queue = [from];

  while (queue.length) {
    const at = queue.shift()!;
    for (const next of neighboursOf(at)) {
      if (cameFrom.has(next)) continue;
      if (next !== to && !allowed.has(next)) continue;
      cameFrom.set(next, at);
      if (next === to) {
        const route: string[] = [];
        // Back to the start, which is an end rather than a step on the way.
        for (
          let step = cameFrom.get(to) ?? null;
          step && step !== from;
          step = cameFrom.get(step) ?? null
        ) {
          route.unshift(step);
        }
        return route;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Whether a country touches anything already on the board — either end or a
 * country placed.
 *
 * No longer a gate: any country can be placed, as in Travle. This only says
 * whether a new one joins up yet, so the note under the box can tell the
 * player when it doesn't.
 */
export function touchesChain(
  from: string,
  to: string,
  chain: string[],
  candidate: string
): boolean {
  const placed = [from, to, ...chain];
  return placed.some((name) => neighboursOf(name).includes(candidate));
}

/** Countries big enough to be worth walking between: on the mainland graph. */
export function connectable(): string[] {
  return Object.keys(BORDERS)
    .filter((name) => getCountryMeta(name).tier === "country")
    .sort();
}

/**
 * The day's pair, the same for everyone.
 *
 * A pair is only worth asking if the shortest route is neither trivial nor
 * hopeless: two apart is a shrug, and eight apart is a slog nobody finishes.
 */
export const MIN_PAR = 3;
export const MAX_PAR = 6;

export function puzzleFor(day: string, pool = connectable()): Puzzle | null {
  if (pool.length < 2) return null;
  const random = mulberry32(hash(`connect:${day}`));

  // Try pairs until one lands in range. Bounded so a pathological pool can
  // never spin here forever.
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const from = pool[Math.floor(random() * pool.length)];
    const to = pool[Math.floor(random() * pool.length)];
    if (from === to) continue;
    const par = parBetween(from, to);
    if (par === null || par < MIN_PAR || par > MAX_PAR) continue;
    return { day, number: dayNumber(day), from, to, par };
  }
  return null;
}

export type ConnectResult = {
  day: string;
  number: number;
  from: string;
  to: string;
  par: number;
  /**
   * The countries placed so far, in the order they were named. Once solved,
   * only the ones on the route that joined up.
   */
  chain: string[];
  /**
   * Every country placed, on the route or not, in the order named. Kept so a
   * finished board still shows the detours: the chain is cut down to the
   * route on solving, and the wrong turns used to vanish with it. Absent on
   * rounds saved before it was kept; `chain` stands in.
   */
  placed?: string[];
  solved: boolean;
  /** Names tried that didn't touch anything placed. */
  wrong: number;
  /**
   * When the puzzle was first opened, for the time filed with the score.
   *
   * Optional because rounds saved before scores were posted don't carry it;
   * `loadConnect` fills it in on the way past.
   */
  startedAt?: number;
  /** How long it took, stamped the moment it was solved. */
  ms?: number;
};

const KEY = "worldguess.connect.v1";

function isResult(value: unknown): value is ConnectResult {
  if (!value || typeof value !== "object") return false;
  const { day, from, to, chain, solved } = value as ConnectResult;
  return (
    typeof day === "string" &&
    typeof from === "string" &&
    typeof to === "string" &&
    Array.isArray(chain) &&
    typeof solved === "boolean"
  );
}

export function loadConnect(day: string): ConnectResult | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isResult(parsed) || parsed.day !== day) return null;
    const result: ConnectResult = { ...parsed };
    // A corrupt list of placements is dropped, not trusted: `chain` covers it.
    if (
      result.placed !== undefined &&
      !(Array.isArray(result.placed) &&
        result.placed.every((name) => typeof name === "string"))
    ) {
      delete result.placed;
    }
    return result.startedAt ? result : { ...result, startedAt: Date.now() };
  } catch {
    return null;
  }
}

export function saveConnect(result: ConnectResult) {
  try {
    localStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    /* the round still plays out in this tab */
  }
}

/** Everything the player has put on the board, route or not. */
export function placedOf(result: ConnectResult): string[] {
  return result.placed ?? result.chain;
}

/** Full marks for matching par, less for a longer way round or wrong turns. */
export function scoreFor(result: ConnectResult): number {
  if (!result.solved) return 0;
  const over = Math.max(0, result.chain.length - result.par);
  return Math.max(100, 1000 - over * 100 - result.wrong * 50);
}

/** The bucket today's connect is filed under on the leaderboard. */
export const CONNECT_BUCKET = "connect:daily";

/** Files a solved connect on the leaderboard, at the daily multiplier. */
export function postConnectScore(result: ConnectResult): Promise<number | null> {
  if (!result.solved) return Promise.resolve(null);
  return postRun(CONNECT_BUCKET, {
    points: scoreFor(result) * DAILY_MULTIPLIER,
    found: 1,
    total: 1,
    ms: result.ms ?? elapsedMs(result.startedAt),
    // Neither a streak nor a hint exists in this game; the crowns pass over it.
    bestStreak: 0,
    hintsUsed: 0,
  });
}
