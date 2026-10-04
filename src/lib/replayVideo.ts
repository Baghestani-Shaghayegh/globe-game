import type { Replay } from "./replay";
import { END_HOLD_MS, frameAt } from "./replayFrame";
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
/** The held last moment, then the result card. */
const OUTRO_S = END_HOLD_MS / 1000 + 2.8;
/** The round itself is squeezed into at most this long. */
const MAX_MAIN_S = 40;

/**
 * The speeds on offer before a video is made, as a multiple of the usual one.
 * 1 is what the video has always been: real time for a short round, squeezed
 * to fit for a long one. The rest speed it up or slow it down from there.
 */
export const VIDEO_SPEEDS = [0.5, 1, 2, 4];

/** The slowest a video may play, so a pick of 0.5 on a short round isn't a crawl. */
const SLOWEST = 0.25;

/**
 * How fast a round plays in its video: real time, or faster to fit, times
 * whatever the player picked.
 */
export function videoSpeed(ms: number, factor = 1): number {
  return Math.max(SLOWEST, Math.max(1, ms / (MAX_MAIN_S * 1000)) * factor);
}

/** How long the finished video runs, in seconds, for a round at a picked speed. */
export function videoSeconds(ms: number, factor = 1): number {
  return videoTimeline(ms, factor).frames / FPS;
}

/**
 * How many frames, and what moment of the round each one shows. It starts
 * straight on the round: the top line already names the game, and a title
 * card in front only delayed the first move.
 */
export function videoTimeline(
  ms: number,
  factor = 1
): { frames: number; at: (i: number) => { t: number } } {
  const speed = videoSpeed(ms, factor);
  const main = Math.ceil((ms / speed / 1000) * FPS);
  const outro = Math.round(OUTRO_S * FPS);
  return {
    frames: main + outro,
    at: (i) => {
      if (i < main) return { t: (i / FPS) * 1000 * speed };
      // Real time from the end, so the last moment holds and then the card comes up.
      return { t: ms + ((i - main) / FPS) * 1000 };
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
    speed = 1,
    onProgress,
    isCancelled,
  }: {
    player?: string;
    site?: string;
    /** A multiple of the usual speed: see VIDEO_SPEEDS. */
    speed?: number;
    onProgress?: (share: number) => void;
    /** Asked between frames, so a picked speed that is changed again stops the old render. */
    isCancelled?: () => boolean;
  }
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

  const { frames, at } = videoTimeline(replay.result.ms, speed);
  for (let i = 0; i < frames; i += 1) {
    if (isCancelled?.()) {
      await output.cancel();
      throw new Error("The video was cancelled.");
    }
    const { t } = at(i);
    drawFrame(ctx, frameAt(replay, t), replay, assets, {
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      player,
      site,
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
