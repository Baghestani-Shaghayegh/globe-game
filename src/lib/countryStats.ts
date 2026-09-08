import { getCountryMeta } from "../data/countries";
import type { Continent } from "../data/continents";

/**
 * What the player has done with one country, across every round it has come
 * up in. Records track how a *run* went; this tracks how each *country* goes,
 * which is what tells someone the Baltics keep beating them.
 */
export type CountryStat = {
  /** Named right with no wrong answer first. */
  first: number;
  /** Got there, but only after a wrong answer. */
  fumbled: number;
  /** Posed and never got — passed on, timed out, or the round ended. */
  missed: number;
  /** When it last came up, as an ISO timestamp. */
  at: string;
};

type Store = Record<string, CountryStat | undefined>;

const KEY = "worldguess.countries.v1";

/** How a round went, per country. Only countries actually posed are counted. */
export type RoundReport = {
  /** Countries the player engaged with: answered, was shown, or timed out on. */
  seen: string[];
  found: string[];
  /** Of the found ones, those that took a wrong answer first. */
  fumbled: string[];
};

function isStat(value: unknown): value is CountryStat {
  if (!value || typeof value !== "object") return false;
  const { first, fumbled, missed } = value as CountryStat;
  return [first, fumbled, missed].every(
    (n) => typeof n === "number" && Number.isFinite(n) && n >= 0
  );
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Store).filter(([, stat]) => isStat(stat))
    );
  } catch {
    // Private window, blocked storage, or a corrupt value — start fresh.
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* the game plays fine without saved stats */
  }
}

/** Files one round's per-country outcomes. Every game type calls this. */
export function recordRound(report: RoundReport): void {
  const seen = [...new Set(report.seen)];
  if (!seen.length) return;

  const found = new Set(report.found);
  const fumbled = new Set(report.fumbled);
  const at = new Date().toISOString();
  const store = read();

  for (const name of seen) {
    const stat = store[name] ?? { first: 0, fumbled: 0, missed: 0, at };
    if (!found.has(name)) stat.missed += 1;
    else if (fumbled.has(name)) stat.fumbled += 1;
    else stat.first += 1;
    stat.at = at;
    store[name] = stat;
  }

  write(store);
}

/** Wipes every stored country stat. */
export function clearStats(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored means nothing to clear */
  }
}

export type CountryRow = {
  geoName: string;
  displayName: string;
  continents: Continent[];
  /** Times it was posed — first + fumbled + missed. */
  seen: number;
  first: number;
  fumbled: number;
  missed: number;
  /** Share of sightings named right first time, 0–100. */
  accuracy: number;
};

function toRow(geoName: string, stat: CountryStat): CountryRow {
  const seen = stat.first + stat.fumbled + stat.missed;
  const meta = getCountryMeta(geoName);
  return {
    geoName,
    displayName: meta.displayName,
    continents: meta.continents,
    seen,
    first: stat.first,
    fumbled: stat.fumbled,
    missed: stat.missed,
    accuracy: seen ? Math.round((100 * stat.first) / seen) : 0,
  };
}

/** Every country that has come up at least once, most-seen first. */
export function allCountries(): CountryRow[] {
  return Object.entries(read())
    .filter(([, stat]) => isStat(stat))
    .map(([name, stat]) => toRow(name, stat!))
    .filter((row) => row.seen > 0)
    .sort(
      (a, b) => b.seen - a.seen || a.displayName.localeCompare(b.displayName)
    );
}

export type Totals = {
  /** Distinct countries posed. */
  countries: number;
  /** Every sighting across every round. */
  seen: number;
  first: number;
  missed: number;
  /** First-try accuracy across everything, 0–100, or null with no data. */
  accuracy: number | null;
};

export function totals(rows = allCountries()): Totals {
  const seen = rows.reduce((sum, r) => sum + r.seen, 0);
  const first = rows.reduce((sum, r) => sum + r.first, 0);
  return {
    countries: rows.length,
    seen,
    first,
    missed: rows.reduce((sum, r) => sum + r.missed, 0),
    accuracy: seen ? Math.round((100 * first) / seen) : null,
  };
}

export type ContinentRow = {
  continent: Continent;
  countries: number;
  seen: number;
  first: number;
  accuracy: number;
};

/**
 * Accuracy per continent, weakest first. A country that straddles two — Russia,
 * Turkey — counts in both, the same way it can be asked for in both rounds.
 */
export function byContinent(rows = allCountries()): ContinentRow[] {
  const groups = new Map<Continent, CountryRow[]>();
  for (const row of rows) {
    for (const continent of row.continents) {
      const group = groups.get(continent) ?? [];
      group.push(row);
      groups.set(continent, group);
    }
  }

  return [...groups.entries()]
    .map(([continent, group]) => {
      const seen = group.reduce((sum, r) => sum + r.seen, 0);
      const first = group.reduce((sum, r) => sum + r.first, 0);
      return {
        continent,
        countries: group.length,
        seen,
        first,
        accuracy: seen ? Math.round((100 * first) / seen) : 0,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.seen - a.seen);
}

/**
 * The countries that keep beating the player. A country never got costs twice
 * what a country got on the second try does, so outright blanks rise to the
 * top rather than being buried under near-misses.
 */
export function mostMissed(limit = 10, rows = allCountries()): CountryRow[] {
  const weight = (row: CountryRow) => row.missed * 2 + row.fumbled;
  return rows
    .filter((row) => weight(row) > 0)
    .sort(
      (a, b) =>
        weight(b) - weight(a) ||
        a.accuracy - b.accuracy ||
        a.displayName.localeCompare(b.displayName)
    )
    .slice(0, limit);
}
