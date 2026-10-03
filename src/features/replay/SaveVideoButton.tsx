import { useState } from "react";
import type { Replay } from "../../lib/replay";
import { loadReplayAssets } from "../../lib/replayDraw";
import { makeReplayVideo, type MadeVideo } from "../../lib/replayVideo";
import { downloadFile, onComputer, shareCard } from "../../lib/shareCard";
import { playTap } from "../../lib/sound";
import { siteHost, siteUrl } from "../../lib/site";

/**
 * Makes the 9:16 video of a recording, then hands it to the share sheet —
 * Instagram, TikTok, YouTube — or saves it on a computer.
 *
 * On a phone, two taps: making the video takes a few seconds, and a phone
 * only opens the share sheet straight from a tap, not after a wait. So the
 * first tap makes it and the second sends it. On a computer, one: it is made
 * and saved to Downloads, ready to upload. (It used to offer the Mac's share
 * menu, which has no Save, so the video went nowhere.)
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
  const [state, setState] = useState<"idle" | "making" | "ready" | "sent" | "saved" | "failed">(
    "idle"
  );
  const computer = onComputer();
  const filename = (ext: string) => `worldguess-${replay.game.type}-${replay.game.mode}.${ext}`;
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
        site: siteHost(),
        onProgress: setProgress,
      });
      setVideo(made);
      if (computer) {
        setState(downloadFile(made.blob, filename(made.ext)) === "failed" ? "failed" : "saved");
      } else {
        setState("ready");
      }
    } catch {
      setState("failed");
    }
  };

  const send = async () => {
    if (!video) return;
    playTap();
    if (computer) {
      setState(downloadFile(video.blob, filename(video.ext)) === "failed" ? "failed" : "saved");
      return;
    }
    const name = filename(video.ext);
    const outcome = await shareCard(video.blob, {
      text: `My ${replay.game.label} run on WorldGuess. Your turn: ${siteUrl()}/`,
      filename: name,
    });
    setState(outcome === "failed" ? "failed" : "sent");
  };

  const base =
    "rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap";
  if (state === "saved") {
    return (
      <button onClick={send} className={`${base} border border-white/15 text-zinc-100 hover:bg-white/10 ${className}`}>
        ✓ In Downloads · Save again
      </button>
    );
  }
  if (state === "ready" || state === "sent") {
    return (
      <button onClick={send} className={`${base} bg-teal-300 text-teal-950 hover:bg-teal-200 ${className}`}>
        {state === "sent" ? "Share again" : "Video ready · Share"}
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
          : computer
            ? "Save video"
            : "Share video"}
    </button>
  );
}
