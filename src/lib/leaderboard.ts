import { supabase } from "./supabase";

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
  return !error;
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
