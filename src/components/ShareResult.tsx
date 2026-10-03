import { useState } from "react";
import SaveVideoButton from "../features/replay/SaveVideoButton";
import type { Replay } from "../lib/replay";
import { drawCard, shareCard, type CardGlobe, type CardSpec } from "../lib/shareCard";
import { siteUrl } from "../lib/site";
import { playTap } from "../lib/sound";

type World = CardGlobe["features"];

let world: Promise<World | null> | null = null;

/** The map for the card's globe; the browser has it cached from the game. */
function loadWorld(): Promise<World | null> {
  world ??= fetch("/data/world.geojson")
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { features: World } | null) => data?.features ?? null)
    .catch(() => null);
  return world;
}

type Props = {
  /** The image, built only when asked for. Given the map if it loaded. */
  card: (features: World | null) => CardSpec;
  /** What goes with the link: "I found 9/10 on today's WorldGuess Country hunt." */
  text: string;
  filename: string;
  /**
   * The round's recording, when there is one. Then the second button shares
   * it as a video, which is what people post; the still card is only offered
   * when the round wasn't recorded.
   */
  replay?: Replay | null;
};

/**
 * The end of a game: send the result to a friend, or post it as an image.
 *
 * The link is the home page, not this game. It used to be a challenge to
 * beat this exact round, with a name to type and a banner waiting for the
 * friend; Sara chose the simpler invitation instead. The result in the
 * message carries the dare ("Your turn"), and the friend lands where every
 * game is on offer. The dailies are the same for everyone anyway, so the
 * comparison makes itself.
 */
export default function ShareResult({ card, text, filename, replay }: Props) {
  const [linkState, setLinkState] = useState<"idle" | "copied" | "failed">("idle");
  const [imageState, setImageState] = useState<"idle" | "working" | "saved" | "failed">("idle");

  const link = `${siteUrl()}/`;
  const message = `${text} Your turn:`;

  const send = async () => {
    playTap();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: message, url: link });
        return;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${message} ${link}`);
      setLinkState("copied");
    } catch {
      setLinkState("failed");
    }
    window.setTimeout(() => setLinkState("idle"), 2600);
  };

  const shareImage = async () => {
    if (imageState === "working") return;
    playTap();
    setImageState("working");
    try {
      const blob = await drawCard(card(await loadWorld()));
      const outcome = await shareCard(blob, { text: `${message} ${link}`, filename });
      setImageState(outcome === "downloaded" ? "saved" : outcome === "failed" ? "failed" : "idle");
    } catch {
      setImageState("failed");
    }
    window.setTimeout(() => setImageState("idle"), 2600);
  };

  return (
    <div className="flex gap-2 text-left">
      <button
        onClick={send}
        className="flex-[1.4] whitespace-nowrap rounded-lg bg-teal-300 px-3 py-2 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
      >
        {linkState === "copied"
          ? "Link copied"
          : linkState === "failed"
            ? "Couldn't copy"
            : "Challenge a friend"}
      </button>
      {replay ? (
        <SaveVideoButton replay={replay} className="flex-1" />
      ) : (
        <button
          onClick={shareImage}
          disabled={imageState === "working"}
          className="flex-1 whitespace-nowrap rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          {imageState === "working"
            ? "Making it…"
            : imageState === "saved"
              ? "Image saved"
              : imageState === "failed"
                ? "Couldn't make it"
                : "Share image"}
        </button>
      )}
    </div>
  );
}
