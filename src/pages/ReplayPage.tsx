import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageShell } from "../components/SiteHeader";
import { gamePath, type GameType } from "../data/modes";
import { fetchReplay } from "../lib/replayStore";
import type { Replay } from "../lib/replay";
import { playTap } from "../lib/sound";
import ReplayViewer from "../features/replay/ReplayViewer";

/**
 * A posted run, to watch: what "Watch" on the hall of fame and the boards
 * opens. A link to it can be sent on, like a challenge.
 */
export default function ReplayPage() {
  const id = Number(useParams().id);
  const [replay, setReplay] = useState<Replay | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isInteger(id) || id <= 0) {
      setReplay(null);
      return;
    }
    fetchReplay(id)
      .then((r) => !cancelled && setReplay(r))
      .catch(() => !cancelled && setReplay(null));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <PageShell>
      <div className="mx-auto flex max-w-xl flex-col items-center">
        {replay === undefined && <p className="mt-16 text-zinc-500">Loading the run…</p>}
        {replay === null && (
          <div className="mt-16 text-center">
            <p className="text-zinc-200">No replay here.</p>
            <Link to="/leaderboard" className="mt-2 inline-block text-sm text-teal-300 underline underline-offset-4">
              Leaderboard
            </Link>
          </div>
        )}
        {replay && (
          <>
            <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight text-zinc-50">
              {replay.player ? `${replay.player}'s run` : "A run"}
            </h1>
            <p className="mb-4 mt-1 text-sm text-zinc-500">{replay.game.label}</p>
            <ReplayViewer replay={replay} />
            <Link
              to={gamePath(replay.game.type as GameType, replay.game.mode, null, "relaxed", null)}
              onClick={playTap}
              className="mt-5 rounded-full bg-teal-300 px-6 py-2.5 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
            >
              Play this round →
            </Link>
          </>
        )}
      </div>
    </PageShell>
  );
}
