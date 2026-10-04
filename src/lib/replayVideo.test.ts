import { describe, expect, it } from "vitest";
import { VIDEO_SPEEDS, videoSeconds, videoSpeed, videoTimeline } from "./replayVideo";

describe("the video's speed", () => {
  it("is what it always was when nothing is picked", () => {
    expect(videoSpeed(6000)).toBe(1);
    expect(videoSpeed(160_000)).toBe(4);
    expect(videoTimeline(6000, 1).frames).toBe(videoTimeline(6000).frames);
  });

  it("offers 1 among the choices, as the usual speed", () => {
    expect(VIDEO_SPEEDS).toContain(1);
  });

  it("makes a faster pick shorter and a slower one longer", () => {
    const ms = 60_000;
    expect(videoSeconds(ms, 2)).toBeLessThan(videoSeconds(ms, 1));
    expect(videoSeconds(ms, 0.5)).toBeGreaterThan(videoSeconds(ms, 1));
  });

  it("never plays slower than a quarter speed", () => {
    expect(videoSpeed(6000, 0.01)).toBe(0.25);
  });

  it("still ends on the held moment and the result card at any speed", () => {
    for (const factor of VIDEO_SPEEDS) {
      const { frames, at } = videoTimeline(20_000, factor);
      expect(at(frames - 1).t).toBeGreaterThan(20_000);
      expect(at(0).t).toBe(0);
    }
  });
});
