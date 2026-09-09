import { allBuckets, isComplete, type Bucket } from "./records";
import { allCountries, totals, type CountryRow } from "./countryStats";
import { dayKey, playedDays, streak } from "./daily";
import { MODES, type GameType } from "../data/modes";

/**
 * Everything an achievement can be measured against, gathered once.
 *
 * Nothing here is stored for achievements' sake — it is the history the game
 * already keeps, read a second way. That matters: turning badges on doesn't
 * start anyone from zero, and a player who has been at this for weeks opens
 * the page to what they have already earned.
 */
export type PlayerHistory = {
  buckets: Bucket[];
  countries: CountryRow[];
  dailyStreak: number;
  dailyPlayed: number;
};

export type Achievement = {
  id: string;
  name: string;
  /** What earns it, phrased as the thing to go and do. */
  desc: string;
  icon: string;
  /** How far along, and what would finish it. `have` may exceed `need`. */
  measure: (history: PlayerHistory) => { have: number; need: number };
};

export type Earned = Achievement & {
  have: number;
  need: number;
  unlocked: boolean;
  /** When it was first earned, if the browser saw it happen. */
  at: string | null;
};

const KEY = "worldguess.achievements.v1";

/** Highest streak reached in any run, across every mode. */
function bestStreak(buckets: Bucket[]): number {
  return buckets.reduce(
    (best, bucket) =>
      bucket.runs.reduce((inner, run) => Math.max(inner, run.bestStreak ?? 0), best),
    0
  );
}

/** Whether a mode has ever been cleared outright, in any game type. */
function cleared(buckets: Bucket[], modeId: string): boolean {
  return buckets.some(
    (bucket) => bucket.modeId === modeId && bucket.runs.some(isComplete)
  );
}

/** The quickest full clear of a mode, or null if it has never been finished. */
function fastestClear(buckets: Bucket[], modeId: string): number | null {
  const times = buckets
    .filter((bucket) => bucket.modeId === modeId)
    .flatMap((bucket) => bucket.runs.filter(isComplete).map((run) => run.ms));
  return times.length ? Math.min(...times) : null;
}

function playedTypes(buckets: Bucket[]): Set<GameType> {
  return new Set(buckets.map((bucket) => bucket.type));
}

const REGIONS = MODES.filter((mode) => mode.regional);

/**
 * The catalogue. Ordered roughly by how soon a player meets them, so the page
 * reads as a path rather than a wall.
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-round",
    name: "First steps",
    desc: "Finish a round.",
    icon: "🌍",
    measure: ({ buckets }) => ({
      have: buckets.reduce((n, b) => n + b.runs.length, 0),
      need: 1,
    }),
  },
  {
    id: "streak-10",
    name: "On a roll",
    desc: "Get ten right in a row.",
    icon: "🔟",
    measure: ({ buckets }) => ({ have: bestStreak(buckets), need: 10 }),
  },
  {
    id: "streak-50",
    name: "Fifty in a row",
    desc: "Get fifty right in a row without a miss.",
    icon: "⛓️",
    measure: ({ buckets }) => ({ have: bestStreak(buckets), need: 50 }),
  },
  ...REGIONS.map((mode) => ({
    id: `clear-${mode.id}`,
    name: `All of ${mode.name}`,
    desc: `Find every country in ${mode.name}.`,
    icon: "📍",
    measure: ({ buckets }: PlayerHistory) => ({
      have: cleared(buckets, mode.id) ? 1 : 0,
      need: 1,
    }),
  })),
  {
    id: "clear-all-regions",
    name: "Continental",
    desc: "Clear all five continent maps.",
    icon: "🧭",
    measure: ({ buckets }) => ({
      have: REGIONS.filter((mode) => cleared(buckets, mode.id)).length,
      need: REGIONS.length,
    }),
  },
  {
    id: "clear-easy",
    name: "The whole world",
    desc: "Find every sovereign country in one round.",
    icon: "🏆",
    measure: ({ buckets }) => ({ have: cleared(buckets, "easy") ? 1 : 0, need: 1 }),
  },
  {
    id: "clear-hard",
    name: "Cartographer",
    desc: "Clear the full map — territories and all.",
    icon: "🗺️",
    measure: ({ buckets }) => ({ have: cleared(buckets, "hard") ? 1 : 0, need: 1 }),
  },
  {
    id: "speed-region",
    name: "Speed demon",
    desc: "Clear a continent in under two minutes.",
    icon: "⚡",
    measure: ({ buckets }) => {
      const quickest = REGIONS.map((mode) => fastestClear(buckets, mode.id))
        .filter((ms): ms is number => ms !== null)
        .sort((a, b) => a - b)[0];
      // Measured as "seconds under the bar", so the badge can show progress
      // rather than sitting at 0 until the moment it flips.
      return {
        have: quickest === undefined ? 0 : Math.max(0, 120 - Math.floor(quickest / 1000)),
        need: 1,
      };
    },
  },
  {
    id: "every-game-type",
    name: "Four ways round",
    desc: "Play all four game types.",
    icon: "🎲",
    measure: ({ buckets }) => ({ have: playedTypes(buckets).size, need: 4 }),
  },
  {
    id: "met-100",
    name: "Well travelled",
    desc: "Be asked about 100 different countries.",
    icon: "🧳",
    measure: ({ countries }) => ({ have: countries.length, need: 100 }),
  },
  {
    id: "met-all",
    name: "Nowhere left",
    desc: "Be asked about 167 different countries.",
    icon: "🌐",
    measure: ({ countries }) => ({ have: countries.length, need: 167 }),
  },
  {
    id: "sharp-eye",
    name: "Sharp eye",
    desc: "Reach 80% first-try accuracy over 100 countries.",
    icon: "🎯",
    measure: ({ countries }) => {
      const all = totals(countries);
      // Held back until there is enough history for the number to mean
      // something — three lucky answers is not 100% accuracy.
      return {
        have: all.seen >= 100 && all.accuracy !== null ? all.accuracy : 0,
        need: 80,
      };
    },
  },
  {
    id: "daily-7",
    name: "Week-long",
    desc: "Play the daily challenge seven days running.",
    icon: "🔥",
    measure: ({ dailyStreak }) => ({ have: dailyStreak, need: 7 }),
  },
  {
    id: "daily-30",
    name: "Regular",
    desc: "Play the daily challenge thirty days running.",
    icon: "📅",
    measure: ({ dailyStreak }) => ({ have: dailyStreak, need: 30 }),
  },
  {
    id: "daily-50",
    name: "Fifty dailies",
    desc: "Play fifty daily challenges, in a row or not.",
    icon: "🗓️",
    measure: ({ dailyPlayed }) => ({ have: dailyPlayed, need: 50 }),
  },
  {
    id: "sudden-death",
    name: "Nerves of steel",
    desc: "Reach a streak of 25 under sudden death.",
    icon: "💀",
    measure: ({ buckets }) => ({
      have: bestStreak(buckets.filter((b) => b.ruleset === "sudden")),
      need: 25,
    }),
  },
  {
    id: "blitz",
    name: "Against the clock",
    desc: "Score 2,000 points in a blitz round.",
    icon: "⏱️",
    measure: ({ buckets }) => ({
      have: buckets
        .filter((b) => b.ruleset === "blitz")
        .reduce(
          (best, b) =>
            b.runs.reduce((inner, run) => Math.max(inner, run.points ?? 0), best),
          0
        ),
      need: 2000,
    }),
  },
];

type Store = Record<string, string | undefined>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* badges are a nicety; the game plays without them */
  }
}

/** Reads the three stores the badges are measured against. */
export function collectHistory(): PlayerHistory {
  return {
    buckets: allBuckets(),
    countries: allCountries(),
    dailyStreak: streak(dayKey()),
    dailyPlayed: playedDays().length,
  };
}

/** Scores every achievement against a history. Pure — the tests drive this. */
export function evaluate(
  history: PlayerHistory,
  unlockedAt: Store = {}
): Earned[] {
  return ACHIEVEMENTS.map((achievement) => {
    const { have, need } = achievement.measure(history);
    return {
      ...achievement,
      have,
      need,
      unlocked: have >= need,
      at: unlockedAt[achievement.id] ?? null,
    };
  });
}

/**
 * Scores the badges and stamps anything newly earned with today's date.
 *
 * An achievement earned before badges existed gets stamped the first time the
 * page is opened rather than back-dated — the game never knew when it
 * happened, and inventing a date would be worse than admitting that.
 */
export function refresh(history = collectHistory()): Earned[] {
  const store = read();
  const earned = evaluate(history, store);
  const now = new Date().toISOString();
  let changed = false;

  for (const badge of earned) {
    if (badge.unlocked && !store[badge.id]) {
      store[badge.id] = now;
      badge.at = now;
      changed = true;
    }
  }
  if (changed) write(store);
  return earned;
}

/** How many are earned, for the line on the menu. */
export function tally(earned: Earned[]): { unlocked: number; total: number } {
  return {
    unlocked: earned.filter((badge) => badge.unlocked).length,
    total: earned.length,
  };
}

export function clearAchievements() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored means nothing to clear */
  }
}
