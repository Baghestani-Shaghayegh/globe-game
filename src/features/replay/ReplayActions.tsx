import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../account/AuthProvider";
import type { Replay } from "../../lib/replay";
import { postReplay } from "../../lib/replayStore";
import { playTap } from "../../lib/sound";
import ReplayViewer from "./ReplayViewer";

/**
 * Under a finished round: watch it back (and save it as a video from
 * there), and post it to the leaderboard so others can watch it beside the
 * time — the hall of fame shows the run, not just the record.
 */
export default function ReplayActions({
  replay,
  postedId,
}: {
  replay: Replay;
  /** The run's id on the board, once posted; null if it wasn't. Left out for a
   * game with no board, which is watched and saved but not posted. */
  postedId?: () => Promise<number | null>;
}) {
  const { profile, session } = useAuth();
  const [watching, setWatching] = useState(false);
  const [scoreId, setScoreId] = useState<number | null | undefined>(undefined);
  const [state, setState] = useState<"idle" | "posting" | "posted" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;
    void (postedId?.() ?? Promise.resolve(null)).then((id) => {
      if (!cancelled) setScoreId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [postedId]);

  const post = async () => {
    if (!scoreId || !profile) return;
    playTap();
    setState("posting");
    const ok = await postReplay(scoreId, replay, profile.username);
    setState(ok ? "posted" : "failed");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-rose-300">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-rose-400" />
          Recorded
        </span>
        <button
          onClick={() => {
            playTap();
            setWatching(true);
          }}
          className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-100 transition-colors hover:bg-white/10"
        >
          ▶ Watch
        </button>
        {scoreId && (
          <button
            onClick={post}
            disabled={state === "posting" || state === "posted"}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-100 transition-colors hover:bg-white/10 disabled:opacity-70"
          >
            {state === "posted"
              ? "✓ On the board"
              : state === "posting"
                ? "Posting…"
                : state === "failed"
                  ? "Try again"
                  : "Put on the board"}
          </button>
        )}
      </div>

      {/* Only a run that has a board to go on asks for a sign-in. On a line of
          its own, under the row: beside Watch it read as a third button. */}
      {!scoreId && postedId && !session && (
        <Link
          to="/account"
          className="mt-2 inline-block text-xs text-zinc-400 underline underline-offset-4 hover:text-zinc-100"
        >
          Sign in to put it on the board
        </Link>
      )}

      {watching &&
        createPortal(
          <div
            role="dialog"
            aria-label="Replay"
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-page/95 p-4"
          >
            <ReplayViewer replay={replay} onClose={() => setWatching(false)} />
          </div>,
          document.body
        )}
    </>
  );
}
