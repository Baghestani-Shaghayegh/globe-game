import { supabase } from "./supabase";
import { parseReplay, type Replay } from "./replay";

/**
 * Recordings on the leaderboard: posted against the run they're of, so the
 * board and the hall of fame can offer "Watch" beside a time.
 */

/** Posts a recording of the player's own run. True once it's up. */
export async function postReplay(
  scoreId: number,
  replay: Replay,
  player: string
): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return false;
  const { error } = await supabase.from("replays").insert({
    score_id: scoreId,
    user_id: userId,
    data: { ...replay, player },
  });
  // Posted already counts as posted: the button was pressed twice.
  return !error || error.code === "23505";
}

/** A posted recording, or null if there isn't one (or it won't read). */
export async function fetchReplay(scoreId: number): Promise<Replay | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("replays")
    .select("data")
    .eq("score_id", scoreId)
    .maybeSingle();
  if (error || !data) return null;
  return parseReplay((data as { data: unknown }).data);
}
