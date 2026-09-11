import { hash, mulberry32 } from "./daily";
import { dayNumber } from "./daily";

/**
 * The mystery country: one hidden country a day, found by guessing and reading
 * the temperature. A wrong guess is the whole game — it is the only mode where
 * being wrong tells you something.
 */

export type Point = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. */
export function distanceKm(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from one point to another, in degrees clockwise from north. */
export function bearing(from: Point, to: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"] as const;

/** Which way to go from a guess to the answer, as an arrow. */
export function arrowFor(from: Point, to: Point): string {
  const octant = Math.round(bearing(from, to) / 45) % 8;
  return ARROWS[octant];
}

/**
 * The far end of the scale. Two points can be 20,000 km apart, but almost no
 * pair of countries is: capping here keeps the middle of the range where most
 * guesses actually land, so the colours mean something.
 */
export const MAX_SCALE_KM = 10_000;

/** 0 at the answer, 1 at the far end of the scale. */
export function heat(km: number): number {
  return Math.max(0, Math.min(1, km / MAX_SCALE_KM));
}

/** How close a guess is, as the percentage a player would recognise. */
export function closeness(km: number): number {
  return Math.round((1 - heat(km)) * 100);
}

/**
 * Warm to cold, deliberately without green: green already means "found" on
 * this globe, and a lukewarm guess that looked like a correct one would be
 * the cruellest possible bug.
 */
const RAMP: { at: number; rgb: [number, number, number] }[] = [
  { at: 0.0, rgb: [220, 38, 38] }, // red — nearly on it
  { at: 0.1, rgb: [249, 115, 22] }, // orange
  { at: 0.22, rgb: [251, 191, 36] }, // amber
  { at: 0.38, rgb: [253, 230, 138] }, // pale warm
  { at: 0.55, rgb: [147, 197, 253] }, // pale cool
  { at: 0.75, rgb: [59, 130, 246] }, // blue
  { at: 1.0, rgb: [30, 58, 138] }, // deep navy — a world away
];

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
}

/** The colour a guess at this distance is painted. */
export function heatColor(km: number): string {
  const t = heat(km);
  for (let i = 1; i < RAMP.length; i += 1) {
    const lo = RAMP[i - 1];
    const hi = RAMP[i];
    if (t <= hi.at) {
      const span = hi.at - lo.at;
      const f = span === 0 ? 0 : (t - lo.at) / span;
      return toHex([
        lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * f,
        lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * f,
        lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * f,
      ]);
    }
  }
  return toHex(RAMP[RAMP.length - 1].rgb);
}


/** The day's hidden country, the same for everyone. */
export function mysteryFor(day: string, pool: string[]): string | null {
  if (!pool.length) return null;
  // Salted so the mystery isn't the first country of the ordinary daily round.
  const random = mulberry32(hash(`mystery:${day}`));
  return pool[Math.floor(random() * pool.length)];
}

export function mysteryNumber(day: string): number {
  return dayNumber(day);
}

export type Guess = {
  name: string;
  km: number;
};

export type MysteryResult = {
  day: string;
  number: number;
  answer: string;
  guesses: Guess[];
  solved: boolean;
};

const KEY = "worldguess.mystery.v1";

function isResult(value: unknown): value is MysteryResult {
  if (!value || typeof value !== "object") return false;
  const { day, answer, guesses, solved } = value as MysteryResult;
  return (
    typeof day === "string" &&
    typeof answer === "string" &&
    typeof solved === "boolean" &&
    Array.isArray(guesses)
  );
}

/** Today's game in progress, or null if it hasn't been started. */
export function loadMystery(day: string): MysteryResult | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isResult(parsed) && parsed.day === day ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMystery(result: MysteryResult) {
  try {
    localStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    /* the round still plays out in this tab */
  }
}

/** Score: a clean find is worth most, and each guess costs. */
export function scoreFor(result: MysteryResult): number {
  if (!result.solved) return 0;
  return Math.max(100, 1000 - (result.guesses.length - 1) * 75);
}
