import { AREA_KM2, MIN_AREA_RATIO, areaOf } from "../data/areas";
import { getCountryMeta } from "../data/countries";

/**
 * Which of two countries is bigger.
 *
 * Only pairs far enough apart in size are ever asked, because the areas are
 * measured off a simplified map: two countries within a few percent of each
 * other could be printed in the wrong order, and a quiz that marks a right
 * answer wrong is worse than one that never asks.
 */

export type Pair = { left: string; right: string };

/** Countries worth asking about: sovereign, and on the map with an area. */
export function askable(): string[] {
  return Object.keys(AREA_KM2)
    .filter((name) => getCountryMeta(name).tier === "country")
    .filter((name) => name !== "Antarctica")
    .sort();
}

/** Whether these two can be told apart reliably. */
export function comparable(a: string, b: string): boolean {
  const areaA = areaOf(a);
  const areaB = areaOf(b);
  if (a === b || areaA === null || areaB === null || areaA === 0 || areaB === 0) {
    return false;
  }
  const ratio = areaA > areaB ? areaA / areaB : areaB / areaA;
  return ratio >= MIN_AREA_RATIO;
}

/** The bigger of two countries. */
export function bigger(a: string, b: string): string {
  return (areaOf(a) ?? 0) >= (areaOf(b) ?? 0) ? a : b;
}

/**
 * A pair to ask about.
 *
 * Bounded rather than looping until it finds one: a pool where nothing is
 * comparable would otherwise spin forever, and returning null is something the
 * caller can actually handle.
 */
export function nextPair(
  pool = askable(),
  random: () => number = Math.random,
  avoid?: string
): Pair | null {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    // Keeping one country on screen between rounds makes it a chain rather
    // than a series of unrelated questions.
    const left = avoid ?? pool[Math.floor(random() * pool.length)];
    const right = pool[Math.floor(random() * pool.length)];
    if (comparable(left, right)) return { left, right };
  }
  return null;
}

export type Score = { streak: number; best: number };

const KEY = "worldguess.higherlower.v1";

export function loadBest(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const value = raw ? JSON.parse(raw) : null;
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : 0;
  } catch {
    return 0;
  }
}

export function saveBest(best: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Math.max(0, Math.floor(best))));
  } catch {
    /* the streak still counts for this sitting */
  }
}

/** Advances the score after an answer. */
export function score(current: Score, correct: boolean): Score {
  const streak = correct ? current.streak + 1 : 0;
  return { streak, best: Math.max(current.best, streak) };
}

/** Area in the units a person reads, rather than seven digits. */
export function formatArea(km2: number): string {
  if (km2 >= 1_000_000) return `${(km2 / 1_000_000).toFixed(2)}M km²`;
  if (km2 >= 10_000) return `${Math.round(km2 / 1000)},000 km²`;
  return `${km2.toLocaleString()} km²`;
}
