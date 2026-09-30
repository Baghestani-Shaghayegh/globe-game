import { getCountryMeta } from "../data/countries";
import type { Continent } from "../data/continents";
import { neighboursOf } from "../data/borders";
import type { Geometry } from "./geo";
import { bearing, distanceKm, type Point } from "./mystery";

/**
 * Learn the world: the map cut into short lessons of neighbouring countries.
 *
 * Practice used to replay only what a player had already missed in another
 * game, which left a beginner — the person who most needs it — with "Nothing
 * due" and nothing to do. Sara wanted learning to be the game's strength, so a
 * lesson starts from nothing: meet five countries, find them, name them.
 *
 * Five neighbours rather than five at random, because a place is remembered by
 * what is next to it. The lessons are cut from the map itself rather than
 * listed by hand, so a country added to the map joins a lesson on its own.
 */

/** How many countries a lesson teaches. Sara's choice: short, about 3 minutes. */
export const LESSON_SIZE = 5;

/** The continents in the order the lessons page lists them. */
export const LESSON_CONTINENTS: { id: Continent; name: string }[] = [
  { id: "europe", name: "Europe" },
  { id: "africa", name: "Africa" },
  { id: "asia", name: "Asia" },
  { id: "americas", name: "The Americas" },
  { id: "oceania", name: "Oceania" },
];

/**
 * A country as the grouping sees it: a point to seed from, and optionally a
 * rough outline to measure gaps between borders with.
 */
export type Place = Point & { name: string; edge?: Float64Array };

const EARTH_RADIUS_KM = 6371;
/** Enough of an outline to measure a gap by, few enough to compare quickly. */
const EDGE_POINTS = 64;

/**
 * A country's outline, thinned to at most EDGE_POINTS points, as unit
 * vectors — for measuring how far apart two countries' borders are.
 *
 * Measured centre to centre, Russia sat 3,800 km from Belarus: its centre is
 * in Siberia. Border to border it is 0, which is what "neighbour" means.
 */
export function edgeOf(geometry: Geometry): Float64Array {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const all = polygons.flatMap((polygon) => polygon[0]);
  const step = Math.max(1, Math.ceil(all.length / EDGE_POINTS));
  const kept = all.filter((_, i) => i % step === 0);
  const out = new Float64Array(kept.length * 3);
  kept.forEach(([lng, lat], i) => {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lng * Math.PI) / 180;
    out[i * 3] = Math.cos(phi) * Math.cos(lambda);
    out[i * 3 + 1] = Math.cos(phi) * Math.sin(lambda);
    out[i * 3 + 2] = Math.sin(phi);
  });
  return out;
}

/** The gap between two places: border to border if both have one. */
export function gapKm(a: Place, b: Place): number {
  if (!a.edge || !b.edge) return distanceKm(a, b);
  let best = -1;
  for (let i = 0; i < a.edge.length; i += 3) {
    for (let j = 0; j < b.edge.length; j += 3) {
      const dot =
        a.edge[i] * b.edge[j] +
        a.edge[i + 1] * b.edge[j + 1] +
        a.edge[i + 2] * b.edge[j + 2];
      if (dot > best) best = dot;
    }
  }
  // Thinned outlines don't quite meet where real borders do, and a country
  // inside another — the Vatican in Italy — meets none of its sampled edge at
  // all. Under 150 km counts as touching: close enough to learn together,
  // the Channel and the Baltic crossings included.
  const km = EARTH_RADIUS_KM * Math.acos(Math.max(-1, Math.min(1, best)));
  return km < 150 ? 0 : km;
}

export type Lesson = {
  /** `europe-3`: the continent and the lesson's number within it. */
  id: string;
  continent: Continent;
  /** 1-based. */
  number: number;
  /** In teaching order: each one next to the ones before it. */
  countries: string[];
};

/**
 * Which continent's lessons a country belongs to. Countries on two continents
 * — Russia, Turkey, the Caucasus — go with the first listed, as the Europe map
 * already has them, so nothing is taught twice. Territories aren't taught.
 */
export function lessonContinent(name: string): Continent | null {
  const meta = getCountryMeta(name);
  if (meta.tier !== "country") return null;
  return meta.continents[0] ?? null;
}

/** The middle of a set of places, on the sphere. */
function middleOf(places: Place[]): Point {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const { lat, lng } of places) {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lng * Math.PI) / 180;
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  return {
    lat: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI,
    lng: (Math.atan2(y, x) * 180) / Math.PI,
  };
}

/**
 * How loose a lesson is: for each country, how far it is from its nearest
 * classmate, border to border, plus a little for how far its middle is from
 * the rest — so a country with no classmate nearby costs the most.
 */
function looseness(group: Place[], gap: (a: Place, b: Place) => number): number {
  let total = 0;
  for (const place of group) {
    let nearest = Infinity;
    let spread = 0;
    for (const other of group) {
      if (other === place) continue;
      nearest = Math.min(nearest, gap(place, other));
      spread += distanceKm(place, other);
    }
    total += (Number.isFinite(nearest) ? nearest : 0) + spread / 50;
  }
  return total;
}

/**
 * Swaps countries between lessons while a swap makes the two tighter.
 *
 * Grouping one lesson at a time still leaves the last one formed with
 * whatever was over — Hungary with the Baltic states. Trading members after
 * the fact fixes that without changing any lesson's size. Bounded, so it
 * always finishes; in practice it settles in a few passes.
 */
function tidy(groups: Place[][], gap: (a: Place, b: Place) => number) {
  const memo = new Map<string, number>();
  const gapOf = (a: Place, b: Place) => {
    const key = a.name < b.name ? `${a.name}|${b.name}` : `${b.name}|${a.name}`;
    let value = memo.get(key);
    if (value === undefined) {
      value = gap(a, b);
      memo.set(key, value);
    }
    return value;
  };
  for (let pass = 0; pass < 12; pass += 1) {
    let improved = false;
    for (let g = 0; g < groups.length; g += 1) {
      for (let h = g + 1; h < groups.length; h += 1) {
        const a = groups[g];
        const b = groups[h];
        for (let i = 0; i < a.length; i += 1) {
          for (let j = 0; j < b.length; j += 1) {
            const before = looseness(a, gapOf) + looseness(b, gapOf);
            [a[i], b[j]] = [b[j], a[i]];
            const after = looseness(a, gapOf) + looseness(b, gapOf);
            if (after < before - 1e-6) {
              improved = true;
            } else {
              [a[i], b[j]] = [b[j], a[i]];
            }
          }
        }
      }
    }
    if (!improved) break;
  }
}

/**
 * Cuts a set of places into groups of about `size`, each a cluster of
 * neighbours, in an order that walks across the map.
 *
 * Outside in. Each group starts from the most out-of-the-way place left — the
 * one farthest from the middle of what remains — and grows by taking whichever
 * place is nearest to any member so far, border to border, so countries that
 * touch come first. Walking west to east instead left the edges of every
 * continent until last, and the last lesson was whatever was over: Malta, the
 * Vatican, Britain and Ireland; Japan with Kazakhstan and the Maldives.
 *
 * `bordersOf` makes countries that share a border touch outright, whatever
 * the thinned outlines say — the Vatican is inside Italy and meets none of
 * its coast.
 *
 * A last group smaller than three is shared out to the groups holding each
 * member's nearest neighbour, and countries are then swapped between groups
 * while that makes them tighter. The groups are put in teaching order: the
 * westernmost first, then each time the nearest one not yet taken, so lesson 2
 * picks up beside lesson 1.
 */
export function groupIntoLessons(
  places: Place[],
  size: number = LESSON_SIZE,
  bordersOf: (name: string) => string[] = neighboursOf
): string[][] {
  const gap = (a: Place, b: Place) =>
    bordersOf(a.name).includes(b.name) || bordersOf(b.name).includes(a.name)
      ? 0
      : gapKm(a, b);
  // Nearest border to border; ties to whichever middle is nearer, so a
  // group stays compact rather than strung out along a coast.
  const nearness = (group: Place[], place: Place) =>
    Math.min(...group.map((m) => gap(m, place))) * 1000 +
    Math.min(...group.map((m) => distanceKm(m, place))) / 1000;

  const pool = [...places].sort((a, b) => a.name.localeCompare(b.name));
  const take = (index: number) => pool.splice(index, 1)[0];
  const groups: Place[][] = [];

  while (pool.length) {
    const middle = middleOf(pool);
    let seedIndex = 0;
    let farthest = -1;
    pool.forEach((place, i) => {
      const d = distanceKm(middle, place);
      if (d > farthest) {
        farthest = d;
        seedIndex = i;
      }
    });
    const group = [take(seedIndex)];

    while (group.length < size && pool.length) {
      let bestIndex = 0;
      let best = Infinity;
      pool.forEach((place, i) => {
        const score = nearness(group, place);
        if (score < best) {
          best = score;
          bestIndex = i;
        }
      });
      group.push(take(bestIndex));
    }
    groups.push(group);
  }

  if (groups.length > 1 && groups[groups.length - 1].length < 3) {
    const stub = groups.pop()!;
    for (const place of stub) {
      let home = groups[0];
      let best = Infinity;
      for (const group of groups) {
        const score = nearness(group, place);
        if (score < best) {
          best = score;
          home = group;
        }
      }
      home.push(place);
    }
  }

  tidy(groups, gap);

  // Teaching order: westernmost first, then always the nearest one left.
  const left = [...groups];
  const westOf = (group: Place[]) => Math.min(...group.map((p) => p.lng));
  left.sort((a, b) => westOf(a) - westOf(b));
  const ordered = [left.shift()!];
  while (left.length) {
    const last = ordered[ordered.length - 1];
    let nextIndex = 0;
    let best = Infinity;
    left.forEach((group, i) => {
      const d = Math.min(...group.map((p) => nearness(last, p)));
      if (d < best) {
        best = d;
        nextIndex = i;
      }
    });
    ordered.push(left.splice(nextIndex, 1)[0]);
  }

  return ordered.map((group) => group.map((place) => place.name));
}

/**
 * Every lesson, from the places on the map.
 *
 * `places` is the map's countries with a point each — the middle of the main
 * landmass, so France is in France and not the Atlantic.
 */
export function buildLessons(places: Place[]): Lesson[] {
  return LESSON_CONTINENTS.flatMap(({ id: continent }) =>
    groupIntoLessons(
      places.filter((place) => lessonContinent(place.name) === continent)
    ).map((countries, i) => ({
      id: `${continent}-${i + 1}`,
      continent,
      number: i + 1,
      countries,
    }))
  );
}

/**
 * Land borders the generated list doesn't have, because the map's
 * microstates were added after it was made. Kept here rather than added to
 * that list, which Connect's daily puzzles are drawn from — changing it would
 * change the puzzle for anyone mid-way through today's.
 */
const MICROSTATE_BORDERS: Record<string, string[]> = {
  Andorra: ["France", "Spain"],
  Liechtenstein: ["Austria", "Switzerland"],
  Monaco: ["France"],
  "San Marino": ["Italy"],
  "Vatican City": ["Italy"],
  Gibraltar: ["Spain"],
  "Hong Kong": ["China"],
  Macao: ["China"],
  "Saint Martin": ["Sint Maarten"],
  "Sint Maarten": ["Saint Martin"],
};

/**
 * Every country a country shares a land border with, microstates included:
 * what a lesson shows under "Borders". Both ways round, so Italy lists the
 * Vatican as well as the Vatican listing Italy.
 */
export function landBordersOf(name: string): string[] {
  const out = new Set([...neighboursOf(name), ...(MICROSTATE_BORDERS[name] ?? [])]);
  for (const [small, around] of Object.entries(MICROSTATE_BORDERS)) {
    if (around.includes(name)) out.add(small);
  }
  return [...out];
}

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

/**
 * Where the right country is from the one clicked, for the hint after a
 * miss: "Portugal is west of there." A direction is the thing a beginner can
 * act on — a distance or a list of borders isn't.
 */
export function directionFrom(from: Point, to: Point): (typeof COMPASS)[number] {
  return COMPASS[Math.round(bearing(from, to) / 45) % 8];
}

const KEY = "worldguess.learn.v1";

/** Country → when it was learned, as an ISO date. */
export type Learned = Record<string, string>;

export function learnedCountries(): Learned {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

/** Marks a lesson's countries learned. Already-learned ones keep their date. */
export function markLearned(names: string[], at: Date = new Date()) {
  const learned = learnedCountries();
  for (const name of names) learned[name] ??= at.toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(learned));
  } catch {
    /* the lesson still happened; it just won't be remembered */
  }
}

/** A lesson is done once every country in it has been learned. */
export function lessonDone(lesson: Lesson, learned: Learned): boolean {
  return lesson.countries.every((name) => name in learned);
}

/**
 * The lesson to go to next: the first one not done after the lesson most
 * recently finished, so finishing Europe 3 offers Europe 4 rather than
 * sending you back to a Europe 1 you skipped. Round to the start at the end.
 * With nothing learned yet, the very first.
 */
export function nextLesson(lessons: Lesson[], learned: Learned): Lesson | null {
  let latest: [string, string] | null = null;
  for (const entry of Object.entries(learned)) {
    if (!latest || entry[1] > latest[1]) latest = entry;
  }
  const last = latest
    ? lessons.findIndex((lesson) => lesson.countries.includes(latest[0]))
    : -1;
  for (let i = 1; i <= lessons.length; i += 1) {
    const lesson = lessons[(last + i) % lessons.length];
    if (!lessonDone(lesson, learned)) return lesson;
  }
  return null;
}
