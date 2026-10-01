import type { Replay } from "./replay";
import { frameAt } from "./replayFrame";
import { drawFrame, type ReplayAssets } from "./replayDraw";

/**
 * A recording turned into a 9:16 video for a story, a TikTok or a Short.
 *
 * Drawn frame by frame and encoded by the browser (WebCodecs, via
 * Mediabunny), so it's made faster than it plays and needs no server. Long
 * rounds are sped up to fit: a story is watched in seconds, and three
 * minutes of clicking is better at four times the speed.
 */

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
const FPS = 30;
const INTRO_S = 1.2;
const OUTRO_S = 2.8;
/** The round itself is squeezed into at most this long. */
const MAX_MAIN_S = 40;

/** How fast a round plays in its video: real time, or faster to fit. */
export function videoSpeed(ms: number): number {
  return Math.max(1, ms / (MAX_MAIN_S * 1000));
}

/** How many frames, and what moment of the round each one shows. */
export function videoTimeline(ms: number): { frames: number; at: (i: number) => { t: number; intro: number } } {
  const speed = videoSpeed(ms);
  const intro = Math.round(INTRO_S * FPS);
  const main = Math.ceil((ms / speed / 1000) * FPS);
  const outro = Math.round(OUTRO_S * FPS);
  return {
    frames: intro + main + outro,
    at: (i) => {
      if (i < intro) {
        // Holds, then fades over the last third.
        const fade = Math.min(1, (intro - i) / (intro / 3));
        return { t: 0, intro: fade };
      }
      if (i < intro + main) return { t: ((i - intro) / FPS) * 1000 * speed, intro: 0 };
      return { t: ms, intro: 0 };
    },
  };
}

export type MadeVideo = { blob: Blob; ext: "mp4" | "webm" };

export async function makeReplayVideo(
  replay: Replay,
  assets: ReplayAssets,
  {
    player,
    site,
    onProgress,
  }: { player?: string; site?: string; onProgress?: (share: number) => void }
): Promise<MadeVideo> {
  const {
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    Output,
    QUALITY_HIGH,
    WebMOutputFormat,
    getFirstEncodableVideoCodec,
  } = await import("mediabunny");

  // H.264 in an MP4 is what Instagram and TikTok take. Browsers built without
  // it (some Linux ones) get VP9 in a WebM, which YouTube still takes.
  const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
  });
  if (!codec) throw new Error("This browser can't make video.");
  const mp4 = codec === "avc";

  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the video.");

  const output = new Output({
    format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  const { frames, at } = videoTimeline(replay.result.ms);
  for (let i = 0; i < frames; i += 1) {
    const { t, intro } = at(i);
    drawFrame(ctx, frameAt(replay, t), replay, assets, {
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      player,
      site,
      intro,
    });
    await source.add(i / FPS, 1 / FPS);
    if (i % 8 === 0) {
      onProgress?.(i / frames);
      // Lets the page breathe, so the progress bar moves.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  await output.finalize();
  onProgress?.(1);
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("The video came out empty.");
  return {
    blob: new Blob([buffer], { type: mp4 ? "video/mp4" : "video/webm" }),
    ext: mp4 ? "mp4" : "webm",
  };
}
