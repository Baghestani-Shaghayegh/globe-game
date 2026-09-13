import { getCountryMeta } from "../data/countries";
import { neighboursOf } from "../data/borders";

/**
 * What the game says when you click the wrong country.
 *
 * "Not quite — try again" is the same sentence whether you were one border
 * out or on the wrong hemisphere, and it teaches nothing. These read the miss
 * first: a neighbour gets told it was close, a wild click gets told how wild,
 * and the country you actually hit gets named — which is worth something on
 * its own, because half of learning a map is finding out what you just
 * pointed at.
 */

const display = (name: string) => getCountryMeta(name).displayName;

/** Shared so the rest of the app can flash the same text for an ocean click. */
export const OCEAN_MISS = [
  "That's the sea. Bold strategy.",
  "No countries out there. Fish, mostly.",
  "The ocean is not on the list.",
];

const NEXT_DOOR = [
  "{clicked}! One border out.",
  "So close — {clicked} is right next door.",
  "{clicked}. You could walk it from there.",
];

const SAME_CONTINENT = [
  "{clicked}. Right continent, wrong country.",
  "That's {clicked}. Warm-ish.",
  "{clicked} — you're in the right neighbourhood.",
];

const FAR = [
  "That's {clicked}. Different continent entirely.",
  "{clicked}? That's a long way from {target}.",
  "You have selected {clicked}. It is not {target}.",
];

const VERY_FAR = [
  "{clicked}. Roughly the other side of the planet.",
  "{clicked} — you missed by about {km} km.",
  "Somehow you have landed on {clicked}.",
];

/** Kilometres past which a miss stops being a near miss and starts being funny. */
export const VERY_FAR_KM = 8_000;

/**
 * Picks the line. `choose` is passed in rather than reaching for Math.random
 * so a test can pin it, and so the same miss can be made to read the same way
 * twice if that ever matters.
 */
export function missQuip(
  clicked: string,
  target: string,
  km: number | null = null,
  choose: (length: number) => number = (length) =>
    Math.floor(Math.random() * length)
): string {
  const pool = (() => {
    if (neighboursOf(clicked).includes(target)) return NEXT_DOOR;
    if (km !== null && km >= VERY_FAR_KM) return VERY_FAR;
    const here = getCountryMeta(clicked).continents;
    const there = getCountryMeta(target).continents;
    if (here.some((c) => there.includes(c))) return SAME_CONTINENT;
    return FAR;
  })();

  return pool[choose(pool.length)]
    .replace("{clicked}", display(clicked))
    .replace("{target}", display(target))
    .replace("{km}", km === null ? "a lot of" : Math.round(km / 100) * 100 + "");
}
