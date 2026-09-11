import type { CountryMeta } from "./countries";

/**
 * The two ways a round can be played: "name" shows a country and asks for its
 * name, "find" names a country and asks where it is.
 */
export type GameType =
  | "name"
  | "find"
  | "flag"
  | "famous"
  | "outline"
  | "capital";

export const GAME_TYPES: { id: GameType; label: string; blurb: string }[] = [
  { id: "name", label: "Name it", blurb: "Click a country, type its name." },
  { id: "find", label: "Find it", blurb: "We name a country, you find it." },
  { id: "flag", label: "Flags", blurb: "We show a flag, you find the country." },
  {
    id: "famous",
    label: "Famous for",
    blurb: "We give a clue, you find the country.",
  },
  {
    id: "outline",
    label: "Outlines",
    blurb: "We show a shape, you find the country.",
  },
  {
    id: "capital",
    label: "Capitals",
    blurb: "We name a capital, you find its country.",
  },
];

/**
 * Extra rules a round can be played under. "sudden" ends the round on the
 * first wrong answer; "relaxed" is the ordinary game.
 */
export type Ruleset = "relaxed" | "sudden" | "blitz";

/** How long a single country may be left unanswered under blitz rules. */
export const BLITZ_SECONDS = 15;

export const RULESETS: { id: Ruleset; label: string; blurb: string }[] = [
  {
    id: "relaxed",
    label: "Relaxed",
    blurb: "Wrong answers cost nothing but your streak.",
  },
  {
    id: "sudden",
    label: "Sudden death",
    blurb: "One wrong answer ends the round.",
  },
  {
    id: "blitz",
    label: "Blitz",
    blurb: `${BLITZ_SECONDS} seconds per country, then it moves on.`,
  },
];

export function parseRuleset(raw: string | null): Ruleset {
  return raw === "sudden" || raw === "blitz" ? raw : "relaxed";
}

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

/**
 * How many countries a round asks for.
 *
 * The game shipped with every mode running its full list — 167 countries for
 * Easy, which is ten minutes of typing before anyone sees a score. That is a
 * sitting, not a session, and the daily challenge proved the point by being
 * the most replayed thing here at ten questions. Short is now the default;
 * the full list is still there for whoever wants the marathon.
 */
export const ROUND_LENGTHS: { count: number | null; label: string }[] = [
  { count: 10, label: "10" },
  { count: 25, label: "25" },
  { count: 50, label: "50" },
  { count: null, label: "Everything" },
];

export const DEFAULT_ROUND_LENGTH = 10;

/** Only lengths we offer are accepted, so a hand-edited URL can't set an odd one. */
export function parseCount(raw: string | null): number | null {
  if (raw === "all") return null;
  const count = Number(raw);
  return ROUND_LENGTHS.some((l) => l.count !== null && l.count === count)
    ? count
    : DEFAULT_ROUND_LENGTH;
}

/** Only limits we offer are accepted, so a hand-edited URL can't set an odd one. */
export function parseLimit(raw: string | null): number | null {
  const seconds = Number(raw);
  return TIME_LIMITS.some((l) => l.seconds !== null && l.seconds === seconds)
    ? seconds
    : null;
}

/**
 * The URL each game type lives at, and the prefix its records are filed under.
 *
 * A map rather than a chain of ternaries: this grew from two game types to six,
 * and every addition used to mean editing three separate conditionals in three
 * files. "name" keeps the bare paths it had before there was a second type.
 */
const ROUTES: Record<GameType, string> = {
  name: "play",
  find: "find",
  flag: "flags",
  famous: "famous",
  outline: "outlines",
  capital: "capitals",
};

/** The prefix a bucket key carries, or "" for the original game type. */
export const BUCKET_PREFIX: Record<GameType, string> = {
  name: "",
  find: "find:",
  flag: "flag:",
  famous: "famous:",
  outline: "outline:",
  capital: "capital:",
};

/** Reads a bucket prefix back to the game type that wrote it. */
export function typeFromBucket(withoutRules: string): GameType {
  for (const [type, prefix] of Object.entries(BUCKET_PREFIX)) {
    if (prefix && withoutRules.startsWith(prefix)) return type as GameType;
  }
  return "name";
}

/** Strips whichever game-type prefix a bucket key carries. */
export function modeIdFromBucket(withoutRules: string): string {
  const prefix = BUCKET_PREFIX[typeFromBucket(withoutRules)];
  return prefix ? withoutRules.slice(prefix.length) : withoutRules;
}

/** Where a game type sends the player. */
export function gamePath(
  type: GameType,
  modeId: string,
  limitSeconds: number | null,
  ruleset: Ruleset = "relaxed",
  count: number | null = DEFAULT_ROUND_LENGTH
): string {
  const base = `/${ROUTES[type]}/${modeId}`;
  const query = new URLSearchParams();
  if (limitSeconds !== null) query.set("limit", String(limitSeconds));
  if (ruleset !== "relaxed") query.set("rules", ruleset);
  // Written even when it is the default, because the default may change and a
  // shared link should keep meaning what it meant when it was sent.
  query.set("count", count === null ? "all" : String(count));
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}

/**
 * Which record bucket a round belongs to. "name" keeps the bare mode id it used
 * before there was a second game type, so those records carry over.
 */
export function recordKey(
  type: GameType,
  modeId: string,
  limitSeconds: number | null,
  ruleset: Ruleset = "relaxed",
  count: number | null = null
): string {
  const prefix = ruleset === "relaxed" ? "" : `${ruleset}:`;
  const base = prefix + BUCKET_PREFIX[type] + modeId;
  // A timed round and an open one aren't comparable — under a countdown the
  // clock always reads the same, so only the score means anything. Each limit
  // keeps its own record.
  const timed = limitSeconds === null ? base : `${base}@${limitSeconds}`;
  // Nor are ten countries and a hundred and sixty-seven: finishing a short
  // round is a different feat, and letting the two share a best time would
  // retire every marathon record the day short rounds arrived. Keys written
  // before round lengths existed carry no suffix and stay the full-list
  // records they always were.
  return count === null ? timed : `${timed}#${count}`;
}

export type ModeId =
  | "daily"
  | "practice"
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
