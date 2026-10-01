import { useEffect, useMemo, useRef, useState } from "react";
import type { Replay } from "../../lib/replay";
import { clock, frameAt } from "../../lib/replayFrame";
import { drawFrame, loadReplayAssets, type ReplayAssets } from "../../lib/replayDraw";
import { playTap } from "../../lib/sound";
import SaveVideoButton from "./SaveVideoButton";

const SPEEDS = [1, 2, 4] as const;

/**
 * Plays a recording back: the globe turning as the player turned it, each
 * click, each answer, the clock and the score. Scrub to any moment, or
 * speed it up; and save it as a video from here.
 */
export default function ReplayViewer({
  replay,
  player,
  onClose,
}: {
  replay: Replay;
  player?: string;
  onClose?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<ReplayAssets | null>(null);
  const [failed, setFailed] = useState(false);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(
    // A long round starts sped up; nobody watches three minutes at 1×.
    replay.result.ms > 90_000 ? 4 : replay.result.ms > 40_000 ? 2 : 1
  );
  const end = replay.result.ms + 2500;
  const who = player ?? replay.player;

  useEffect(() => {
    let cancelled = false;
    loadReplayAssets(replay)
      .then((a) => !cancelled && setAssets(a))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [replay]);

  // The clock: advances while playing, at the chosen speed.
  useEffect(() => {
    if (!playing || !assets) return;
    let last = performance.now();
    let id = requestAnimationFrame(function step(now) {
      const dt = (now - last) * speed;
      last = now;
      setT((prev) => {
        const next = Math.min(end, prev + dt);
        if (next >= end) setPlaying(false);
        return next;
      });
      id = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(id);
  }, [playing, speed, assets, end]);

  const frame = useMemo(() => frameAt(replay, t), [replay, t]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !assets) return;
    drawFrame(ctx, frame, replay, assets, {
      width: el.width,
      height: el.height,
      player: who,
      site: window.location.host,
    });
  }, [frame, replay, assets, who]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-[9/16] h-[min(70dvh,calc((100vw-2rem)*16/9))] overflow-hidden rounded-2xl border border-white/10 bg-[#07111c]">
        <canvas ref={canvas} width={720} height={1280} className="h-full w-full" />
        {!assets && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            {failed ? "Couldn't load the map." : "Loading the replay…"}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-sm items-center gap-3">
        <button
          onClick={() => {
            playTap();
            if (t >= end) setT(0);
            setPlaying((p) => !p || t >= end);
          }}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-300 text-teal-950"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={end}
          step={50}
          value={t}
          onChange={(e) => {
            setT(Number(e.target.value));
          }}
          aria-label="Position in the replay"
          className="min-w-0 flex-1 accent-teal-300"
        />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-400">
          {clock(Math.min(t, replay.result.ms))}
        </span>
        <button
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          aria-label="Playback speed"
          className="w-11 shrink-0 rounded-md border border-white/15 py-1 text-xs tabular-nums text-zinc-200 hover:bg-white/10"
        >
          {speed}×
        </button>
      </div>

      <div className="flex w-full max-w-sm gap-2">
        <SaveVideoButton replay={replay} player={who} className="flex-1" />
        {onClose && (
          <button
            onClick={() => {
              playTap();
              onClose();
            }}
            className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-300 transition-colors hover:text-zinc-100"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
