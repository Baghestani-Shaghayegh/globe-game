import type { CountryMeta } from "./countries";

/**
 * The two ways a round can be played: "name" shows a country and asks for its
 * name, "find" names a country and asks where it is.
 */
export type GameType = "name" | "find";

export const GAME_TYPES: { id: GameType; label: string; blurb: string }[] = [
  { id: "name", label: "Name it", blurb: "Click a country, type its name." },
  { id: "find", label: "Find it", blurb: "We name a country, you find it." },
];

/**
 * How long a round may last. `null` is the open-ended clock that counts up;
 * every other option counts down and stops the game when it reaches zero.
 */
export const TIME_LIMITS: { seconds: number | null; label: string }[] = [
  { seconds: null, label: "Count up" },
  { seconds: 60, label: "1 min" },
  { seconds: 180, label: "3 min" },
  { seconds: 300, label: "5 min" },
  { seconds: 600, label: "10 min" },
];

/** Only limits we offer are accepted, so a hand-edited URL can't set an odd one. */
export function parseLimit(raw: string | null): number | null {
  const seconds = Number(raw);
  return TIME_LIMITS.some((l) => l.seconds !== null && l.seconds === seconds)
    ? seconds
    : null;
}

/** Where a game type sends the player. */
export function gamePath(
  type: GameType,
  modeId: string,
  limitSeconds: number | null
): string {
  const base = type === "find" ? `/find/${modeId}` : `/play/${modeId}`;
  return limitSeconds === null ? base : `${base}?limit=${limitSeconds}`;
}

/**
 * Which record bucket a round belongs to. "name" keeps the bare mode id it used
 * before there was a second game type, so those records carry over.
 */
export function recordKey(
  type: GameType,
  modeId: string,
  limitSeconds: number | null
): string {
  const base = type === "find" ? `find:${modeId}` : modeId;
  // A timed round and an open one aren't comparable — under a countdown the
  // clock always reads the same, so only the score means anything. Each limit
  // keeps its own record.
  return limitSeconds === null ? base : `${base}@${limitSeconds}`;
}

export type ModeId =
  | "easy"
  | "hard"
  | "europe"
  | "africa"
  | "asia"
  | "americas"
  | "oceania";

export type Mode = {
  id: ModeId;
  name: string;
  desc: string;
  /** Short name for the HUD and the card footer. */
  label: string;
  /** Filled bars out of three on the card. */
  level: 1 | 2 | 3;
  /** What this mode's entries are called — Full map holds more than countries. */
  noun: string;
  /** Accent hue for the card artwork. */
  accent: string;
  /** True for the continent modes, which get the compact card. */
  regional: boolean;
  /** Decides which map features this mode asks for. */
  includes: (meta: CountryMeta) => boolean;
  /**
   * Opening camera for a regional round. Set by hand: there are only five
   * regions, and no rule derived from the data beats choosing the view. A
   * median centre puts Oceania east of Australia, because most of its
   * countries are; an average puts Europe in Siberia, because Russia is.
   */
  view?: { lat: number; lng: number; altitude: number };
};

export const MODES: Mode[] = [
  {
    id: "easy",
    name: "Countries only",
    desc: "The world's sovereign countries. A good place to start.",
    label: "Easy",
    level: 1,
    noun: "countries",
    accent: "#2dd4bf",
    regional: false,
    includes: (m) => m.tier === "country",
  },
  {
    id: "hard",
    name: "Full map",
    desc: "Adds territories, islands and disputed regions.",
    label: "Hard",
    level: 3,
    noun: "places",
    accent: "#a78bfa",
    regional: false,
    includes: () => true,
  },
  // Continent modes are a short round over the region's sovereign countries;
  // territories stay exclusive to Full map.
  {
    id: "europe",
    name: "Europe",
    desc: "",
    label: "Europe",
    level: 2,
    noun: "countries",
    accent: "#38bdf8",
    regional: true,
    includes: (m) => m.continents.includes("europe") && m.tier === "country",
    view: { lat: 51, lng: 23, altitude: 1.3 },
  },
  {
    id: "africa",
    name: "Africa",
    desc: "",
    label: "Africa",
    level: 2,
    noun: "countries",
    accent: "#fbbf24",
    regional: true,
    includes: (m) => m.continents.includes("africa") && m.tier === "country",
    view: { lat: 2, lng: 19, altitude: 1.5 },
  },
  {
    id: "asia",
    name: "Asia",
    desc: "",
    label: "Asia",
    level: 2,
    noun: "countries",
    accent: "#fb7185",
    regional: true,
    includes: (m) => m.continents.includes("asia") && m.tier === "country",
    view: { lat: 31, lng: 88, altitude: 1.85 },
  },
  {
    id: "americas",
    name: "Americas",
    desc: "",
    label: "Americas",
    level: 2,
    noun: "countries",
    accent: "#4ade80",
    regional: true,
    includes: (m) => m.continents.includes("americas") && m.tier === "country",
    view: { lat: 5, lng: -83, altitude: 1.95 },
  },
  {
    id: "oceania",
    name: "Oceania",
    desc: "",
    label: "Oceania",
    level: 1,
    noun: "countries",
    accent: "#e879f9",
    regional: true,
    includes: (m) => m.continents.includes("oceania") && m.tier === "country",
    view: { lat: -23, lng: 149, altitude: 1.5 },
  },
];

export function getMode(id: string | undefined): Mode | undefined {
  return MODES.find((mode) => mode.id === id);
}
