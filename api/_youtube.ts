/**
 * The server half of "Post to YouTube". It does one job: trade the code
 * Google hands back for a short-lived access token, because that trade needs
 * the client secret, which can never reach the browser. The token goes to the
 * page that asked, and the browser sends the video to YouTube itself. The
 * video never passes through here (a function body is capped at a few MB), and
 * nothing is stored: no token, no player, no table.
 *
 * Files starting with _ in api/ are not routes, so this is shared by both.
 */

export const SCOPE = "https://www.googleapis.com/auth/youtube.upload";
export const STATE_COOKIE = "gg_yt_state";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type YouTubeConfig = { clientId: string; clientSecret: string };

/** The two values from Google Cloud, or null while they aren't set. */
export function youtubeConfig(env: Record<string, string | undefined>): YouTubeConfig | null {
  const clientId = env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = env.YOUTUBE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * The address the game is being served from, which is also where Google sends
 * the player back to. It has to match a redirect URI registered on the client
 * exactly, so every host the game lives on is registered there.
 */
export function originOf(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

export const redirectUri = (origin: string) => `${origin}/api/youtube/callback`;

export function authUrl(config: YouTubeConfig, origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    state,
    // Online access: a token that lasts an hour and no refresh token to keep.
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

/** The value of one cookie from a Cookie header, or null. */
export function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

export const stateCookie = (value: string, maxAge: number) =>
  `${STATE_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/api/youtube; Max-Age=${maxAge}`;

export type Token = { token: string; expiresIn: number };

/** The code Google sent back, traded for an access token. Throws a short reason. */
export async function exchangeCode(
  config: YouTubeConfig,
  origin: string,
  code: string,
  send: typeof fetch = fetch
): Promise<Token> {
  const res = await send(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !body.access_token) throw new Error("Google would not give a token.");
  return { token: body.access_token, expiresIn: body.expires_in ?? 3600 };
}

export type Outcome = { ok: true; token: string; expiresIn: number } | { ok: false; error: string };

/**
 * The page the sign-in window ends on: it hands the outcome to the game page
 * that opened it and closes. The message is addressed to this origin only, so
 * no other page can receive the token. `<` is escaped so nothing in the
 * outcome can close the script tag.
 */
export function resultPage(origin: string, outcome: Outcome): Response {
  const data = JSON.stringify({ source: "guessglobe-youtube", ...outcome }).replace(/</g, "\\u003c");
  const to = JSON.stringify(origin).replace(/</g, "\\u003c");
  const text = outcome.ok ? "Connected. This window will close." : outcome.error;
  const html = `<!doctype html><meta charset="utf-8"><title>YouTube</title>
<body style="font:16px system-ui;background:#0b1623;color:#e4e4e7;display:grid;place-items:center;height:100vh;margin:0">
<p>${text.replace(/[<&>]/g, "")}</p>
<script>
  try { window.opener && window.opener.postMessage(${data}, ${to}); } catch (e) {}
  ${outcome.ok ? "window.close();" : ""}
</script>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": stateCookie("", 0),
    },
  });
}
