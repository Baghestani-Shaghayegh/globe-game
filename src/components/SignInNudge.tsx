import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { streak } from "../lib/daily";
import { accountsEnabled } from "../lib/supabase";

/** Days in a row before a result counts as one worth keeping. */
const STREAK_TO_NUDGE = 3;

/**
 * One line under a finished daily, for a player on a streak whose runs aren't
 * reaching the board.
 *
 * It says only what signing in does today: scores land on the leaderboard and
 * replays can be posted. Streaks and badges are read from this browser's own
 * history and don't travel with an account, so promising them on another
 * device would be wrong. Nothing shows for a signed-in, named player, nor
 * before the first streak: asking someone to sign up after a single round is
 * asking before there's a reason.
 */
export default function SignInNudge() {
  const { session, profile, loading } = useAuth();
  const days = useMemo(() => streak(), []);

  if (!accountsEnabled || loading || profile || days < STREAK_TO_NUDGE) return null;

  return (
    <p className="pointer-events-auto mt-3 text-center text-xs text-zinc-500">
      {days} days running.{" "}
      <Link
        to="/account"
        className="text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
      >
        {session ? "Pick a name" : "Sign in"}
      </Link>{" "}
      {session ? "and your runs land on the leaderboard." : "to put your runs on the leaderboard."}
    </p>
  );
}
