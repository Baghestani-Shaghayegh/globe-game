import { supabase } from "./supabase";
import {
  BUCKET_PREFIX,
  GAME_TYPES,
  MODES,
  type GameType,
} from "../data/modes";

/**
 * Crowns: one holder each, for the fastest complete run over the whole map.
 *
 * The ordinary leaderboard answers "who scored most this week". This answers
 * something else, and something people will actually brag about: who can name
 * every country on earth, faster than anyone else has. One name, held until
 * somebody beats it.
 *
 * All time, not weekly. The weekly reset exists so the board cannot freeze at
 * the top and put new players off — but a hall of fame that clears every
 * Monday is not a hall of fame, and holding a record you keep is the whole
 * appeal. The two boards are answering different questions, so they reset on
 * different clocks.
 */

/**
 * The bucket a crown is contested in: the full countries list, untimed,
 * relaxed rules, one bucket per game type.
 *
 * Deliberately exact keys rather than a pattern. `recordKey` appends `@300`
 * for a time limit and `#10` for a short round, so an exact match is what
 * keeps a five-second sprint over ten countries out of a contest about all
 * hundred and sixty-seven. It is also what stops a blitz or sudden-death run,
 * which carry their own prefixes, from being compared against a relaxed one.
 */
export const CROWN_RUN = {
  mode: "easy",
  limit: null,
  rules: "relaxed",
  count: null,
} as const;

export function crownBucket(type: GameType, mode: string = CROWN_RUN.mode): string {
  return BUCKET_PREFIX[type] + mode;
}

/**
 * The five continents, contested in any game type.
 *
 * The world crowns are the headline and they are also, for almost everybody, a
 * wall: a hundred and sixty-seven countries in one sitting is not a thing a
 * new player is going to do this week, so a hall of six of them is six things
 * you cannot have. These are the same idea at a size somebody might actually
 * reach — Oceania is fourteen countries — and they are what gives the page a
 * bottom rung.
 *
 * Any game type counts. A player will pick whichever they are quickest at,
 * which is the point: the record is the continent, not the format.
 */
export const CROWN_REGIONS = MODES.filter((mode) => mode.regional);

/**
 * The smallest `total` a run may claim and still be considered whole.
 *
 * A floor rather than the exact list size: the real count comes from the map
 * data, which this page has no reason to load, and the bucket key already
 * carries a short round's length (`europe#10`) so it cannot be compared with a
 * full one. This is only here to reject a forged total.
 */
const FLOORS: Record<string, number> = {
  easy: 100,
  // The full map is the bigger list — territories, islands, disputed regions —
  // so its floor sits above the countries-only one.
  hard: 150,
  europe: 30,
  africa: 35,
  asia: 30,
  americas: 22,
  oceania: 10,
};

export type Crown = {
  /** Unique across the shelves: a game type, a mode id, or the streak's own. */
  id: string;
  /** Which shelf it sits on. */
  tier: "world" | "region" | "streak";
  /** What the record is measured in. */
  metric: "time" | "streak";
  /** The title, for the card. */
  title: string;
  /** What the holder had to do, under the title. */
  feat: string;
  /** Every bucket this crown is contested in — one for the world, six for a region. */
  buckets: string[];
  /** Who holds it, or null while nobody has finished a full run. */
  holder: CrownHolder | null;
  /** Which game type the holder set it in, where a crown spans several. */
  heldIn: GameType | null;
};

export type CrownHolder = {
  bucket: string;
  /** Only on the streak crown; null on every run posted before it existed. */
  best_streak?: number | null;
  user_id: string;
  username: string;
  country: string | null;
  ms: number;
  found: number;
  total: number;
  played_at: string;
};

/**
 * What each crown is called.
 *
 * Sara picked these. They are not one pattern — three kings and three
 * nicknames — and that is the point: "King of the Globe" is a thing somebody
 * would say out loud about themselves, which a tidier "World Namer" is not.
 * A hall of fame is allowed a bit of swagger.
 *
 * The one that changed is the find crown. It was "Pathfinder", which is a
 * person who finds paths; this is the game that names a country and asks you
 * to go and find it, which the daily already calls a Country hunt.
 */
const TITLES: Record<GameType, string> = {
  name: "King of the Globe",
  find: "Country Hunter",
  flag: "King of Flags",
  capital: "Capital King",
  outline: "Shape Reader",
  famous: "Clue Solver",
};

/** What the holder had to do, for the line under the title. */
const FEATS: Record<GameType, string> = {
  name: "Named every country, fastest",
  find: "Found every country, fastest",
  flag: "Matched every flag, fastest",
  capital: "Placed every capital, fastest",
  outline: "Knew every outline, fastest",
  famous: "Solved every clue, fastest",
};

export function crownTitle(type: GameType): string {
  return TITLES[type];
}

export function crownFeat(type: GameType): string {
  return FEATS[type];
}

/** Europe, but the Americas. */
function named(region: string): string {
  return region.endsWith("s") ? `the ${region}` : region;
}

/** Every crown, in the order the page shows them. */
export const CROWN_TYPES: GameType[] = GAME_TYPES.map((option) => option.id);

/**
 * The catalogue: six world crowns, then five continents.
 *
 * Built rather than written out, so a new game type or a sixth continent
 * arrives on the wall without anybody remembering to add it here.
 */
export function crownCatalogue(): Crown[] {
  const world: Crown[] = CROWN_TYPES.map((type) => ({
    id: type,
    tier: "world" as const,
    metric: "time" as const,
    title: TITLES[type],
    feat: FEATS[type],
    buckets: [crownBucket(type)],
    holder: null,
    heldIn: null,
  }));

  // The biggest thing anybody can do in this game, and it had no crown at all.
  // Any game type, like the continents: six more cards for one list would make
  // the shelf longer than it is interesting.
  const fullMap: Crown = {
    id: "hard",
    tier: "world",
    metric: "time",
    title: "King of the Full Map",
    feat: "Cleared every place on earth — territories and all",
    buckets: CROWN_TYPES.map((type) => crownBucket(type, "hard")),
    holder: null,
    heldIn: null,
  };

  const regions: Crown[] = CROWN_REGIONS.map((mode) => ({
    id: mode.id,
    tier: "region" as const,
    metric: "time" as const,
    // The same title the world crowns carry, so the two shelves read as one
    // set rather than trophies and report lines.
    title: `King of ${named(mode.name)}`,
    feat: `Cleared ${named(mode.name)}, quicker than anyone`,
    // Any game type: the record is the continent, not the format.
    buckets: CROWN_TYPES.map((type) => crownBucket(type, mode.id)),
    holder: null,
    heldIn: null,
  }));

  // The one crown that is not a stopwatch. No buckets: it is contested
  // everywhere at once, and its own function finds it.
  const streak: Crown = {
    id: "streak",
    tier: "streak",
    metric: "streak",
    title: "Streak King",
    feat: "The longest run of right answers, without a miss",
    buckets: [],
    holder: null,
    heldIn: null,
  };

  return [...world, fullMap, ...regions, streak];
}

/**
 * Reads the holders.
 *
 * Two round trips at most, in parallel: one that finds the fastest run in each
 * of the buckets a timed crown is contested in, and one that finds the single
 * longest streak anybody has posted anywhere. The page shows them together,
 * and a card that pops in after the others is worse than all of them arriving
 * a moment later.
 */
export async function crowns(): Promise<Crown[]> {
  const catalogue = crownCatalogue();
  if (!supabase) return catalogue;

  const boards = catalogue.flatMap((crown) => crown.buckets);
  const [timed, streak] = await Promise.all([
    supabase.rpc("crowns", {
      boards,
      // Matched to `boards` by position. The mode is the tail of the bucket,
      // after whatever prefix the game type put on the front.
      min_totals: boards.map((bucket) => {
        const mode = bucket.includes(":") ? bucket.split(":")[1] : bucket;
        return FLOORS[mode] ?? 100;
      }),
    }),
    supabase.rpc("streak_crown"),
  ]);
  if (timed.error) throw timed.error;
  if (streak.error) throw streak.error;

  const held = new Map<string, CrownHolder>();
  for (const row of (timed.data ?? []) as CrownHolder[]) held.set(row.bucket, row);
  const longest = ((streak.data ?? []) as CrownHolder[])[0] ?? null;

  return catalogue.map((crown) => {
    if (crown.metric === "streak") {
      return { ...crown, holder: longest, heldIn: null };
    }

    let best: CrownHolder | null = null;
    let heldIn: GameType | null = null;

    crown.buckets.forEach((bucket, index) => {
      const row = held.get(bucket);
      if (!row) return;
      // A tie goes to whoever set it first, the same rule the SQL uses within
      // a single bucket — so a record has to be beaten, not matched.
      if (best === null || row.ms < best.ms) {
        best = row;
        heldIn = CROWN_TYPES[index] ?? null;
      }
    });

    return { ...crown, holder: best, heldIn };
  });
}
