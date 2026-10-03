import { getCountryMeta } from "../data/countries";
import { CLUE_COUNT } from "./fiveClues";
import type { Replay } from "./replay";
import { formatDuration } from "./records";

/**
 * The caption that goes with a run's video: what happened, in the run's own
 * numbers, then a nudge to pass it on. "Named 47 of 50 countries in 4:12 on
 * WorldGuess. Tag a friend who can beat that." It used to be "My Name it ·
 * Countries only run on WorldGuess. Your turn:", which read like a form.
 *
 * Someone else's run, watched from a board, is told in their name.
 */

const NUDGE = "Tag a friend who can beat that.";
const NUDGE_LOST = "Tag a friend who'd get it.";

/** What each globe round asks for, and the verb for getting one. */
const GLOBE: Record<string, { verb: string; noun: string }> = {
  name: { verb: "named", noun: "countries" },
  find: { verb: "found", noun: "countries" },
  flag: { verb: "matched", noun: "flags" },
  capital: { verb: "named", noun: "capitals" },
  outline: { verb: "named", noun: "countries from their outline" },
  famous: { verb: "named", noun: "countries from their clues" },
};

const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function videoCaption(replay: Replay, player?: string): string {
  const { game, result } = replay;
  // "Named 9…" for your own run, "Mina named 9…" for someone else's.
  const did = (verb: string) => (player ? `${player} ${verb}` : upper(verb));
  const me = player ?? "me";
  const time = formatDuration(result.ms);

  switch (game.type) {
    case "mystery": {
      const guesses = replay.ev.filter((e) => e[1] === "g").length;
      return result.found
        ? `${did("found")} today's WorldGuess mystery country in ${guesses} ${guesses === 1 ? "guess" : "guesses"}. ${NUDGE}`
        : `Today's WorldGuess mystery country beat ${me}. ${NUDGE_LOST}`;
    }
    case "clues": {
      const on = CLUE_COUNT + 1 - result.points / 200;
      return result.found
        ? `${did("got")} today's WorldGuess country on clue ${on} of ${CLUE_COUNT}. ${NUDGE}`
        : `Today's WorldGuess Five clues beat ${me}. ${NUDGE_LOST}`;
    }
    case "connect": {
      const name = (n: string) => getCountryMeta(n).displayName;
      const route = game.from && game.to ? ` ${name(game.from)} to ${name(game.to)}` : "";
      const par = game.par ? ` (par ${game.par})` : "";
      return `${did("linked")}${route} in ${result.found} ${result.found === 1 ? "country" : "countries"}${par} on today's WorldGuess Connect. ${NUDGE}`;
    }
    case "bigger":
      return `${did("got")} ${result.found} in a row on WorldGuess's Which is bigger? ${NUDGE}`;
    default: {
      const { verb, noun } = GLOBE[game.type] ?? GLOBE.find;
      const count = result.found === result.total ? `all ${result.total}` : `${result.found} of ${result.total}`;
      const where = game.mode === "daily" ? "today's WorldGuess Country hunt" : "WorldGuess";
      return `${did(verb)} ${count} ${noun} in ${time} on ${where}. ${NUDGE}`;
    }
  }
}
