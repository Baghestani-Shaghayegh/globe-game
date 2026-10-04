import type { ClueMark } from "./fiveClues";

/**
 * The little row of squares that goes with a shared result.
 *
 * Each says how the round went and nothing about what it was: no country, no
 * clue, no distance. A friend reading it learns how hard it was, not what the
 * answer is. Black is a try that missed, green is the find, yellow a find on
 * the second go, white nothing used.
 */

const MISS = "⬛";
const FOUND = "🟩";
const RETRIED = "🟨";
const BLANK = "⬜";

/** Five clues: used clues black, the find green, clues never reached white. */
export function cluesGrid(marks: ClueMark[]): string {
  return marks
    .map((mark) => (mark === "found" ? FOUND : mark === "unused" ? BLANK : MISS))
    .join("");
}

/** Mystery country: a black square per wrong guess, then green if it was found. */
export function mysteryGrid(guesses: number, solved: boolean, max = 10): string {
  const wrong = Math.max(0, solved ? guesses - 1 : guesses);
  const tiles = [...Array<string>(wrong).fill(MISS), ...(solved ? [FOUND] : [])];
  // A long search keeps its end: the last squares are the ones that matter.
  return tiles.slice(-max).join("");
}

/** Connect: a green square per step of the route, then black per wrong turn. */
export function connectGrid(steps: number, wrongTurns: number, max = 12): string {
  const tiles = [
    ...Array<string>(Math.max(0, steps)).fill(FOUND),
    ...Array<string>(Math.max(0, wrongTurns)).fill(MISS),
  ];
  return tiles.slice(0, max).join("");
}

/** Country hunt: found first time green, found on a retry yellow, missed white. */
export function huntGrid(outcomes: ("first" | "retried" | "missed")[]): string {
  return outcomes
    .map((outcome) => (outcome === "first" ? FOUND : outcome === "retried" ? RETRIED : BLANK))
    .join("");
}
