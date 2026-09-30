/**
 * "Challenge a friend": a link to the same game with your result in it.
 *
 * No server. The result rides in the link itself (?vs=…), so a challenge
 * works for anyone, signed in or not, and costs nothing to keep. It is only
 * a claim — nothing here touches a leaderboard — so it needs to be readable
 * and hard to break, not tamper-proof.
 */

export type Challenge = {
  /** Who set it, as they typed it. */
  name: string;
  /**
   * Which game, precisely enough that two results can be compared:
   * "find:europe", "daily:2026-09-30", "mystery:2026-09-30", "bigger".
   */
  game: string;
  /** The number that decides it: countries found, guesses, a streak. */
  score: number;
  /** Whether more is better (countries found) or fewer (guesses). */
  higherWins: boolean;
  /** Time taken, to settle a tie on the score. */
  ms?: number;
  /** How it's said: "found 9/10 in 2:14". Follows the name in a sentence. */
  said: string;
};

const MAX_NAME = 16;
const MAX_SAID = 60;

/** Base64url, so the link survives being pasted anywhere. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** A name fit to print: trimmed, short, and never empty. */
export function cleanName(name: string): string {
  const clean = [...name]
    .filter((ch) => ch >= " " && ch !== "<" && ch !== ">")
    .join("")
    .trim()
    .slice(0, MAX_NAME);
  return clean || "A friend";
}

export function encodeChallenge(c: Challenge): string {
  return toBase64Url(
    JSON.stringify({
      n: cleanName(c.name),
      g: c.game,
      s: c.score,
      h: c.higherWins ? 1 : 0,
      ...(c.ms !== undefined ? { t: Math.round(c.ms) } : {}),
      x: c.said.slice(0, MAX_SAID),
    })
  );
}

/** The challenge in a link, or null for anything that isn't one. */
export function decodeChallenge(raw: string | null): Challenge | null {
  if (!raw || raw.length > 600) return null;
  try {
    const d = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>;
    if (
      typeof d.n !== "string" ||
      typeof d.g !== "string" ||
      typeof d.s !== "number" ||
      !Number.isFinite(d.s) ||
      typeof d.x !== "string" ||
      (d.t !== undefined && (typeof d.t !== "number" || !Number.isFinite(d.t)))
    ) {
      return null;
    }
    return {
      name: cleanName(d.n),
      game: d.g.slice(0, 40),
      score: d.s,
      higherWins: d.h === 1,
      ms: typeof d.t === "number" ? d.t : undefined,
      said: d.x.slice(0, MAX_SAID),
    };
  } catch {
    return null;
  }
}

/** The challenge a page was opened with, if any. */
export function challengeFromUrl(search: string): Challenge | null {
  return decodeChallenge(new URLSearchParams(search).get("vs"));
}

/**
 * The link to send: this page, with any challenge it came with swapped for
 * yours, so passing a challenge on doesn't stack them.
 */
export function challengeLink(c: Challenge, href: string): string {
  const url = new URL(href);
  url.searchParams.set("vs", encodeChallenge(c));
  url.hash = "";
  return url.toString();
}

export type Verdict = "won" | "lost" | "tied";

/** How your result stands against theirs; null if they aren't the same game. */
export function verdict(mine: Challenge, theirs: Challenge): Verdict | null {
  if (mine.game !== theirs.game) return null;
  if (mine.score !== theirs.score) {
    const ahead = mine.higherWins ? mine.score > theirs.score : mine.score < theirs.score;
    return ahead ? "won" : "lost";
  }
  // Whole seconds, as the times are shown: "0:07 against 0:07, you lose" on
  // the strength of a tenth of a second reads as a mistake.
  const secs = (ms?: number) => (ms === undefined ? undefined : Math.floor(ms / 1000));
  const [a, b] = [secs(mine.ms), secs(theirs.ms)];
  if (a !== undefined && b !== undefined && a !== b) {
    return a < b ? "won" : "lost";
  }
  return "tied";
}

const NAME_KEY = "worldguess.sharename.v1";

/** The name last put on a challenge, so it needn't be typed every time. */
export function savedShareName(): string {
  try {
    return localStorage.getItem(NAME_KEY)?.slice(0, MAX_NAME) ?? "";
  } catch {
    return "";
  }
}

export function saveShareName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.slice(0, MAX_NAME));
  } catch {
    /* typed again next time */
  }
}
