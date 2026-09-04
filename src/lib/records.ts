import type { ModeId } from "../data/modes";

export type Run = {
  /** How long the run lasted, in milliseconds. */
  ms: number;
  /** When it ended, as an ISO timestamp. */
  at: string;
  /** How many countries were identified. */
  found: number;
  /** How many the mode asked for. */
  total: number;
};

type Store = Partial<Record<ModeId, Run[]>>;

// v2: runs gained found/total so a round you gave up on still counts.
const KEY = "worldguess.records.v2";
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

export function getRuns(mode: ModeId): Run[] {
  const runs = read()[mode];
  return Array.isArray(runs) ? runs.filter(isRun) : [];
}

/** Files a finished run, newest first, and returns the mode's updated history. */
export function addRun(mode: ModeId, run: Omit<Run, "at">): Run[] {
  const runs = [
    { ...run, ms: Math.round(run.ms), at: new Date().toISOString() },
    ...getRuns(mode),
  ].slice(0, MAX_RUNS);

  const store = read();
  store[mode] = runs;
  write(store);
  return runs;
}

/** The fastest full clear, or null if the mode has never been completed. */
export function bestTime(mode: ModeId): Run | null {
  const cleared = getRuns(mode).filter(isComplete);
  return cleared.length
    ? cleared.reduce((best, run) => (run.ms < best.ms ? run : best))
    : null;
}

/** The furthest anyone got in this mode — ties broken by the quicker run. */
export function bestScore(mode: ModeId): Run | null {
  const runs = getRuns(mode);
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
export function bestLabel(mode: ModeId): string | null {
  const cleared = bestTime(mode);
  if (cleared) return formatDuration(cleared.ms);
  const score = bestScore(mode);
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
