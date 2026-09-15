import { supabase } from "./supabase";
import { BUCKET_PREFIX, GAME_TYPES, type GameType } from "../data/modes";

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

export function crownBucket(type: GameType): string {
  return BUCKET_PREFIX[type] + CROWN_RUN.mode;
}

export type Crown = {
  type: GameType;
  /** The title, for the card. */
  title: string;
  /** Who holds it, or null while nobody has finished a full run. */
  holder: CrownHolder | null;
};

export type CrownHolder = {
  bucket: string;
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
 * The globe one carries the weight — it is the headline, and the reason
 * anybody grinds a hundred and sixty-seven countries in one sitting. The rest
 * are named in the same shape so the set reads as one idea rather than one
 * trophy and five also-rans.
 */
const TITLES: Record<GameType, string> = {
  name: "King of the Globe",
  find: "Pathfinder",
  flag: "King of Flags",
  capital: "Capital King",
  outline: "Shape Reader",
  famous: "Know-it-all",
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

/** Every crown, in the order the page shows them. */
export const CROWN_TYPES: GameType[] = GAME_TYPES.map((option) => option.id);

/**
 * Reads the holders.
 *
 * One round trip for all six rather than six boards fetched separately: the
 * page shows them together, and a card that pops in after the others is worse
 * than all of them arriving a moment later.
 */
export async function crowns(): Promise<Crown[]> {
  const empty = CROWN_TYPES.map((type) => ({
    type,
    title: TITLES[type],
    holder: null,
  }));
  if (!supabase) return empty;

  const { data, error } = await supabase.rpc("crowns", {
    boards: CROWN_TYPES.map(crownBucket),
  });
  if (error) throw error;

  const held = new Map<string, CrownHolder>();
  for (const row of (data ?? []) as CrownHolder[]) held.set(row.bucket, row);

  return CROWN_TYPES.map((type) => ({
    type,
    title: TITLES[type],
    holder: held.get(crownBucket(type)) ?? null,
  }));
}
