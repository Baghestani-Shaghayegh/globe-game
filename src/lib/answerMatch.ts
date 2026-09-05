import { getCountryMeta, type CountryMeta } from "../data/countries";
import { CONTINENT_OF } from "../data/continents";

/**
 * Normalize an answer for forgiving comparison:
 * lowercase, strip accents ("Türkiye" → "turkiye"), drop punctuation,
 * collapse whitespace.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Optimal string alignment distance — Levenshtein plus transpositions, so
 * "Switerzland" costs one slip rather than two, which is how the mistake is
 * actually made. Abandoned as soon as it passes `limit`.
 */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  let twoBack: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2] + 1);
      }
      current[j] = value;
      rowBest = Math.min(rowBest, value);
    }
    if (rowBest > limit) return limit + 1;
    twoBack = previous;
    previous = current;
  }
  return previous[b.length];
}

/** Nobody should get two free slips in a name this short. */
function lengthCap(name: string): number {
  if (name.length <= 4) return 0;
  return name.length <= 8 ? 1 : 2;
}

/**
 * How far a guess may stray from one particular name and still be unambiguous.
 *
 * Derived from the map rather than guessed at: a name sitting one letter from
 * another country gets no slack at all, which is the only thing keeping
 * Ireland from answering for Iceland, Zambia for Gambia, or North Korea for
 * South. The halving makes the accepted spellings of two countries provably
 * disjoint — a guess can never be within range of both.
 */
function computeRadii(): Map<string, number> {
  const forms: { owner: string; text: string }[] = [];
  for (const geoName of Object.keys(CONTINENT_OF)) {
    const meta = getCountryMeta(geoName);
    for (const form of [meta.displayName, meta.geoName, ...meta.aliases]) {
      forms.push({ owner: geoName, text: normalizeAnswer(form) });
    }
  }

  const radii = new Map<string, number>();
  for (const form of forms) {
    let nearest = MAX_SLIPS * 2 + 2;
    for (const other of forms) {
      if (other.owner === form.owner) continue;
      const distance = editDistance(form.text, other.text, nearest);
      if (distance < nearest) nearest = distance;
      if (nearest === 0) break;
    }
    radii.set(
      form.text,
      Math.max(
        0,
        Math.min(MAX_SLIPS, lengthCap(form.text), Math.floor((nearest - 1) / 2))
      )
    );
  }
  return radii;
}

const MAX_SLIPS = 2;
let radii: Map<string, number> | null = null;

/** How many slips a given accepted spelling forgives. */
export function allowedSlips(name: string): number {
  radii ??= computeRadii();
  return radii.get(normalizeAnswer(name)) ?? 0;
}

export function isCorrectGuess(guess: string, country: CountryMeta): boolean {
  const normalized = normalizeAnswer(guess);
  if (!normalized) return false;

  const accepted = [
    country.displayName,
    country.geoName,
    ...country.aliases,
  ].map(normalizeAnswer);

  if (accepted.includes(normalized)) return true;

  return accepted.some((name) => {
    const limit = allowedSlips(name);
    return limit > 0 && editDistance(normalized, name, limit) <= limit;
  });
}
