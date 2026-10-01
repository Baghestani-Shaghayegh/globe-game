import { useState } from "react";
import { recordingOn, setRecordingOn } from "../../lib/replay";
import { playTap } from "../../lib/sound";

/**
 * The REC light on a round: on, the round is recorded to watch back, post
 * and save as video; tap it and this round, and the ones after, aren't kept.
 * Recording costs nothing to play with — it's the moves, not the screen.
 */
export default function RecordSwitch({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(recordingOn);
  return (
    <button
      onClick={() => {
        playTap();
        setRecordingOn(!on);
        setOn(!on);
      }}
      aria-pressed={on}
      title={on ? "Recording this round. Tap to stop." : "Not recording. Tap to record."}
      className={`pointer-events-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur transition-colors ${
        on
          ? "border-rose-400/40 bg-raised/90 text-rose-300"
          : "border-white/10 bg-raised/80 text-zinc-500"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${on ? "animate-pulse bg-rose-400" : "bg-zinc-600"}`}
      />
      REC
    </button>
  );
}
