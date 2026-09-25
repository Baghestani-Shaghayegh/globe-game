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
 * Contested in Find it alone. Every game type used to count, which sounded
 * generous and was not: you are told the name and you click it, with no typing
 * and no shape to recognise, so Find it is quicker than the rest by a margin
 * no amount of skill at Outlines makes up. The crown went to whoever picked
 * the fastest format, and the other five were decoration. The five formats
 * already have crowns of their own, at world scale.
 */
export const CROWN_REGIONS = MODES.filter((mode) => mode.regional);

/**
 * The one game type a crown over a partial or extended list is raced in.
 *
 * Find it beats the other five by a margin no amount of skill closes: you are
 * told the name and you click it, with no typing and no shape to recognise. A
 * crown open to every format is not generous, it is a crown that silently only
 * counts this one — so the ones that would have spanned say so instead. The
 * six world crowns keep a format each, where the whole 167-country list makes
 * each worth contesting on its own.
 */
export const REGION_TYPE: GameType = "find";

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

/**
 * What the holder had to do, for the line under the title.
 *
 * Each of these used to end ", fastest" — eight lines, eight commas, eight
 * times the same adverb, saying what the row underneath already says in a
 * stopwatch: RECORD 8:32. Without it they read as the thing you are being
 * asked to go and do, which is what a card with "Claim it" on it wants.
 */
const FEATS: Record<GameType, string> = {
  name: "Name every country",
  find: "Find every country",
  flag: "Match every flag",
  capital: "Place every capital",
  outline: "Know every outline",
  famous: "Solve every clue",
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
  }));

  // The biggest thing anybody can do in this game, and it had no crown at all.
  // One format, like the continents, and for the same reason.
  const fullMap: Crown = {
    id: "hard",
    tier: "world",
    metric: "time",
    title: "King of the Full Map",
    feat: "Find the full map, including territories",
    buckets: [crownBucket(REGION_TYPE, "hard")],
    holder: null,
  };

  const regions: Crown[] = CROWN_REGIONS.map((mode) => ({
    id: mode.id,
    tier: "region" as const,
    metric: "time" as const,
    // The same title the world crowns carry, so the two shelves read as one
    // set rather than trophies and report lines.
    title: `King of ${named(mode.name)}`,
    feat: `Find every country in ${named(mode.name)}`,
    buckets: [crownBucket(REGION_TYPE, mode.id)],
    holder: null,
  }));

  // The one crown that is not a stopwatch. No buckets: it is contested
  // everywhere at once, and its own function finds it.
  const streak: Crown = {
    id: "streak",
    tier: "streak",
    metric: "streak",
    title: "Streak King",
    feat: "Get the most right in a row, without a miss",
    buckets: [],
    holder: null,
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

  return catalogue.map((crown) => ({
    ...crown,
    holder:
      crown.metric === "streak" ? longest : (held.get(crown.buckets[0]) ?? null),
  }));
}
