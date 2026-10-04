import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KAKAO_KEY, shareTargets, shareToKakao } from "../lib/shareTargets";
import { siteUrl } from "../lib/site";
import { playTap } from "../lib/sound";

/**
 * A row of places to send a message and link: WhatsApp, Messages, Telegram,
 * KakaoTalk (once its key is set), email, X, Facebook, and Copy. Only for a
 * browser with no share menu of its own (Firefox on a computer, say). Where
 * there is one, it already lists every app installed, KakaoTalk included,
 * and this row would only repeat it.
 */
export function SendTargets({ message, link }: { message: string; link: string }) {
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const targets = shareTargets();
  const tile =
    "rounded-lg border border-white/15 px-2 py-2 text-center text-sm text-zinc-100 transition-colors hover:bg-white/10";
  return (
    <div className="grid grid-cols-3 gap-2">
      {targets.map((t) => (
        <a
          key={t.id}
          href={t.href(message, link)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={playTap}
          className={tile}
        >
          {t.name}
        </a>
      ))}
      {KAKAO_KEY && (
        <button
          onClick={() => {
            playTap();
            void shareToKakao(message, link, `${siteUrl()}/og.png?v=2`);
          }}
          className={tile}
        >
          KakaoTalk
        </button>
      )}
      <button
        onClick={async () => {
          playTap();
          try {
            await navigator.clipboard.writeText(`${message} ${link}`);
            setCopied("copied");
          } catch {
            // The text is on screen to select; say it didn't copy.
            setCopied("failed");
          }
          window.setTimeout(() => setCopied(null), 2000);
        }}
        aria-live="polite"
        className={tile}
      >
        {copied === "copied" ? "Copied ✓" : copied === "failed" ? "Couldn't copy" : "Copy link"}
      </button>
    </div>
  );
}

/** The same row in a small panel of its own, for "Challenge a friend" with no share menu. */
export function SendMenu({
  message,
  link,
  onClose,
}: {
  message: string;
  link: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-label="Send to a friend"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-page/80 p-3 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-50">Challenge a friend</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-lg leading-none text-zinc-500 hover:text-zinc-200"
          >
            ×
          </button>
        </div>
        <p className="mt-2 whitespace-pre-line rounded-lg bg-white/[0.04] p-3 text-sm text-zinc-200">
          {message} <span className="text-teal-300">{link}</span>
        </p>
        <p className="mt-4 text-xs text-zinc-500">Send it with</p>
        <div className="mt-1.5">
          <SendTargets message={message} link={link} />
        </div>
      </div>
    </div>,
    document.body
  );
}
