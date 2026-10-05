import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as callback } from "../../api/youtube/callback";
import { GET as start } from "../../api/youtube/start";
import { STATE_COOKIE, authUrl, exchangeCode, originOf, readCookie, resultPage } from "../../api/_youtube";

const config = { clientId: "id.apps.googleusercontent.com", clientSecret: "shh" };
const request = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers: { host: "guessglobe.com", ...headers } });

beforeEach(() => {
  vi.stubEnv("YOUTUBE_CLIENT_ID", config.clientId);
  vi.stubEnv("YOUTUBE_CLIENT_SECRET", config.clientSecret);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("where the player is sent back to", () => {
  it("is the address the game is served from", () => {
    expect(originOf(request("https://guessglobe.com/api/youtube/start"))).toBe("https://guessglobe.com");
    expect(
      originOf(request("http://x/api", { "x-forwarded-host": "playworldguess.vercel.app", "x-forwarded-proto": "https" }))
    ).toBe("https://playworldguess.vercel.app");
    expect(originOf(request("http://localhost:3000/api", { host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
});

describe("start", () => {
  it("sends the player to Google, asking only to upload, with a state it remembers", async () => {
    const res = start(request("https://guessglobe.com/api/youtube/start"));
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get("Location")!);
    expect(to.origin + to.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(to.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/youtube.upload");
    expect(to.searchParams.get("redirect_uri")).toBe("https://guessglobe.com/api/youtube/callback");
    expect(to.searchParams.get("client_id")).toBe(config.clientId);
    expect(to.searchParams.get("access_type")).toBe("online");
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(readCookie(cookie, STATE_COOKIE)?.split(";")[0]).toBe(to.searchParams.get("state"));
    expect(res.headers.get("Location")).not.toContain("shh");
  });

  it("says so, rather than failing, while the keys are not set", () => {
    vi.stubEnv("YOUTUBE_CLIENT_SECRET", "");
    expect(start(request("https://guessglobe.com/api/youtube/start")).status).toBe(503);
  });
});

describe("callback", () => {
  const withState = (query: string, state = "abc") =>
    request(`https://guessglobe.com/api/youtube/callback?${query}`, { cookie: `${STATE_COOKIE}=${state}` });

  it("trades the code for a token and hands it only to this origin", async () => {
    const send = vi.fn(async () => Response.json({ access_token: "ya29.token", expires_in: 3599 }));
    vi.stubGlobal("fetch", send);
    const page = await (await callback(withState("code=4/xyz&state=abc"))).text();
    expect(page).toContain('"token":"ya29.token"');
    expect(page).toContain('"https://guessglobe.com"');
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("code")).toBe("4/xyz");
    expect(body.get("client_secret")).toBe("shh");
    expect(body.get("redirect_uri")).toBe("https://guessglobe.com/api/youtube/callback");
  });

  it("refuses a state that does not match the cookie, and never calls Google", async () => {
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    const page = await (await callback(withState("code=x&state=other"))).text();
    expect(page).toContain('"ok":false');
    expect(page).not.toContain("token");
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a request with no cookie at all", async () => {
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    const bare = request("https://guessglobe.com/api/youtube/callback?code=x&state=abc");
    expect(await (await callback(bare)).text()).toContain('"ok":false');
    expect(send).not.toHaveBeenCalled();
  });

  it("passes on a refusal from the player or from Google", async () => {
    expect(await (await callback(withState("error=access_denied&state=abc"))).text()).toContain('"ok":false');
    vi.stubGlobal("fetch", async () => Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect(await (await callback(withState("code=x&state=abc"))).text()).toContain('"ok":false');
  });
});

describe("the page the window ends on", () => {
  it("cannot be broken out of by what it carries", async () => {
    const page = await resultPage("https://guessglobe.com", { ok: false, error: "</script><b>" }).text();
    expect(page.match(/<\/script>/g)).toHaveLength(1);
  });

  it("clears the state cookie and is never cached", () => {
    const res = resultPage("https://guessglobe.com", { ok: true, token: "t", expiresIn: 1 });
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("helpers", () => {
  it("reads one cookie out of several", () => {
    expect(readCookie("a=1; gg=two=2; b=3", "gg")).toBe("two=2");
    expect(readCookie(null, "gg")).toBeNull();
  });

  it("reports a missing token as an error", async () => {
    await expect(exchangeCode(config, "https://x", "c", async () => Response.json({}))).rejects.toThrow();
  });

  it("builds the same redirect address for both halves", () => {
    expect(new URL(authUrl(config, "https://a.b", "s")).searchParams.get("redirect_uri")).toBe(
      "https://a.b/api/youtube/callback"
    );
  });
});
