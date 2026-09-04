import type { CountryMeta } from "./countries";

/**
 * The two ways a round can be played: "name" shows a country and asks for its
 * name, "find" names a country and asks where it is.
 */
export type GameType = "name" | "find";

export const GAME_TYPES: { id: GameType; label: string; blurb: string }[] = [
  {
    id: "name",
    label: "Name it",
    blurb:
      "Click any country on the globe and type its name. No timer, no multiple choice — just how much of the map you can actually recall.",
  },
  {
    id: "find",
    label: "Find it",
    blurb:
      "We name a country, you find it on the globe. The same map, from the other direction.",
  },
];

/** Where a game type sends the player. */
export function gamePath(type: GameType, modeId: string): string {
  return type === "find" ? `/find/${modeId}` : `/play/${modeId}`;
}

/**
 * Which record bucket a round belongs to. "name" keeps the bare mode id it used
 * before there was a second game type, so those records carry over.
 */
export function recordKey(type: GameType, modeId: string): string {
  return type === "find" ? `find:${modeId}` : modeId;
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
    includes: (m) => m.continent === "europe" && m.tier === "country",
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
    includes: (m) => m.continent === "africa" && m.tier === "country",
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
    includes: (m) => m.continent === "asia" && m.tier === "country",
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
    includes: (m) => m.continent === "americas" && m.tier === "country",
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
    includes: (m) => m.continent === "oceania" && m.tier === "country",
  },
];

export function getMode(id: string | undefined): Mode | undefined {
  return MODES.find((mode) => mode.id === id);
}
