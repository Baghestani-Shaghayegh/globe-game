import { useState } from "react";
import { drawCard, shareCard, type CardSpec } from "../lib/shareCard";

type Props = {
  /** Built when the button is pressed, so nothing is drawn until it's wanted. */
  card: () => CardSpec;
  text: string;
  filename: string;
  className?: string;
};

/**
 * Draws the result as an image and hands it to the device's share sheet —
 * which on a phone has Instagram in it. On a desktop there is no sheet, so it
 * downloads instead and says so.
 */
export default function ShareButton({ card, text, filename, className }: Props) {
  const [state, setState] = useState<"idle" | "working" | "shared" | "saved" | "failed">(
    "idle"
  );

  const go = async () => {
    if (state === "working") return;
    setState("working");
    try {
      const outcome = await shareCard(await drawCard(card()), { text, filename });
      setState(outcome === "shared" ? "shared" : outcome === "downloaded" ? "saved" : "failed");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2600);
  };

  const label = {
    idle: "Share",
    working: "Making the card…",
    shared: "Shared",
    saved: "Saved to your device",
    failed: "Couldn't make the card",
  }[state];

  return (
    <button
      onClick={go}
      disabled={state === "working"}
      className={
        className ??
        "w-full rounded-lg bg-white/10 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15 disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}
