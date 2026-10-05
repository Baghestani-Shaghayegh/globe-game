import { useState } from "react";
import { playTap } from "../../lib/sound";
import {
  PRIVACY_OPTIONS,
  YouTubeError,
  connectYouTube,
  connectedToken,
  forgetYouTube,
  postToYouTube,
  type Posted,
  type Privacy,
} from "../../lib/youtube";
import type { MadeVideo } from "../../lib/replayVideo";

/** The caption's first sentence: what a video's title should say. */
const firstSentence = (caption: string) => caption.split(/(?<=[.!?])\s/)[0] ?? caption;

/**
 * The compose step's YouTube half, once direct posting is on: connect the
 * account, choose who can see it, post, and get the link. If anything goes
 * wrong the old way (save the file and open YouTube's upload page) is one
 * button away, so a failed upload never ends the visit.
 */
export default function PostToYouTube({
  video,
  caption,
  onByHand,
  button,
}: {
  video: MadeVideo | null;
  /** The caption with the game's link after it. */
  caption: string;
  onByHand: () => void;
  button: string;
}) {
  const [title, setTitle] = useState(() => firstSentence(caption));
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const [phase, setPhase] = useState<"idle" | "connecting" | "posting" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState<YouTubeError | null>(null);
  const [posted, setPosted] = useState<Posted | null>(null);

  const loud = `${button} bg-teal-300 text-teal-950 hover:bg-teal-200`;
  const quiet = `${button} border border-white/15 text-zinc-100 hover:bg-white/10`;
  const busy = phase === "connecting" || phase === "posting";

  const post = async () => {
    if (!video) return;
    playTap();
    setProblem(null);
    try {
      setPhase("connecting");
      const token = connectedToken() ?? (await connectYouTube());
      setProgress(0);
      setPhase("posting");
      setPosted(await postToYouTube(token, video.blob, title, caption, privacy, setProgress));
      setPhase("done");
    } catch (error) {
      // A token YouTube no longer accepts is dropped, so the next try asks again.
      if (error instanceof YouTubeError && error.kind === "expired") forgetYouTube();
      setProblem(error instanceof YouTubeError ? error : new YouTubeError("YouTube wasn't reached.", "failed"));
      setPhase("idle");
    }
  };

  if (phase === "done" && posted) {
    const kept = posted.privacy && posted.privacy !== privacy;
    return (
      <div className="mt-4">
        <a href={posted.url} target="_blank" rel="noopener noreferrer" className={loud}>
          ✓ Posted. Watch it on YouTube
        </a>
        {kept && (
          <p className="mt-2 text-xs text-zinc-500">
            YouTube is holding it as {posted.privacy} until it has approved the game. You can make it {privacy} from
            your channel.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <label htmlFor="youtube-title" className="text-xs text-zinc-500">
        Title
      </label>
      <input
        id="youtube-title"
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 90))}
        disabled={busy}
        className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-white/40"
      />

      <div role="radiogroup" aria-label="Who can watch" className="mt-3 grid grid-cols-3 gap-2">
        {PRIVACY_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            role="radio"
            aria-checked={value === privacy}
            disabled={busy}
            onClick={() => setPrivacy(value)}
            className={`rounded-lg border px-2 py-1.5 text-sm transition-colors ${
              value === privacy
                ? "border-teal-300 bg-teal-300/15 text-teal-200"
                : "border-white/15 text-zinc-100 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <button onClick={post} disabled={!video || busy} className={`${loud} mt-4`}>
        {phase === "connecting"
          ? "Waiting for YouTube…"
          : phase === "posting"
            ? `Posting… ${Math.round(progress * 100)}%`
            : connectedToken()
              ? "Post to YouTube"
              : "Connect YouTube and post"}
      </button>

      {problem ? (
        <div role="alert" className="mt-2 text-xs text-rose-300">
          {problem.message}
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          Lets GuessGlobe upload videos to your channel. It can't see or change anything else.
        </p>
      )}

      <button onClick={onByHand} disabled={!video || busy} className={`${quiet} mt-3`}>
        Upload by hand instead
      </button>
    </div>
  );
}
