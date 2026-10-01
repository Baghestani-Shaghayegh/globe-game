import { useState } from "react";
import type { Replay } from "../../lib/replay";
import { loadReplayAssets } from "../../lib/replayDraw";
import { makeReplayVideo, type MadeVideo } from "../../lib/replayVideo";
import { shareCard } from "../../lib/shareCard";
import { playTap } from "../../lib/sound";

/**
 * Makes the 9:16 video of a recording, then hands it to the share sheet —
 * Instagram, TikTok, YouTube — or saves it on a computer.
 *
 * Two taps, not one: making the video takes a few seconds, and a phone only
 * opens the share sheet straight from a tap, not after a wait. So the first
 * tap makes it and the second sends it.
 */
export default function SaveVideoButton({
  replay,
  player,
  className = "",
}: {
  replay: Replay;
  player?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "making" | "ready" | "sent" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<MadeVideo | null>(null);

  const make = async () => {
    playTap();
    setState("making");
    setProgress(0);
    try {
      const assets = await loadReplayAssets(replay);
      const made = await makeReplayVideo(replay, assets, {
        player,
        site: window.location.host,
        onProgress: setProgress,
      });
      setVideo(made);
      setState("ready");
    } catch {
      setState("failed");
    }
  };

  const send = async () => {
    if (!video) return;
    playTap();
    const name = `worldguess-${replay.game.type}-${replay.game.mode}.${video.ext}`;
    const outcome = await shareCard(video.blob, {
      text: `My ${replay.game.label} run on WorldGuess. Can you beat it? ${window.location.origin}`,
      filename: name,
    });
    setState(outcome === "failed" ? "failed" : "sent");
  };

  const base =
    "rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap";
  if (state === "ready" || state === "sent") {
    return (
      <button onClick={send} className={`${base} bg-teal-300 text-teal-950 hover:bg-teal-200 ${className}`}>
        {state === "sent" ? "Share again" : "Share video"}
      </button>
    );
  }
  return (
    <button
      onClick={make}
      disabled={state === "making"}
      className={`${base} border border-white/15 text-zinc-100 hover:bg-white/10 ${className}`}
    >
      {state === "making"
        ? `Making video… ${Math.round(progress * 100)}%`
        : state === "failed"
          ? "Couldn't make it"
          : "Save as video"}
    </button>
  );
}
