import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SendTargets } from "../../components/SendTargets";
import type { Replay } from "../../lib/replay";
import { loadReplayAssets } from "../../lib/replayDraw";
import { makeReplayVideo, type MadeVideo } from "../../lib/replayVideo";
import { downloadFile, onComputer } from "../../lib/shareCard";
import { siteHost, siteUrl } from "../../lib/site";
import { playTap } from "../../lib/sound";

/**
 * One way to do everything with a round's video: watch it, save it, share
 * it, post it, send it.
 *
 * There used to be a "Save video" button on the result and another in the
 * replay player, neither of which could share on a computer. Now both
 * places have the same "Share video" button, which opens this panel.
 *
 * The video is made as the panel opens and kept for the visit. Then:
 * - Share: the device's own share menu. On a phone that is where Instagram,
 *   TikTok, WhatsApp, KakaoTalk, LINE and the rest live.
 * - Download: the file itself.
 * - Post to TikTok, Instagram, YouTube: a compose step with the caption.
 *   Until a platform approves the game for posting, its button saves the
 *   video, copies the caption and opens the upload page. Once approved,
 *   the platform's entry in POSTING turns to "direct" and the same screen
 *   connects the player's account and posts. See docs on approvals.
 * - Send the link: WhatsApp, Messages, Telegram, email and the rest, only
 *   where the browser has no share menu. Where it has one, Share already
 *   lists every app installed, KakaoTalk included.
 */

type Platform = "tiktok" | "instagram" | "youtube";

/**
 * How each platform is posted to. "upload" until its approval comes through
 * (a server route for the sign-in and the upload is built alongside); then
 * "direct", and the compose step offers Connect and Post.
 */
const POSTING: Record<Platform, { name: string; mode: "upload" | "direct"; upload: string; tip: string }> = {
  tiktok: {
    name: "TikTok",
    mode: "upload",
    upload: "https://www.tiktok.com/upload",
    tip: "Drop the video into TikTok's upload page and paste the caption.",
  },
  instagram: {
    name: "Instagram",
    mode: "upload",
    upload: "https://www.instagram.com/",
    tip: "On Instagram press + Create, pick the video and paste the caption.",
  },
  youtube: {
    name: "YouTube",
    mode: "upload",
    upload: "https://www.youtube.com/upload",
    tip: "Drop the video into YouTube's upload page. Vertical and short, it becomes a Short.",
  },
};

/** Made videos, kept for the visit, so the panel never makes one twice. */
const made = new WeakMap<Replay, MadeVideo>();

export default function ShareVideo({
  replay,
  player,
  className = "",
}: {
  replay: Replay;
  player?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          playTap();
          setOpen(true);
        }}
        className={`whitespace-nowrap rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/10 ${className}`}
      >
        Share video
      </button>
      {open &&
        createPortal(
          <VideoPanel replay={replay} player={player} onClose={() => setOpen(false)} />,
          document.body
        )}
    </>
  );
}

function VideoPanel({
  replay,
  player,
  onClose,
}: {
  replay: Replay;
  player?: string;
  onClose: () => void;
}) {
  const [video, setVideo] = useState<MadeVideo | null>(() => made.get(replay) ?? null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [posting, setPosting] = useState<Platform | null>(null);
  const [opened, setOpened] = useState<Platform | null>(null);
  const link = `${siteUrl()}/`;
  const [caption, setCaption] = useState(`My ${replay.game.label} run on WorldGuess. Your turn:`);
  const computer = onComputer();

  const filename = video ? `worldguess-${replay.game.type}-${replay.game.mode}.${video.ext}` : "";
  const file = useMemo(
    () => (video ? new File([video.blob], filename, { type: video.blob.type }) : null),
    [video, filename]
  );
  const canShare = useMemo(() => {
    if (!file || typeof navigator.canShare !== "function") return false;
    try {
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  }, [file]);

  // Made as soon as the panel opens; kept for next time.
  useEffect(() => {
    if (video) return;
    let cancelled = false;
    (async () => {
      try {
        const assets = await loadReplayAssets(replay);
        const result = await makeReplayVideo(replay, assets, {
          player,
          site: siteHost(),
          onProgress: (share) => !cancelled && setProgress(share),
        });
        made.set(replay, result);
        if (!cancelled) setVideo(result);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [replay, player, video]);

  // A preview of what's being posted, played from the made file. Made and
  // revoked in the same effect, so a remount never leaves a dead URL.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!video) return;
    const url = URL.createObjectURL(video.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (posting) setPosting(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, posting]);

  const ready = !!video;
  const fullCaption = `${caption} ${link}`;

  const download = () => {
    if (!video) return;
    playTap();
    if (downloadFile(video.blob, filename) !== "failed") setSaved(true);
  };

  const share = async () => {
    if (!file) return;
    playTap();
    try {
      await navigator.share({ files: [file], text: fullCaption });
    } catch {
      /* closed the share menu: nothing to undo */
    }
  };

  /** Until direct posting: save the file, copy the caption, open the upload page. */
  const uploadTo = async (platform: Platform) => {
    if (!video) return;
    playTap();
    if (!saved && downloadFile(video.blob, filename) !== "failed") setSaved(true);
    window.open(POSTING[platform].upload, "_blank", "noopener");
    try {
      await navigator.clipboard.writeText(fullCaption);
    } catch {
      /* the caption is on screen to copy by hand */
    }
    setOpened(platform);
  };

  const button =
    "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50";
  const quiet = `${button} border border-white/15 text-zinc-100 hover:bg-white/10`;
  const loud = `${button} bg-teal-300 text-teal-950 hover:bg-teal-200`;

  const previewBox = (size: string) => (
    <div className={`flex aspect-[9/16] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#07111c] ${size}`}>
      {preview ? (
        <video src={preview} autoPlay muted loop playsInline className="h-full w-full object-cover" />
      ) : failed ? (
        <p className="px-3 text-center text-xs text-rose-300">This browser couldn't make the video.</p>
      ) : (
        <div className="w-3/5 text-center">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-teal-300" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs tabular-nums text-zinc-400">Making it… {Math.round(progress * 100)}%</p>
        </div>
      )}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-label="Share your video"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-page/80 p-3 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-surface p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          {posting ? (
            <button
              onClick={() => setPosting(null)}
              className="rounded-md py-1 text-sm text-zinc-400 hover:text-zinc-100"
            >
              ← Back
            </button>
          ) : (
            <h2 className="text-base font-semibold text-zinc-50">Your run as a video</h2>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-lg leading-none text-zinc-500 hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        {posting ? (
          // ---- Posting to one platform ------------------------------------
          <div className="mt-2">
            <h2 className="text-lg font-semibold text-zinc-50">Post to {POSTING[posting].name}</h2>
            <div className="mt-3 flex gap-3">
              {previewBox("w-28")}
              <div className="min-w-0 flex-1">
                <label htmlFor="video-caption" className="text-xs text-zinc-500">
                  Caption
                </label>
                <textarea
                  id="video-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 300))}
                  rows={5}
                  className="mt-1 w-full resize-none rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-white/40"
                />
                <p className="text-xs text-zinc-500">The link to the game goes after it.</p>
              </div>
            </div>
            {POSTING[posting].mode === "upload" ? (
              <>
                <button onClick={() => uploadTo(posting)} disabled={!ready} className={`${loud} mt-4`}>
                  {opened === posting ? `Open ${POSTING[posting].name} again` : `Save video and open ${POSTING[posting].name}`}
                </button>
                <p className="mt-2 text-xs text-zinc-500">
                  {opened === posting
                    ? `✓ Video in Downloads, caption copied. ${POSTING[posting].tip}`
                    : `Saves the video, copies the caption and opens ${POSTING[posting].name} in a new tab. ${POSTING[posting].tip}`}
                </p>
              </>
            ) : null}
          </div>
        ) : (
          // ---- Everything else ---------------------------------------------
          <>
            <div className="mt-3 flex justify-center">{previewBox("w-36")}</div>

            <div className="mt-4 flex gap-2">
              {canShare && (
                <button onClick={share} disabled={!ready} className={loud}>
                  Share
                </button>
              )}
              <button onClick={download} disabled={!ready} className={canShare ? quiet : loud}>
                {saved ? "✓ Saved to Downloads" : "Download"}
              </button>
            </div>
            {canShare && (
              <p className="mt-1.5 text-center text-xs text-zinc-500">
                {computer
                  ? "Share lists the apps on this computer: Messages, Mail, KakaoTalk and more."
                  : "Share opens your phone's menu: Instagram, TikTok, WhatsApp, KakaoTalk and more."}
              </p>
            )}

            <p className="mt-4 text-xs text-zinc-500">Post it</p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(Object.keys(POSTING) as Platform[]).map((platform) => (
                <button
                  key={platform}
                  onClick={() => {
                    playTap();
                    setPosting(platform);
                  }}
                  className="rounded-lg border border-white/15 px-2 py-2 text-sm text-zinc-100 transition-colors hover:bg-white/10"
                >
                  {POSTING[platform].name}
                </button>
              ))}
            </div>

            {ready && !canShare && (
              <>
                <p className="mt-4 text-xs text-zinc-500">Send the link</p>
                <div className="mt-1.5">
                  <SendTargets message={caption} link={link} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
