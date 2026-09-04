import type { CountryMeta } from "../data/countries";

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

export function isCorrectGuess(guess: string, country: CountryMeta): boolean {
  const normalized = normalizeAnswer(guess);
  if (!normalized) return false;
  return [country.displayName, country.geoName, ...country.aliases].some(
    (accepted) => normalizeAnswer(accepted) === normalized
  );
}
