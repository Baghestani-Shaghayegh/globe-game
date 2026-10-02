import { cluesFor } from "../data/clues";
import { DAILY_MULTIPLIER, dayNumber, elapsedMs, hash, mulberry32 } from "./daily";
import { postRun } from "./leaderboard";

/**
 * Five clues: the daily built on Famous for.
 *
 * One country a day, everyone the same one. The first clue is the hardest —
 * the one only a geography nerd would know — and each miss turns over the
 * next, down to the one everybody does. Fewer clues, more points.
 */

export const CLUE_COUNT = 5;

/** Today's clues for a country, hardest first: the stored order reversed. */
export function dailyClues(answer: string): string[] {
  return [...cluesFor(answer)].reverse();
}

/**
 * Today's country.
 *
 * Every country in turn, in an order shuffled once, so none comes back until
 * the whole list has been played — about seven months — and two days in a row
 * are never neighbours by accident of the alphabet.
 */
export function cluePuzzleFor(day: string, pool: string[]): string | null {
  const playable = pool.filter((name) => cluesFor(name).length >= CLUE_COUNT).sort();
  if (!playable.length) return null;
  const random = mulberry32(hash("clues:order"));
  for (let i = playable.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [playable[i], playable[j]] = [playable[j], playable[i]];
  }
  const n = dayNumber(day);
  return playable[((n % playable.length) + playable.length) % playable.length];
}

export type CluesResult = {
  day: string;
  number: number;
  answer: string;
  /** Each guess, oldest first; null for a clue turned over without guessing. */
  guesses: (string | null)[];
  solved: boolean;
  /** Out of clues, or given up: the answer is shown and it scores nothing. */
  lost?: boolean;
  startedAt?: number;
  /** How long it took, fixed when it ended. */
  ms?: number;
};

/** How many clues are showing: one, plus one per miss, up to all five. */
export function cluesShown(result: CluesResult): number {
  if (result.solved || result.lost) return CLUE_COUNT;
  return Math.min(CLUE_COUNT, result.guesses.length + 1);
}

/** The clue it was found on, 1–5; null if it wasn't. */
export function foundOn(result: CluesResult): number | null {
  return result.solved ? result.guesses.length : null;
}

export type ClueMark = "found" | "missed" | "skipped" | "unused";

/** How each of the five clues went, for the card on the menu and the share image. */
export function clueMarks(result: CluesResult): ClueMark[] {
  return Array.from({ length: CLUE_COUNT }, (_, i): ClueMark => {
    if (i >= result.guesses.length) return "unused";
    const guess = result.guesses[i];
    if (guess === null) return "skipped";
    return guess === result.answer ? "found" : "missed";
  });
}

/** 1,000 on the first clue, 200 less for each one after. */
export function scoreFor(result: CluesResult): number {
  const on = foundOn(result);
  return on === null ? 0 : (CLUE_COUNT + 1 - on) * 200;
}

/** A guess, or a clue skipped, played onto the round. */
export function play(result: CluesResult, guess: string | null, now = Date.now()): CluesResult {
  if (result.solved || result.lost) return result;
  const guesses = [...result.guesses, guess];
  const solved = guess === result.answer;
  const lost = !solved && guesses.length >= CLUE_COUNT;
  return {
    ...result,
    guesses,
    solved,
    lost: lost || undefined,
    ...(solved || lost ? { ms: elapsedMs(result.startedAt, now) } : {}),
  };
}

const KEY = "worldguess.clues.v1";

function isResult(value: unknown): value is CluesResult {
  if (!value || typeof value !== "object") return false;
  const { day, answer, guesses, solved } = value as CluesResult;
  return (
    typeof day === "string" &&
    typeof answer === "string" &&
    typeof solved === "boolean" &&
    Array.isArray(guesses) &&
    guesses.length <= CLUE_COUNT &&
    guesses.every((g) => g === null || typeof g === "string")
  );
}

/** Today's round, or null if it hasn't been played. Anything malformed is dropped. */
export function loadClues(day: string): CluesResult | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isResult(parsed) || parsed.day !== day) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveClues(result: CluesResult) {
  try {
    localStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    /* the round still plays out in this tab */
  }
}

/** The bucket today's five clues are filed under on the leaderboard. */
export const CLUES_BUCKET = "clues:daily";

/**
 * Files a found country on the leaderboard, at the daily multiplier, and
 * hands back the run's id for its recording. A miss isn't posted: it scores
 * nothing.
 */
export function postCluesScore(result: CluesResult): Promise<number | null> {
  if (!result.solved) return Promise.resolve(null);
  return postRun(CLUES_BUCKET, {
    points: scoreFor(result) * DAILY_MULTIPLIER,
    found: 1,
    total: 1,
    ms: result.ms ?? elapsedMs(result.startedAt),
    bestStreak: 0,
    hintsUsed: 0,
  });
}
