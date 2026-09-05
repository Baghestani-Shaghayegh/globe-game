

import type { GameType } from "../data/modes";

export type Run = {
  /** How long the run lasted, in milliseconds. */
  ms: number;
  /** When it ended, as an ISO timestamp. */
  at: string;
  /** How many countries were identified. */
  found: number;
  /** How many the mode asked for. */
  total: number;
  /** Points scored. Absent on runs recorded before scoring existed. */
  points?: number;
  /** Longest run of correct answers. Absent on older runs. */
  bestStreak?: number;
};

/**
 * Keyed by `recordKey(gameType, modeId)` — the classic game keeps the bare mode
 * id it has always used, so existing records survive.
 */
type Store = Record<string, Run[] | undefined>;

// v3: continent modes dropped territories, so their old totals no longer
// match the map. Bumping the key retires that history rather than showing
// scores measured against a different set of countries.
const KEY = "worldguess.records.v3";
const RETIRED_KEYS = ["worldguess.records.v1", "worldguess.records.v2"];
/** A short history per mode — enough for a personal best without growing forever. */
const MAX_RUNS = 20;

export function isComplete(run: Run): boolean {
  return run.total > 0 && run.found >= run.total;
}

function isRun(value: unknown): value is Run {
  if (!value || typeof value !== "object") return false;
  const { ms, found, total } = value as Run;
  return (
    typeof ms === "number" &&
    Number.isFinite(ms) &&
    ms >= 0 &&
    typeof found === "number" &&
    typeof total === "number"
  );
}

/** Clears superseded stores once, so old keys don't linger in the browser. */
function dropRetired() {
  try {
    for (const key of RETIRED_KEYS) localStorage.removeItem(key);
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
}

function read(): Store {
  try {
    dropRetired();
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    // Private window, blocked storage, or a corrupt value — start fresh.
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* the game plays fine without a saved history */
  }
}

/** A stored bucket, decomposed back into the three things that identify it. */
export type Bucket = {
  key: string;
  type: GameType;
  modeId: string;
  limitSeconds: number | null;
  runs: Run[];
};

/**
 * Every bucket that holds runs, newest activity first. Keys look like
 * `europe`, `find:europe` or `find:europe@180`, so this is `recordKey` read
 * backwards.
 */
export function allBuckets(): Bucket[] {
  const store = read();
  return Object.entries(store)
    .map(([key, runs]) => {
      const valid = Array.isArray(runs) ? runs.filter(isRun) : [];
      if (!valid.length) return null;

      const [head, limit] = key.split("@");
      const type: GameType = head.startsWith("find:") ? "find" : "name";
      return {
        key,
        type,
        modeId: head.replace(/^find:/, ""),
        limitSeconds: limit ? Number(limit) : null,
        runs: valid,
      };
    })
    .filter((bucket): bucket is Bucket => bucket !== null)
    .sort((a, b) => (a.runs[0].at < b.runs[0].at ? 1 : -1));
}

/** Wipes every stored run. */
export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored means nothing to clear */
  }
}

export function getRuns(key: string): Run[] {
  const runs = read()[key];
  return Array.isArray(runs) ? runs.filter(isRun) : [];
}

/** Files a finished run, newest first, and returns the mode's updated history. */
export function addRun(key: string, run: Omit<Run, "at">): Run[] {
  const runs = [
    { ...run, ms: Math.round(run.ms), at: new Date().toISOString() },
    ...getRuns(key),
  ].slice(0, MAX_RUNS);

  const store = read();
  store[key] = runs;
  write(store);
  return runs;
}

/** The fastest full clear, or null if the mode has never been completed. */
export function bestTime(key: string): Run | null {
  const cleared = getRuns(key).filter(isComplete);
  return cleared.length
    ? cleared.reduce((best, run) => (run.ms < best.ms ? run : best))
    : null;
}

/** The highest score in this mode, ignoring runs from before scoring existed. */
export function bestPoints(key: string): Run | null {
  const scored = getRuns(key).filter((run) => typeof run.points === "number");
  return scored.length
    ? scored.reduce((best, run) => (run.points! > best.points! ? run : best))
    : null;
}

/** The furthest anyone got in this mode — ties broken by the quicker run. */
export function bestScore(key: string): Run | null {
  const runs = getRuns(key);
  return runs.length
    ? runs.reduce((best, run) =>
        run.found > best.found ||
        (run.found === best.found && run.ms < best.ms)
          ? run
          : best
      )
    : null;
}

/**
 * What to show on a mode card: a clear time once the mode has been finished,
 * otherwise how far the player has got.
 */
export function bestLabel(key: string): string | null {
  const cleared = bestTime(key);
  if (cleared) return formatDuration(cleared.ms);
  const score = bestScore(key);
  return score ? `${score.found}/${score.total}` : null;
}

/** `m:ss`, widening to `h:mm:ss` once a run passes the hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
