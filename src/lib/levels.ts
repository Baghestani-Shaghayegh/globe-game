import { isComplete, type Bucket } from "./records";
import type { Earned } from "./achievements";

/**
 * Experience, derived from the history the game already keeps — the same
 * approach the badges take. Nothing is written for XP's sake, so turning
 * levels on doesn't reset anyone to zero.
 */

/** A run before scoring existed has no points, so it is valued by what it found. */
const XP_PER_COUNTRY_LEGACY = 25;
/** A finished map is worth more than the sum of its answers. */
const CLEAR_BONUS = 1000;
/** Each badge, once. */
export const XP_PER_BADGE = 500;

/** The highest level there is. Beyond it the bar stays full. */
export const MAX_LEVEL = 20;

/**
 * Total XP needed to reach a level. Quadratic: the first few levels arrive
 * within a session or two, and the last ones take a season.
 *
 * Level 2 is 1,000; level 5 is 10,000; level 10 is 45,000; level 20 is 190,000.
 */
export function xpToReach(level: number): number {
  const capped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 500 * (capped - 1) * capped;
}

export function xpFromRuns(buckets: Bucket[]): number {
  return buckets.reduce(
    (total, bucket) =>
      total +
      bucket.runs.reduce(
        (inner, run) =>
          inner +
          (typeof run.points === "number"
            ? run.points
            : run.found * XP_PER_COUNTRY_LEGACY) +
          (isComplete(run) ? CLEAR_BONUS : 0),
        0
      ),
    0
  );
}

export function xpFromBadges(badges: Earned[]): number {
  return badges.filter((badge) => badge.unlocked).length * XP_PER_BADGE;
}

export function totalXp(buckets: Bucket[], badges: Earned[]): number {
  return xpFromRuns(buckets) + xpFromBadges(badges);
}

/** The level a total of XP puts you at. */
export function levelFor(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level += 1;
  return level;
}

export type Progress = {
  level: number;
  xp: number;
  /** XP earned since this level began. */
  into: number;
  /** XP this level spans, or 0 at the cap. */
  span: number;
  /** How far through the level, 0–1. Full at the cap. */
  share: number;
  /** XP still needed for the next level, or null at the cap. */
  toNext: number | null;
};

export function progressFor(xp: number): Progress {
  const level = levelFor(xp);
  if (level >= MAX_LEVEL) {
    return { level, xp, into: 0, span: 0, share: 1, toNext: null };
  }
  const floor = xpToReach(level);
  const ceiling = xpToReach(level + 1);
  const span = ceiling - floor;
  const into = xp - floor;
  return {
    level,
    xp,
    into,
    span,
    share: span > 0 ? Math.min(1, into / span) : 1,
    toNext: Math.max(0, ceiling - xp),
  };
}
