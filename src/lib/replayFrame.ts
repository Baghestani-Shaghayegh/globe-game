import type { Replay } from "./replay";

/**
 * What a recording shows at one moment: where the camera is, what has been
 * found, what is being asked, and what just happened. Pure, so the player,
 * the video and the tests all agree on it.
 */
export type Frame = {
  /** Milliseconds into the round. */
  t: number;
  camera: { lat: number; lng: number; altitude: number };
  found: Set<string>;
  points: number;
  /** The country being asked for, or picked to be named. */
  target: string | null;
  /** Hints bought on the current target, in order. */
  hints: string[];
  /** A country shown as the answer, lit for a moment. */
  revealed: string | null;
  /** The last wrong click or name, while it's still flashing. */
  wrong: string | null;
  /** The last right answer, while its name is still up. */
  right: string | null;
  /** Clicks to ripple out from, newest last, with how far through (0–1). */
  ripples: { name: string; ok: boolean; progress: number }[];
  /** Every wrong answer so far, oldest first: Five clues keeps them red. */
  missed: string[];
  /** Past the end: the result is shown. */
  over: boolean;
  /** Mystery: each country guessed, and how far it was. */
  heat: Map<string, number>;
  /** The newest mystery guess. */
  lastGuess: { name: string; km: number } | null;
  /** Connect: each country placed, and how good a step it was. */
  placed: Map<string, string>;
  /** Which is bigger?: the pair on screen, and how it went once picked. */
  pair: { left: string; right: string; picked: string | null; correct: boolean | null } | null;
  /** Which is bigger?: right answers so far. */
  streak: number;
};

const REVEAL_MS = 1800;
const WRONG_MS = 1200;
const RIGHT_MS = 1400;
const RIPPLE_MS = 700;
/**
 * The last moment held before the result card: the final answer's name, or
 * the mystery shown, stays up long enough to read rather than vanishing
 * under the card the instant the clock stops.
 */
export const END_HOLD_MS = 1500;

/** Where the camera was at `t`, eased between the samples either side. */
export function cameraAt(cam: number[], t: number): Frame["camera"] {
  const n = cam.length / 4;
  if (n === 0) return { lat: 20, lng: 10, altitude: 2.2 };
  if (t <= cam[0]) return { lat: cam[1], lng: cam[2], altitude: cam[3] };
  if (t >= cam[(n - 1) * 4]) {
    const i = (n - 1) * 4;
    return { lat: cam[i + 1], lng: cam[i + 2], altitude: cam[i + 3] };
  }
  // The last sample at or before t.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cam[mid * 4] <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = lo * 4;
  const b = a + 4;
  const span = cam[b] - cam[a];
  const k = span > 0 ? (t - cam[a]) / span : 0;
  // Longitude the short way round, so 179° to -179° is two degrees, not 358.
  let dLng = cam[b + 2] - cam[a + 2];
  if (dLng > 180) dLng -= 360;
  if (dLng < -180) dLng += 360;
  let lng = cam[a + 2] + dLng * k;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return {
    lat: cam[a + 1] + (cam[b + 1] - cam[a + 1]) * k,
    lng,
    altitude: cam[a + 3] + (cam[b + 3] - cam[a + 3]) * k,
  };
}

export function frameAt(replay: Replay, t: number): Frame {
  const found = new Set<string>();
  let points = 0;
  let target: string | null = null;
  let hints: string[] = [];
  let revealed: string | null = null;
  let wrong: string | null = null;
  let right: string | null = null;
  const ripples: Frame["ripples"] = [];
  const missed: string[] = [];
  const heat = new Map<string, number>();
  let lastGuess: Frame["lastGuess"] = null;
  const placed = new Map<string, string>();
  let pair: Frame["pair"] = null;
  let streak = 0;

  for (const event of replay.ev) {
    const at = event[0];
    if (at > t) break;
    const age = t - at;
    switch (event[1]) {
      case "q":
        target = event[2];
        hints = [];
        break;
      case "s":
        target = event[2];
        hints = [];
        break;
      case "ok":
        found.add(event[2]);
        points = event[3];
        right = age < RIGHT_MS ? event[2] : right;
        if (age < RIPPLE_MS) ripples.push({ name: event[2], ok: true, progress: age / RIPPLE_MS });
        break;
      case "x":
        if (event[2] && !missed.includes(event[2])) missed.push(event[2]);
        if (age < WRONG_MS) wrong = event[2];
        if (event[2] && age < RIPPLE_MS) {
          ripples.push({ name: event[2], ok: false, progress: age / RIPPLE_MS });
        }
        break;
      case "h":
        hints = [...hints, event[2]];
        break;
      case "p":
        revealed = age < REVEAL_MS ? event[2] : revealed;
        break;
      case "g":
        heat.set(event[2], event[3]);
        lastGuess = { name: event[2], km: event[3] };
        if (age < RIPPLE_MS) {
          ripples.push({ name: event[2], ok: event[3] === 0, progress: age / RIPPLE_MS });
        }
        break;
      case "c":
        placed.set(event[2], event[3]);
        if (age < RIPPLE_MS) {
          ripples.push({ name: event[2], ok: event[3] !== "far", progress: age / RIPPLE_MS });
        }
        break;
      case "b": {
        // A pair put up, then the same pair picked: the verdict stays on
        // screen until the next pair is put up.
        if (!event[4]) {
          pair = { left: event[2], right: event[3], picked: null, correct: null };
          break;
        }
        const correct = event[5] === 1;
        streak = correct ? streak + 1 : 0;
        pair = { left: event[2], right: event[3], picked: event[4], correct };
        break;
      }
    }
  }
  // A flash belongs to the moment; one long gone shouldn't linger because a
  // later event of another kind came along.
  const last = (kind: string) => {
    for (let i = replay.ev.length - 1; i >= 0; i -= 1) {
      const e = replay.ev[i];
      if (e[0] <= t && e[1] === kind) return t - e[0];
    }
    return Infinity;
  };
  if (last("p") >= REVEAL_MS) revealed = null;
  if (last("ok") >= RIGHT_MS) right = null;

  return {
    t,
    camera: cameraAt(replay.cam, t),
    found,
    points,
    target,
    hints,
    revealed,
    wrong,
    right,
    ripples,
    missed,
    over: t >= replay.result.ms + END_HOLD_MS,
    heat,
    lastGuess,
    placed,
    pair,
    streak,
  };
}

/** "2:14", as the game's clock shows it. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
