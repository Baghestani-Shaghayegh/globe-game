import { exchangeCode, originOf, readCookie, resultPage, STATE_COOKIE, youtubeConfig } from "../_youtube.js";

/** Where Google sends the player back to. Ends by handing the token to the game page. */
export async function GET(request: Request): Promise<Response> {
  const origin = originOf(request);
  const config = youtubeConfig(process.env);
  if (!config) return resultPage(origin, { ok: false, error: "YouTube posting isn't set up yet." });

  const query = new URL(request.url).searchParams;
  if (query.get("error")) return resultPage(origin, { ok: false, error: "YouTube wasn't connected." });

  // The state is made in start.ts and kept in a cookie only this browser has,
  // so a link someone else crafted can't finish a sign-in in this one.
  const state = query.get("state");
  const code = query.get("code");
  if (!code || !state || state !== readCookie(request.headers.get("cookie"), STATE_COOKIE)) {
    return resultPage(origin, { ok: false, error: "That sign-in link expired. Try again." });
  }

  try {
    const { token, expiresIn } = await exchangeCode(config, origin, code);
    return resultPage(origin, { ok: true, token, expiresIn });
  } catch {
    return resultPage(origin, { ok: false, error: "YouTube wasn't connected." });
  }
}
