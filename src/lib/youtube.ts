/**
 * Posting a video to YouTube from the share panel.
 *
 * Connecting opens a small window on /api/youtube/start; when the player
 * agrees, that window hands back an access token and closes. The token lasts
 * about an hour and is kept in memory only (never storage), so a reload asks
 * again. The video then goes from this page straight to YouTube, in the
 * resumable-upload shape its API documents. Nothing passes through our server.
 *
 * Until Google has approved the app, a video posted this way is held as
 * private whatever was asked for, and only listed test users can connect.
 * `VITE_YOUTUBE_DIRECT=1` turns the button on, so it stays dark for everyone
 * else until then.
 */

export type Privacy = "public" | "unlisted" | "private";

export const PRIVACY_OPTIONS: { value: Privacy; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted" },
  { value: "private", label: "Private" },
];

export const youtubeDirect = () => import.meta.env.VITE_YOUTUBE_DIRECT === "1" || reviewMode();

/**
 * Review mode, for Google's reviewers. Opening the site with ?review=youtube
 * shows the share panel's posting row, YouTube's direct posting included, in
 * that tab only; everyone else still sees neither until the app is approved.
 * Google asks that an unverified permission be reachable like this rather than
 * by every player. Kept for the tab (main.tsx reads it on load), so a round
 * can be played first without losing it.
 */
const REVIEW_KEY = "guessglobe-review";

export function reviewMode(): boolean {
  try {
    if (new URLSearchParams(location.search).get("review") === "youtube") {
      sessionStorage.setItem(REVIEW_KEY, "youtube");
      return true;
    }
    return sessionStorage.getItem(REVIEW_KEY) === "youtube";
  } catch {
    return false;
  }
}

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

/** A reason the player can read, for each way this can fail. */
export class YouTubeError extends Error {
  readonly kind: "closed" | "blocked" | "denied" | "expired" | "quota" | "failed";
  constructor(message: string, kind: YouTubeError["kind"]) {
    super(message);
    this.kind = kind;
  }
}

// ---- Connecting -----------------------------------------------------------

let kept: { token: string; until: number } | null = null;

/** The token from earlier in this visit, if it still has a few minutes left. */
export function connectedToken(now = Date.now()): string | null {
  return kept && kept.until - now > 5 * 60_000 ? kept.token : null;
}

export function forgetYouTube() {
  kept = null;
}

type Message = { source?: string; ok?: boolean; token?: string; expiresIn?: number; error?: string };

/** Opens the sign-in window and resolves with the access token. */
export function connectYouTube(): Promise<string> {
  const existing = connectedToken();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const popup = window.open("/api/youtube/start", "guessglobe-youtube", "popup,width=520,height=700");
    if (!popup) {
      reject(new YouTubeError("The sign-in window was blocked. Allow pop-ups for this site and try again.", "blocked"));
      return;
    }

    const finish = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(watch);
    };
    const onMessage = (event: MessageEvent<Message>) => {
      // Only our own sign-in window, from our own address.
      if (event.origin !== window.location.origin || event.source !== popup) return;
      const data = event.data;
      if (!data || data.source !== "guessglobe-youtube") return;
      finish();
      if (data.ok && data.token) {
        kept = { token: data.token, until: Date.now() + (data.expiresIn ?? 3600) * 1000 };
        resolve(data.token);
      } else {
        reject(new YouTubeError(data.error ?? "YouTube wasn't connected.", "denied"));
      }
    };
    // A window closed by hand never sends anything, so it is watched for.
    const watch = window.setInterval(() => {
      if (!popup.closed) return;
      finish();
      reject(new YouTubeError("The sign-in window was closed.", "closed"));
    }, 500);
    window.addEventListener("message", onMessage);
  });
}

// ---- Uploading ------------------------------------------------------------

/** What YouTube is told about the video. "#Shorts" is what marks a short vertical video as one. */
export function youtubeMetadata(title: string, description: string, privacy: Privacy) {
  const clean = (text: string, max: number) => text.replace(/[<>]/g, "").trim().slice(0, max);
  return {
    snippet: {
      title: clean(title, 90) || "GuessGlobe",
      description: clean(`${description}\n\n#Shorts #geography #quiz`, 4000),
      categoryId: "20", // Gaming
    },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };
}

/** The reason for a failed request, put the way a player would want it. */
export function uploadFailure(status: number, body: string): YouTubeError {
  if (status === 401) return new YouTubeError("YouTube signed you out. Connect again.", "expired");
  if (/quota/i.test(body)) {
    return new YouTubeError("The game has used up YouTube's uploads for today. Try again tomorrow.", "quota");
  }
  if (status === 403) return new YouTubeError("YouTube wouldn't let this account post a video.", "denied");
  return new YouTubeError("YouTube wouldn't take the video.", "failed");
}

export type Posted = { id: string; url: string; privacy: string };

/** Asks YouTube for an upload address for this video. */
export async function startUpload(
  token: string,
  blob: Blob,
  metadata: ReturnType<typeof youtubeMetadata>,
  send: typeof fetch = fetch
): Promise<string> {
  const res = await send(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": blob.type || "video/mp4",
      "X-Upload-Content-Length": String(blob.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw uploadFailure(res.status, await res.text().catch(() => ""));
  const where = res.headers.get("Location");
  if (!where) throw new YouTubeError("YouTube wouldn't take the video.", "failed");
  return where;
}

/** Sends the video to the address from startUpload, reporting how far it got. */
function sendVideo(where: string, blob: Blob, onProgress: (share: number) => void): Promise<Posted> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", where);
    request.setRequestHeader("Content-Type", blob.type || "video/mp4");
    request.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    request.onerror = () => reject(new YouTubeError("The connection dropped before the video was sent.", "failed"));
    request.onload = () => {
      if (request.status < 200 || request.status > 299) {
        reject(uploadFailure(request.status, request.responseText));
        return;
      }
      try {
        const video = JSON.parse(request.responseText) as { id: string; status?: { privacyStatus?: string } };
        resolve({ id: video.id, url: `https://youtube.com/shorts/${video.id}`, privacy: video.status?.privacyStatus ?? "" });
      } catch {
        reject(new YouTubeError("YouTube took the video but sent nothing back. Check your channel.", "failed"));
      }
    };
    request.send(blob);
  });
}

export async function postToYouTube(
  token: string,
  blob: Blob,
  title: string,
  description: string,
  privacy: Privacy,
  onProgress: (share: number) => void
): Promise<Posted> {
  const where = await startUpload(token, blob, youtubeMetadata(title, description, privacy));
  return sendVideo(where, blob, onProgress);
}
