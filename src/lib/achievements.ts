import { allBuckets, isComplete, type Bucket, type Run } from "./records";
import { allCountries, totals, type CountryRow } from "./countryStats";
import { dayKey, perfectDays, playedDays, streak } from "./daily";
import { GAME_TYPES, MODES, type GameType } from "../data/modes";

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
  /** Dailies finished with nothing missed. */
  dailyPerfect: number;
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

/**
 * The buckets that hold whole-map rounds of a mode.
 *
 * `count === null` is the "Everything" round length, and the filter is the
 * whole point: a round is stored with the number of countries it asked for,
 * so a ten-country round of the world map files a run of 10 found out of 10
 * — complete, by every measure the records keep. Without this, the default
 * round length earned "Find every sovereign country in one round" on the
 * first go, and the continent badges with it.
 */
function wholeMap(buckets: Bucket[], modeId: string): Bucket[] {
  return buckets.filter(
    (bucket) => bucket.modeId === modeId && bucket.count === null
  );
}

/** Whether a mode's whole map has ever been cleared, in any game type. */
function cleared(buckets: Bucket[], modeId: string): boolean {
  return wholeMap(buckets, modeId).some((bucket) => bucket.runs.some(isComplete));
}

/** The quickest full clear of a mode, or null if it has never been finished. */
function fastestClear(buckets: Bucket[], modeId: string): number | null {
  const times = wholeMap(buckets, modeId).flatMap((bucket) =>
    bucket.runs.filter(isComplete).map((run) => run.ms)
  );
  return times.length ? Math.min(...times) : null;
}

/** Every run on file, whatever mode, length or ruleset it was played under. */
function allRuns(buckets: Bucket[]): Run[] {
  return buckets.flatMap((bucket) => bucket.runs);
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
    // Counted off GAME_TYPES rather than a number written here. It said four
    // when there were six: Famous, Outline and Capital arrived after the
    // badge did, and a badge that can be earned without touching two of the
    // things it names is worse than no badge.
    id: "every-game-type",
    name: "Every way round",
    desc: `Play all ${GAME_TYPES.length} game types.`,
    icon: "🎲",
    measure: ({ buckets }) => ({
      have: playedTypes(buckets).size,
      need: GAME_TYPES.length,
    }),
  },
  {
    id: "flawless",
    name: "Flawless",
    desc: "Finish a round of 25 or more without a single miss.",
    icon: "💎",
    measure: ({ buckets }) => ({
      // A run whose best streak covers the whole round never broke it. The
      // records keep the streak but not the misses, so this is the one way
      // to read a perfect round off history that already exists.
      have: allRuns(buckets).reduce(
        (best, run) =>
          run.total >= 25 && (run.bestStreak ?? 0) >= run.total
            ? Math.max(best, run.total)
            : best,
        0
      ),
      need: 25,
    }),
  },
  {
    id: "big-round",
    name: "Big round",
    desc: "Score 5,000 points in a single round.",
    icon: "📈",
    measure: ({ buckets }) => ({
      have: allRuns(buckets).reduce((best, run) => Math.max(best, run.points ?? 0), 0),
      need: 5000,
    }),
  },
  {
    id: "rounds-100",
    name: "Hundred rounds",
    desc: "Play a hundred rounds.",
    icon: "💯",
    measure: ({ buckets }) => ({ have: allRuns(buckets).length, need: 100 }),
  },
  // There were two more here — a streak under Sudden death, and a score under
  // Blitz. Both rulesets are still implemented and still honoured by a link
  // that carries `?rules=`, but the control that set them went with the
  // "Customize round" panel in a444ad9, so nothing in the game can reach
  // either one. A badge nobody can earn is worse than a badge that is merely
  // hard. They come back with the control, not before it.
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
    id: "daily-perfect",
    name: "Clean sweep",
    desc: "Finish a daily challenge with nothing missed.",
    icon: "✨",
    measure: ({ dailyPerfect }) => ({ have: dailyPerfect, need: 1 }),
  },
  {
    id: "daily-50",
    name: "Fifty dailies",
    // The two badges above it want days running, so this one has to say that
    // it doesn't. "In a row or not" said so at the cost of reading like a
    // riddle.
    desc: "Play fifty daily challenges in total — no streak needed.",
    icon: "🗓️",
    measure: ({ dailyPlayed }) => ({ have: dailyPlayed, need: 50 }),
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
    dailyPerfect: perfectDays(),
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
