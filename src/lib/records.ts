import type { Difficulty } from "../data/countries";

export type Run = {
  /** How long the run took, in milliseconds. */
  ms: number;
  /** When it finished, as an ISO timestamp. */
  at: string;
};

type Store = Partial<Record<Difficulty, Run[]>>;

const KEY = "worldguess.records.v1";
/** A short history per mode — enough for a personal best without growing forever. */
const MAX_RUNS = 10;

function isRun(value: unknown): value is Run {
  if (!value || typeof value !== "object") return false;
  const { ms } = value as Run;
  return typeof ms === "number" && Number.isFinite(ms) && ms >= 0;
}

function read(): Store {
  try {
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

export function getRuns(difficulty: Difficulty): Run[] {
  const runs = read()[difficulty];
  return Array.isArray(runs) ? runs.filter(isRun) : [];
}

/** Saves a finished run, newest first, and returns the mode's updated history. */
export function addRun(difficulty: Difficulty, ms: number): Run[] {
  const runs = [
    { ms: Math.round(ms), at: new Date().toISOString() },
    ...getRuns(difficulty),
  ].slice(0, MAX_RUNS);

  const store = read();
  store[difficulty] = runs;
  write(store);
  return runs;
}

export function bestRun(difficulty: Difficulty): Run | null {
  const runs = getRuns(difficulty);
  return runs.length
    ? runs.reduce((best, run) => (run.ms < best.ms ? run : best))
    : null;
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
