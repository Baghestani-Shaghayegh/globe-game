import { supabase } from "./supabase";
import {
  GAME_TYPES,
  MODES,
  TIME_LIMITS,
  modeIdFromBucket,
  typeFromBucket,
} from "../data/modes";

/** A player's best run in one bucket, as a board shows it. */
export type BoardRow = {
  rank: number;
  user_id: string;
  username: string;
  country: string | null;
  points: number;
  found: number;
  total: number;
  ms: number;
  played_at: string;
};

/** What a finished round posts. The clock is the server's to set. */
export type PostedRun = {
  points: number;
  found: number;
  total: number;
  ms: number;
};

/**
 * Monday 00:00 UTC of the week a moment falls in.
 *
 * A weekly reset is the point of the board: an all-time table freezes at the
 * top and new players stop trying. UTC so everyone's week turns over together,
 * the same way the daily challenge does.
 */
export function weekStart(at: Date = new Date()): Date {
  const start = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
  );
  // getUTCDay() is 0 on Sunday, which belongs to the week that began 6 days ago.
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

/** Midnight UTC of the day a moment falls in — the daily challenge's window. */
export function dayStart(at: Date = new Date()): Date {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
  );
}

/** Midnight UTC on the first of the month a moment falls in. */
export function monthStart(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

/**
 * A board's window, and the window before it.
 *
 * The board is ranked over `since`. The pair before it is what "#10 last week"
 * is measured against — the same length of time, ending where this one starts.
 * Both are sent to the database rather than worked out there, because only the
 * client knows which board is being looked at.
 */
export type Period = {
  id: "week" | "month";
  label: string;
  since: Date;
  prevSince: Date;
  prevUntil: Date;
  /** What the chip on a row calls the period before, e.g. "last week". */
  prevLabel: string;
};

export function weekPeriod(at: Date = new Date()): Period {
  const since = weekStart(at);
  const prevSince = new Date(since);
  prevSince.setUTCDate(prevSince.getUTCDate() - 7);
  return {
    id: "week",
    label: "This week",
    since,
    prevSince,
    prevUntil: since,
    prevLabel: "last week",
  };
}

export function monthPeriod(at: Date = new Date()): Period {
  const since = monthStart(at);
  const prevSince = new Date(
    Date.UTC(since.getUTCFullYear(), since.getUTCMonth() - 1, 1)
  );
  return {
    id: "month",
    label: "This month",
    since,
    prevSince,
    prevUntil: since,
    prevLabel: "last month",
  };
}

/** How much of the week is left, for the "resets in" line under a board. */
export function untilWeekEnd(at: Date = new Date()): string {
  const end = weekStart(at).getTime() + 7 * 24 * 60 * 60 * 1000;
  const hours = Math.max(0, Math.floor((end - at.getTime()) / 3_600_000));
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  if (hours >= 24) return "1 day";
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/**
 * Files a finished run on the board.
 *
 * Fire-and-forget on purpose: a player who isn't signed in, hasn't named
 * themselves, or is offline still finished their round, and the local record
 * is already saved either way. Returns whether it landed, for tests.
 */
export async function postScore(
  bucket: string,
  run: PostedRun
): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return false;

  const { error } = await supabase.from("scores").insert({
    user_id: userId,
    bucket,
    points: Math.round(run.points),
    found: Math.round(run.found),
    total: Math.round(run.total),
    ms: Math.round(run.ms),
  });

  // Callers deliberately don't await this — a summary screen should never wait
  // on the network, and the run is saved locally either way. That silence hid
  // a real failure once: a database check rejected every bucket key carrying a
  // round length, so menu rounds quietly stopped reaching the board and
  // nothing anywhere said so. In development, say so.
  if (error && import.meta.env.DEV) {
    console.warn(`Score not posted for bucket "${bucket}":`, error.message);
  }
  return !error;
}

/** A player's standing on the overall board. */
export type OverallRow = {
  /**
   * Shared on a tie: two players on the same points are both 2nd, and the
   * next one down is 4th. Fewer runs decides which of them prints first, not
   * which of them is ranked higher.
   */
  rank: number;
  user_id: string;
  username: string;
  country: string | null;
  points: number;
  runs: number;
  best_run: number;
  last_played: string;
  /** Where they finished the period before, or null if they weren't playing. */
  prev_rank: number | null;
  /** How many players are on this board, not how many rows came back. */
  players: number;
};

/** A per-bucket board that actually has someone on it. */
export type ActiveBoard = {
  bucket: string;
  players: number;
  runs: number;
  top_points: number;
};

/**
 * The board everyone lands on: total points across everything played.
 *
 * The per-bucket boards can only be empty or nearly so until the game has a
 * crowd, and an empty leaderboard reads as a dead game. This one has someone on
 * it as soon as anyone has played at all.
 */
export async function overallTop(
  period: Period,
  limit = 40,
  offset = 0
): Promise<OverallRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("overall_leaderboard", {
    since: period.since.toISOString(),
    limit_to: limit,
    prev_since: period.prevSince.toISOString(),
    prev_until: period.prevUntil.toISOString(),
    offset_by: offset,
  });
  if (error) throw error;
  return (data ?? []) as OverallRow[];
}

/**
 * The signed-in player's own place, however far down it is.
 *
 * The board shows one page of it, so a player in 341st would otherwise open
 * the page and find nothing about themselves on it at all. Null when nobody is
 * signed in, or when they haven't scored in this period.
 *
 * This used to be `overall_leaderboard` asked for 100000 rows and filtered to
 * the caller — but that function clamps its limit to 100, so the row went
 * missing for anyone past 100th, which is exactly who it exists for. The
 * function now ranks without a limit and filters after ranking.
 */
export async function myStanding(period: Period): Promise<OverallRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("my_overall_standing", {
    since: period.since.toISOString(),
    prev_since: period.prevSince.toISOString(),
    prev_until: period.prevUntil.toISOString(),
  });
  if (error) throw error;
  return ((data ?? [])[0] as OverallRow | undefined) ?? null;
}

/** Which per-bucket boards are worth listing, busiest first. */
export async function activeBoards(since: Date | null): Promise<ActiveBoard[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("active_boards", {
    since: since ? since.toISOString() : null,
  });
  if (error) throw error;
  return (data ?? []) as ActiveBoard[];
}

/** One board, best-first. `since` null is all time. */
export async function topScores(
  bucket: string,
  since: Date | null,
  limit = 20
): Promise<BoardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("leaderboard", {
    board: bucket,
    since: since ? since.toISOString() : null,
    limit_to: limit,
  });
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}

/**
 * Reads a stored bucket key back into words — "Flags · Europe · 3 min ·
 * Sudden death". The key is the game's own `recordKey`, so this is that
 * function run backwards, and it has to cope with keys written by older
 * versions of the game.
 */
export function describeBucket(bucket: string): string {
  const [withoutCount, count] = bucket.split("#");
  const [head, limit] = withoutCount.split("@");
  const ruleset = head.startsWith("sudden:")
    ? "Sudden death"
    : head.startsWith("blitz:")
      ? "Blitz"
      : null;
  const withoutRules = head.replace(/^(sudden|blitz):/, "");
  const type = typeFromBucket(withoutRules);
  const typeLabel = GAME_TYPES.find((t) => t.id === type)?.label ?? type;
  const modeId = modeIdFromBucket(withoutRules);

  const modeName =
    modeId === "daily"
      ? "Daily"
      : (MODES.find((mode) => mode.id === modeId)?.name ?? modeId);

  const clock = limit
    ? (TIME_LIMITS.find((option) => option.seconds === Number(limit))?.label ??
      `${limit}s`)
    : null;

  const length = count ? `${count} countries` : null;

  return [typeLabel, modeName, length, clock, ruleset]
    .filter(Boolean)
    .join(" · ");
}

/** Whether a bucket is one of the daily challenge's. */
export function isDailyBucket(bucket: string): boolean {
  return bucket
    .split("#")[0]
    .split("@")[0]
    .replace(/^(sudden|blitz):/, "")
    .endsWith("daily");
}
