/**
 * The link preview for a challenge.
 *
 * A challenge rides in its link (?vs=…), and the game reads it in the
 * browser. WhatsApp, iMessage, Instagram DMs, Discord and the rest don't run
 * the game: they read the page's meta tags and stop. So every challenge link
 * used to preview as plain "WorldGuess", and the friend saw no dare until
 * they tapped. vercel.json sends any page asked for with ?vs= here first;
 * this serves the same index.html with the title and description swapped for
 * the challenge, "Can you beat Alex? Alex found 9/10 in 2:14 on Find it ·
 * Europe", and the game then boots as usual on the same address.
 *
 * Self-contained on purpose: a serverless function in an ES-module project
 * can't safely import from src/, and one that fails to load would take every
 * challenge link down with it. The decoding mirrors src/lib/challenge.ts.
 */

type Req = { url?: string; headers: Record<string, string | string[] | undefined> };
type Res = {
  setHeader(name: string, value: string): void;
  statusCode: number;
  end(body?: string): void;
};

export type PreviewChallenge = { name: string; game: string; said: string };

/** The challenge in a ?vs= value, or null for anything that isn't one. */
export function readChallenge(raw: string | null): PreviewChallenge | null {
  if (!raw || raw.length > 600) return null;
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded + "=".repeat((4 - (padded.length % 4)) % 4), "base64").toString("utf8");
    const d = JSON.parse(json) as Record<string, unknown>;
    if (typeof d.n !== "string" || typeof d.g !== "string" || typeof d.x !== "string") return null;
    const name =
      [...d.n].filter((ch) => ch >= " " && ch !== "<" && ch !== ">").join("").trim().slice(0, 16) ||
      "A friend";
    return { name, game: d.g.slice(0, 40), said: d.x.slice(0, 60) };
  } catch {
    return null;
  }
}

const TYPES: Record<string, string> = {
  name: "Name it",
  find: "Find it",
  flag: "Flags",
  famous: "Famous for",
  outline: "Outlines",
  capital: "Capitals",
};
const MODES: Record<string, string> = {
  easy: "Easy",
  hard: "Hard",
  europe: "Europe",
  africa: "Africa",
  asia: "Asia",
  americas: "Americas",
  oceania: "Oceania",
};
const DAILIES: Record<string, string> = {
  daily: "today's Country hunt",
  mystery: "the Mystery country",
  connect: "Connect",
  clues: "Five clues",
  bigger: "Which is bigger?",
};

/** "Find it · Europe", "today's Country hunt": the game, as a player says it. */
export function gameName(game: string): string {
  const [kind, mode] = game.split(":");
  if (DAILIES[kind]) return DAILIES[kind];
  if (TYPES[kind]) return MODES[mode] ? `${TYPES[kind]} · ${MODES[mode]}` : TYPES[kind];
  return "WorldGuess";
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The words a preview shows for a challenge. */
export function previewText(c: PreviewChallenge): { title: string; description: string } {
  return {
    title: `Can you beat ${c.name}?`,
    description: `${c.name} ${c.said} on ${gameName(c.game)}. Tap to play the same one.`,
  };
}

/** index.html with its title and preview tags swapped for the challenge. */
export function withPreview(html: string, c: PreviewChallenge, pageUrl: string): string {
  const { title, description } = previewText(c);
  const t = escape(title);
  const d = escape(description);
  const swap = (pattern: RegExp, value: string) => (text: string) => text.replace(pattern, value);
  return [
    swap(/<title>[^<]*<\/title>/, `<title>${t} · WorldGuess</title>`),
    swap(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${t}$2`),
    swap(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${t}$2`),
    swap(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${d}$2`),
    swap(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${d}$2`),
    swap(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${d}$2`),
    swap(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${escape(pageUrl)}$2`),
  ].reduce((text, step) => step(text), html);
}

const header = (req: Req, name: string): string => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
};

export default async function handler(req: Req, res: Res) {
  const host = header(req, "x-forwarded-host") || header(req, "host");
  const url = new URL(req.url ?? "/", `https://${host}`);
  // vercel.json passes the page asked for as ?path=; the rest of the query,
  // ?vs= included, comes along as it was.
  const path = (url.searchParams.get("path") ?? "/").replace(/^\/*/, "/");
  url.searchParams.delete("path");
  const pageUrl = `https://${host}${path}${url.search}`;

  try {
    const page = await fetch(`https://${host}/index.html`);
    if (!page.ok) throw new Error(`index.html: ${page.status}`);
    const html = await page.text();
    const challenge = readChallenge(url.searchParams.get("vs"));
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // The page is the same for everyone who opens this link; a few minutes
    // at the edge keeps a link shared in a big group from costing much.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300");
    res.end(challenge ? withPreview(html, challenge, pageUrl) : html);
  } catch {
    // Never strand a player on an error page. The same address with
    // &plain=1 skips this function (vercel.json says so), and the game reads
    // the challenge itself, so the link still works, just without a preview.
    const plain = new URL(pageUrl);
    plain.searchParams.set("plain", "1");
    res.statusCode = 307;
    res.setHeader("Location", `${plain.pathname}${plain.search}`);
    res.end();
  }
}
