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

/**
 * The same text with its spaces taken out.
 *
 * "U.S.A." normalises to "u s a" — the dots become spaces — which is equal to
 * neither "united states" nor the alias "usa". Compared without spaces it is
 * equal to the alias, and so are "south korea" typed as "southkorea" and every
 * other name someone runs together.
 */
function spaceless(text: string): string {
  return text.replace(/ /g, "");
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

  // Exact only, deliberately. The radii below are computed from the whole map
  // so that no two countries' accepted spellings can overlap; handing them
  // strings with the spaces removed would shorten every name and quietly
  // widen every radius, which is the one thing keeping North Korea from
  // answering for South.
  const tight = spaceless(normalized);
  if (accepted.some((name) => spaceless(name) === tight)) return true;

  return accepted.some((name) => {
    const limit = allowedSlips(name);
    return limit > 0 && editDistance(normalized, name, limit) <= limit;
  });
}

/**
 * Turns what someone typed into one of the countries on offer, or null.
 *
 * The same forgiving matching as everywhere else — aliases, accents and the
 * odd typo — so "cote divoire" and "Ivory Coast" both land, and a near miss
 * isn't punished as a wrong answer.
 *
 * The pool is the caller's: each mode has its own idea of which countries are
 * in play, and a name outside it is not a country this round knows about.
 */
export function resolveName(typed: string, pool: string[]): string | null {
  const trimmed = typed.trim();
  if (!trimmed) return null;
  for (const name of pool) {
    if (isCorrectGuess(trimmed, getCountryMeta(name))) return name;
  }
  return null;
}

/**
 * The countries worth offering for what has been typed so far, best first.
 *
 * Aliases are searched as well as the printed name, which is the whole point:
 * "usa" is already *accepted* as an answer, but the list under the box only
 * ever looked at "United States", so typing the three letters everyone
 * actually types offered nothing at all. A game that takes an answer it will
 * not suggest is a game that looks broken to the person typing.
 *
 * Ranked rather than merely filtered. Plain substring matching put Australia,
 * Belarus and Russia above the United States for "us" — every one of them
 * contains those two letters — so what someone is obviously reaching for
 * arrived fourth. A name that *starts* with what you typed beats one that
 * merely contains it, and a real name beats a nickname.
 */
export type Suggestable = { displayName: string; aliases: string[] };

export function suggestNames<T extends Suggestable>(
  pool: T[],
  typed: string,
  limit: number
): T[] {
  const query = normalizeAnswer(typed);
  if (!query) return [];

  // "U.S.A." normalises to "u s a" — the dots become spaces — which matches
  // neither "united states" nor the alias "usa". Initials get typed with dots
  // often enough that the list should cope; compared without spaces as well as
  // with them, it does. Only the suggestions are this forgiving: picking one
  // submits the country's real name, so nothing downstream has to be.
  const tight = spaceless(query);
  const hits = (text: string, how: "start" | "anywhere") => {
    const bare = spaceless(text);
    return how === "start"
      ? text.startsWith(query) || bare.startsWith(tight)
      : text.includes(query) || bare.includes(tight);
  };

  const rank = (item: T): number => {
    const name = normalizeAnswer(item.displayName);
    const aliases = item.aliases.map(normalizeAnswer);
    if (hits(name, "start")) return 0;
    if (aliases.some((alias) => hits(alias, "start"))) return 1;
    if (hits(name, "anywhere")) return 2;
    if (aliases.some((alias) => hits(alias, "anywhere"))) return 3;
    return -1;
  };

  return pool
    .map((item) => ({ item, score: rank(item) }))
    .filter((scored) => scored.score >= 0)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.item.displayName.localeCompare(b.item.displayName)
    )
    .slice(0, limit)
    .map((scored) => scored.item);
}

/**
 * The countries a missed guess was probably reaching for, nearest first.
 *
 * Not an answer — `resolveName` already accepts every slip it safely can, and
 * refuses the rest on purpose so Iceland never answers for Ireland. This is
 * for after that refusal: somebody typed "nigera", the box said no, and
 * "Did you mean Nigeria?" is a better thing to hear than "No country called".
 * They still have to pick it, so being generous here costs nothing.
 *
 * Up to two, on a tie, because offering the wrong one of two equally close
 * names is worse than offering both.
 */
export function nearestNames(typed: string, pool: string[]): string[] {
  const query = normalizeAnswer(typed);
  if (query.length < 3) return [];

  // A third of what was typed, and never more than three: past that it has
  // stopped being a misspelling and started being a different word.
  const cap = Math.min(3, Math.max(1, Math.floor(query.length / 3)));
  let best = cap + 1;
  let hits: string[] = [];

  for (const name of pool) {
    const meta = getCountryMeta(name);
    // One past the best so far, so a name that never gets within it reads as
    // worse rather than as a tie.
    let nearest = best + 1;
    for (const form of [meta.displayName, meta.geoName, ...meta.aliases]) {
      const text = normalizeAnswer(form);
      nearest = Math.min(
        nearest,
        editDistance(query, text, best),
        editDistance(spaceless(query), spaceless(text), best)
      );
    }
    if (nearest < best) {
      best = nearest;
      hits = [name];
    } else if (nearest === best && nearest <= cap) {
      hits.push(name);
    }
  }
  return best <= cap ? hits.slice(0, 2) : [];
}
