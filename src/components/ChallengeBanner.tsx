import { useState } from "react";
import { useLocation } from "react-router-dom";
import { challengeFromUrl } from "../lib/challenge";

/**
 * What a friend's challenge link says before you play: "Sara found 9/10 in
 * 2:14. Beat it." Over the top of the game, out of the way of the globe, and
 * gone with a tap.
 */
export default function ChallengeBanner({ className = "" }: { className?: string }) {
  const { search } = useLocation();
  const [challenge] = useState(() => challengeFromUrl(search));
  const [open, setOpen] = useState(true);
  if (!challenge || !open) return null;
  return (
    <div
      role="status"
      className={`pointer-events-auto z-40 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-full border border-teal-300/40 bg-raised/95 py-1.5 pl-4 pr-1.5 text-sm shadow-xl backdrop-blur ${className}`}
    >
      <span className="text-zinc-100">
        <span className="font-semibold text-teal-200">{challenge.name}</span>{" "}
        {challenge.said}. Beat it.
      </span>
      <button
        onClick={() => setOpen(false)}
        aria-label="Close"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
      >
        ✕
      </button>
    </div>
  );
}
