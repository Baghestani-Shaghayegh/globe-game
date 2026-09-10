import { BORDERS, neighboursOf } from "../data/borders";
import { hash, mulberry32, dayNumber } from "./daily";
import { getCountryMeta } from "../data/countries";
import { isCorrectGuess } from "./answerMatch";

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
 * Whether adding this country keeps the chain buildable at all.
 *
 * A country that borders nothing already placed can't be part of a walk, and
 * saying so at the moment it is typed beats letting someone build a chain of
 * eight that was broken at the second step.
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
  /** The countries placed so far, in the order they were named. */
  chain: string[];
  solved: boolean;
  /** Names tried that didn't touch anything placed. */
  wrong: number;
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
    return isResult(parsed) && parsed.day === day ? parsed : null;
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

/** Full marks for matching par, less for a longer way round or wrong turns. */
export function scoreFor(result: ConnectResult): number {
  if (!result.solved) return 0;
  const over = Math.max(0, result.chain.length - result.par);
  return Math.max(100, 1000 - over * 100 - result.wrong * 50);
}

export function shareText(result: ConnectResult): string {
  const squares = result.solved
    ? "🟩".repeat(result.par) + "🟨".repeat(Math.max(0, result.chain.length - result.par))
    : "⬜".repeat(result.chain.length);
  const tally = result.solved ? `${result.chain.length}` : "X";
  return `WorldGuess Connect #${result.number} — ${getCountryMeta(result.from).displayName} → ${getCountryMeta(result.to).displayName}\n${tally} steps (par ${result.par})\n${squares}`;
}

/**
 * Turns what someone typed into a country, or null.
 *
 * The same forgiving matching the rest of the game uses — aliases, accents and
 * the odd typo — so "cote divoire" and "Ivory Coast" both land, and a near-miss
 * isn't punished as a wrong turn.
 */
export function resolveName(typed: string, pool = connectable()): string | null {
  const trimmed = typed.trim();
  if (!trimmed) return null;
  for (const name of pool) {
    if (isCorrectGuess(trimmed, getCountryMeta(name))) return name;
  }
  return null;
}
