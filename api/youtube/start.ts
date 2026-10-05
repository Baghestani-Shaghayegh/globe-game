import { authUrl, originOf, stateCookie, youtubeConfig } from "../_youtube.js";

/** Opens in a small window from the share panel and sends the player to Google. */
export function GET(request: Request): Response {
  const config = youtubeConfig(process.env);
  if (!config) return new Response("YouTube posting isn't set up yet.", { status: 503 });

  const state = crypto.randomUUID();
  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl(config, originOf(request), state),
      "Cache-Control": "no-store",
      "Set-Cookie": stateCookie(state, 600),
    },
  });
}
