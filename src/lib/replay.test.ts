import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  keepReplay,
  parseReplay,
  recordingOn,
  ReplayRecorder,
  savedReplays,
  setRecordingOn,
  type Replay,
} from "./replay";
import { cameraAt, frameAt } from "./replayFrame";

beforeEach(() => localStorage.clear());

const game = { type: "find" as const, mode: "europe", label: "Find it · Europe", bucket: "find:europe" };

function sample(): Replay {
  return {
    v: 1,
    game,
    at: "2026-10-01T10:00:00.000Z",
    result: { ms: 10_000, points: 300, found: 2, total: 3 },
    cam: [0, 40, 10, 2, 1000, 50, 20, 1, 2000, 50, 20, 1],
    ev: [
      [0, "q", "Spain"],
      [1500, "x", "Portugal"],
      [2500, "ok", "Spain", 100],
      [2600, "q", "France"],
      [4000, "ok", "France", 300],
      [4100, "q", "Italy"],
      [5000, "h", "answer"],
      [5000, "p", "Italy"],
    ],
  };
}

describe("recording a round", () => {
  it("keeps events in order with their times", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const rec = new ReplayRecorder(1000);
    rec.mark(["q", "Spain"]);
    now = 3200;
    rec.mark(["ok", "Spain", 100]);
    const replay = rec.finish(game, { ms: 2200, points: 100, found: 1, total: 1 });
    expect(replay.ev).toEqual([
      [0, "q", "Spain"],
      [2200, "ok", "Spain", 100],
    ]);
    vi.restoreAllMocks();
  });

  it("thins the camera to a few samples a second", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const rec = new ReplayRecorder(0);
    for (now = 0; now < 1000; now += 16) rec.look(10, 20, 2);
    const { cam } = rec.finish(game, { ms: 1000, points: 0, found: 0, total: 1 });
    expect(cam.length / 4).toBeLessThanOrEqual(10);
    expect(cam.length / 4).toBeGreaterThanOrEqual(7);
    vi.restoreAllMocks();
  });

  it("is small: a long round is tens of kilobytes, not megabytes", () => {
    const r = sample();
    for (let i = 0; i < 1500; i++) r.cam.push(3000 + i * 120, 12.345, -45.678, 1.234);
    for (let i = 0; i < 300; i++) r.ev.push([6000 + i * 500, "ok", "Kyrgyzstan", 12345]);
    expect(JSON.stringify(r).length).toBeLessThan(80_000);
  });
});

describe("reading one back", () => {
  it("accepts what was recorded", () => {
    expect(parseReplay(JSON.parse(JSON.stringify(sample())))).toEqual(sample());
  });

  it("refuses anything malformed", () => {
    expect(parseReplay(null)).toBeNull();
    expect(parseReplay({ ...sample(), v: 2 })).toBeNull();
    expect(parseReplay({ ...sample(), cam: [1, 2, 3] })).toBeNull();
    expect(parseReplay({ ...sample(), ev: [[0, "ok", "Spain"]] })).toBeNull();
    expect(parseReplay({ ...sample(), ev: [[0, "boom", "x"]] })).toBeNull();
    expect(parseReplay({ ...sample(), game: { ...game, label: "x".repeat(500) } })).toBeNull();
  });
});

describe("what a moment shows", () => {
  it("knows what's asked, found and scored", () => {
    const f = frameAt(sample(), 3000);
    expect(f.target).toBe("France");
    expect([...f.found]).toEqual(["Spain"]);
    expect(f.points).toBe(100);
    expect(f.over).toBe(false);
  });

  it("flashes a wrong click, then lets it go", () => {
    expect(frameAt(sample(), 1600).wrong).toBe("Portugal");
    expect(frameAt(sample(), 2800).wrong).toBeNull();
  });

  it("lights a shown answer for a moment", () => {
    expect(frameAt(sample(), 5500).revealed).toBe("Italy");
    expect(frameAt(sample(), 5500).hints).toEqual(["answer"]);
    expect(frameAt(sample(), 8000).revealed).toBeNull();
  });

  it("ripples out from a click", () => {
    const f = frameAt(sample(), 2700);
    expect(f.ripples).toEqual([{ name: "Spain", ok: true, progress: 200 / 700 }]);
  });

  it("shows the result once the round is over", () => {
    expect(frameAt(sample(), 10_000).over).toBe(true);
  });
});

describe("the camera between samples", () => {
  it("eases from one to the next", () => {
    expect(cameraAt(sample().cam, 500)).toEqual({ lat: 45, lng: 15, altitude: 1.5 });
  });

  it("goes the short way round the date line", () => {
    const cam = [0, 0, 170, 2, 1000, 0, -170, 2];
    expect(cameraAt(cam, 500).lng).toBeCloseTo(180, 5);
    expect(Math.abs(cameraAt(cam, 250).lng)).toBeGreaterThan(170);
  });

  it("holds at either end", () => {
    expect(cameraAt(sample().cam, -50)).toEqual({ lat: 40, lng: 10, altitude: 2 });
    expect(cameraAt(sample().cam, 99_999)).toEqual({ lat: 50, lng: 20, altitude: 1 });
  });
});

describe("kept on the device", () => {
  it("keeps the last five, newest first", () => {
    for (let i = 0; i < 7; i++) keepReplay({ ...sample(), at: `2026-10-0${i + 1}T00:00:00.000Z` });
    const kept = savedReplays();
    expect(kept).toHaveLength(5);
    expect(kept[0].at).toBe("2026-10-07T00:00:00.000Z");
  });

  it("starts fresh on a corrupt value", () => {
    localStorage.setItem("worldguess.replays.v1", "{nope");
    expect(savedReplays()).toEqual([]);
  });

  it("records unless switched off", () => {
    expect(recordingOn()).toBe(true);
    setRecordingOn(false);
    expect(recordingOn()).toBe(false);
  });
});
