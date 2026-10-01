import type { GameType } from "../data/modes";

/**
 * A round, recorded as what happened rather than as video.
 *
 * Every turn of the globe, every click and every answer, with the time it
 * happened. A three-minute round is a few kilobytes, where a screen
 * recording is tens of megabytes; it plays back sharp at any size, on any
 * device; and the same recording renders the 9:16 video for a story. It is
 * also how a record on the leaderboard can be watched: the hall of fame
 * shows not just the time but the run.
 */

/** The games recorded beyond the six globe rounds. */
export type DailyKind = "mystery" | "connect" | "bigger";

/** Which game a recording is of, enough to label it and draw its prompts. */
export type ReplayGame = {
  type: GameType | DailyKind;
  /** The mode's id: "europe", "easy". */
  mode: string;
  /** "Find it · Europe", as the player saw it. */
  label: string;
  /** The board it would be ranked on, if any. */
  bucket: string;
  /** The countries being asked about, when that's less than the whole map. */
  inPlay?: string[];
  /** Mystery: the country being looked for, shown once the round is over. */
  answer?: string;
  /** Connect: the two countries to link. */
  from?: string;
  to?: string;
  /** Connect: the shortest route's length, to say "par 4". */
  par?: number;
};

/**
 * One thing that happened, as a short tuple: [ms since start, kind, …].
 *
 *   q   a country is asked for          [t, "q", name]
 *   ok  a right answer                  [t, "ok", name, points so far]
 *   x   a wrong answer                  [t, "x", name clicked or named | null]
 *   h   a hint bought                   [t, "h", kind]
 *   p   a country passed or shown       [t, "p", name]
 *   s   a country picked to name        [t, "s", name]
 *   g   a mystery guess, and how far    [t, "g", name, km]
 *   c   a country put in a Connect      [t, "c", name, "best"|"near"|"far"]
 *   b   a Which is bigger? pair         [t, "b", left, right, picked, 1 right | 0 wrong]
 *       (picked "" when the pair is first put up, before any pick)
 */
export type ReplayEvent =
  | [number, "q", string]
  | [number, "ok", string, number]
  | [number, "x", string | null]
  | [number, "h", string]
  | [number, "p", string]
  | [number, "s", string]
  | [number, "g", string, number]
  | [number, "c", string, string]
  | [number, "b", string, string, string, number];

export type Replay = {
  v: 1;
  game: ReplayGame;
  /** Who played it, for the label; filled in when it's posted. */
  player?: string;
  /** When it was played, ISO. */
  at: string;
  result: { ms: number; points: number; found: number; total: number };
  /** The camera, flattened: t, lat, lng, altitude, t, lat, lng, altitude… */
  cam: number[];
  ev: ReplayEvent[];
};

/** Room for a long round: a full world clear runs to a few hundred events. */
const MAX_EVENTS = 4000;
const MAX_CAMERA = 4 * 6000;
/** How often the camera is sampled while it moves. */
const CAMERA_EVERY_MS = 120;

/** Collects a round as it's played. One per round; thrown away on a reset. */
export class ReplayRecorder {
  private readonly start: number;
  private readonly camera: number[] = [];
  private readonly events: ReplayEvent[] = [];
  private lastCamera = -Infinity;

  constructor(start: number = performance.now()) {
    this.start = start;
  }

  private now(): number {
    return Math.max(0, Math.round(performance.now() - this.start));
  }

  /** Something happened. Dropped quietly past the cap: the game matters more. */
  mark(event: ReplayEvent extends [number, ...infer Rest] ? Rest : never): void {
    if (this.events.length >= MAX_EVENTS) return;
    this.events.push([this.now(), ...event] as ReplayEvent);
  }

  /** How long it's been running, on the recording's clock. */
  elapsed(): number {
    return this.now();
  }

  /** Where the camera is. Thinned to a few samples a second; `force` keeps one. */
  look(lat: number, lng: number, altitude: number, force = false): void {
    const t = this.now();
    if (!force && t - this.lastCamera < CAMERA_EVERY_MS) return;
    if (this.camera.length >= MAX_CAMERA) return;
    this.lastCamera = t;
    this.camera.push(t, round3(lat), round3(lng), round3(altitude));
  }

  finish(game: ReplayGame, result: Replay["result"], at: Date = new Date()): Replay {
    return {
      v: 1,
      game,
      at: at.toISOString(),
      result: { ...result, ms: Math.round(result.ms) },
      cam: [...this.camera],
      ev: [...this.events],
    };
  }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isStr = (s: unknown): s is string => typeof s === "string" && s.length <= 80;

/**
 * A recording from somewhere else — storage, the database — checked before
 * anything is drawn from it. Null for anything malformed.
 */
export function parseReplay(data: unknown): Replay | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Replay;
  if (r.v !== 1 || !r.game || !r.result) return null;
  const g = r.game;
  if (!isStr(g.type) || !isStr(g.mode) || !isStr(g.label) || !isStr(g.bucket)) return null;
  if (g.inPlay !== undefined && !(Array.isArray(g.inPlay) && g.inPlay.every(isStr))) return null;
  for (const field of [g.answer, g.from, g.to]) {
    if (field !== undefined && !isStr(field)) return null;
  }
  if (g.par !== undefined && !isNum(g.par)) return null;
  const res = r.result;
  if (![res.ms, res.points, res.found, res.total].every(isNum)) return null;
  if (!Array.isArray(r.cam) || r.cam.length % 4 !== 0 || r.cam.length > MAX_CAMERA) return null;
  if (!r.cam.every(isNum)) return null;
  if (!Array.isArray(r.ev) || r.ev.length > MAX_EVENTS) return null;
  for (const e of r.ev) {
    if (!Array.isArray(e) || !isNum(e[0]) || !isStr(e[1])) return null;
    const [, kind, a, b, c, d] = e as unknown[];
    const ok =
      (kind === "ok" && isStr(a) && isNum(b)) ||
      (kind === "g" && isStr(a) && isNum(b)) ||
      (kind === "c" && isStr(a) && isStr(b)) ||
      (kind === "b" && isStr(a) && isStr(b) && isStr(c) && isNum(d)) ||
      (kind === "x" && (a === null || isStr(a))) ||
      ((kind === "q" || kind === "h" || kind === "p" || kind === "s") && isStr(a));
    if (!ok) return null;
  }
  return {
    v: 1,
    game: { ...g },
    player: isStr(r.player) ? r.player : undefined,
    at: isStr(r.at) ? r.at : new Date(0).toISOString(),
    result: { ...res },
    cam: r.cam,
    ev: r.ev,
  };
}

// ---- Kept on this device -------------------------------------------------

const KEY = "worldguess.replays.v1";
/** The last few rounds, so a good one can still be watched or posted later. */
const KEEP = 5;

export function savedReplays(): Replay[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(parseReplay).filter((r): r is Replay => r !== null)
      : [];
  } catch {
    return [];
  }
}

export function keepReplay(replay: Replay) {
  const kept = [replay, ...savedReplays()].slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // Full storage: keep just this one rather than none.
    try {
      localStorage.setItem(KEY, JSON.stringify([replay]));
    } catch {
      /* watched now or not at all */
    }
  }
}

// ---- The record switch ---------------------------------------------------

const SWITCH_KEY = "worldguess.record.v1";

/** Whether rounds are recorded. On unless the player turned it off. */
export function recordingOn(): boolean {
  try {
    return localStorage.getItem(SWITCH_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setRecordingOn(on: boolean) {
  try {
    localStorage.setItem(SWITCH_KEY, on ? "on" : "off");
  } catch {
    /* on for this visit */
  }
}
