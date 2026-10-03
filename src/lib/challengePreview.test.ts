import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { gameName, readChallenge, withPreview } from "../../api/challenge";
import { encodeChallenge } from "./challenge";

const html = readFileSync("index.html", "utf8");

const vs = encodeChallenge({
  name: "Alex",
  game: "find:europe:relaxed:up",
  score: 9,
  higherWins: true,
  ms: 134_000,
  said: "found 9/10 in 2:14",
});

const meta = (page: string, attr: string, key: string) =>
  page.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`))?.[1];

describe("a challenge's link preview", () => {
  it("reads the challenge the game wrote", () => {
    expect(readChallenge(vs)).toEqual({
      name: "Alex",
      game: "find:europe:relaxed:up",
      said: "found 9/10 in 2:14",
    });
    expect(readChallenge("not-a-challenge")).toBeNull();
    expect(readChallenge(null)).toBeNull();
  });

  it("names each game the way a player would", () => {
    expect(gameName("find:europe:relaxed:up")).toBe("Find it · Europe");
    expect(gameName("daily:2026-10-03")).toBe("today's Country hunt");
    expect(gameName("clues:2026-10-03")).toBe("Five clues");
    expect(gameName("bigger")).toBe("Which is bigger?");
    expect(gameName("nonsense")).toBe("WorldGuess");
  });

  it("swaps the title and description for the dare", () => {
    const page = withPreview(html, readChallenge(vs)!, "https://x.test/find/europe?vs=1");
    expect(page).toContain("<title>Can you beat Alex? · WorldGuess</title>");
    expect(meta(page, "property", "og:title")).toBe("Can you beat Alex?");
    expect(meta(page, "name", "twitter:title")).toBe("Can you beat Alex?");
    expect(meta(page, "property", "og:description")).toBe(
      "Alex found 9/10 in 2:14 on Find it · Europe. Tap to play the same one."
    );
    expect(meta(page, "property", "og:url")).toBe("https://x.test/find/europe?vs=1");
    // The game itself is untouched: same scripts, same root.
    expect(page).toContain('<div id="root"></div>');
  });

  it("can't be used to write into the page", () => {
    const evil = Buffer.from(
      JSON.stringify({ n: 'Al"><script>', g: "bigger", s: 1, h: 1, x: '"><img src=x onerror=alert(1)>' })
    ).toString("base64url");
    const page = withPreview(html, readChallenge(evil)!, "https://x.test/bigger");
    expect(page).not.toContain("<script>alert");
    expect(page).not.toContain("<img src=x");
    expect(meta(page, "property", "og:title")).toBe("Can you beat Al&quot;script?");
  });
});

describe("the function", () => {
  afterEach(() => vi.unstubAllGlobals());

  const fakeRes = () => {
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: "",
      setHeader(name: string, value: string) {
        res.headers[name] = value;
      },
      end(body = "") {
        res.body = body;
      },
    };
    return res;
  };

  it("serves the page with the challenge's preview", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200 })));
    const res = fakeRes();
    await handler({ url: `/api/challenge?path=/find/europe&vs=${vs}`, headers: { host: "x.test" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toMatch(/text\/html/);
    expect(meta(res.body, "property", "og:title")).toBe("Can you beat Alex?");
    expect(meta(res.body, "property", "og:url")).toBe(`https://x.test/find/europe?vs=${vs}`);
  });

  it("sends the player on to the plain page if anything goes wrong", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const res = fakeRes();
    await handler({ url: `/api/challenge?path=/mystery&vs=${vs}`, headers: { host: "x.test" } }, res);
    expect(res.statusCode).toBe(307);
    expect(res.headers.Location).toBe(`/mystery?vs=${vs}&plain=1`);
  });
});
