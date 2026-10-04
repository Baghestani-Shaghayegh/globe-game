import { useState } from "react";
import type { Replay } from "../lib/replay";
import { drawCard, shareCard, type CardGlobe, type CardSpec } from "../lib/shareCard";
import { siteUrl } from "../lib/site";
import { playTap } from "../lib/sound";
import { SendMenu } from "./SendTargets";

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
  /** What goes with the link: "I found 9/10 on today's GuessGlobe Country hunt." */
  text: string;
  filename: string;
  /**
   * Where the link goes, from the site root: "/clues?d=276". Left out, it is
   * the home page. The dailies send a friend straight to the game, so a
   * result isn't a puzzle they have to go and find.
   */
  path?: string;
  /**
   * The row of squares for the result, on a line of its own after the text.
   * Spoiler-free by construction: see shareGrid.
   */
  grid?: string;
  /**
   * The round's recording, when there is one. The video is then shared from
   * the Watch player, so no second button is drawn here; the still card is
   * only offered when the round wasn't recorded.
   */
  replay?: Replay | null;
};

/**
 * The end of a game: send the result to a friend, or post it as an image.
 *
 * The link is the home page unless a game gives a path. It used to be a
 * challenge to beat this exact round, with a name to type and a banner waiting
 * for the friend; that was dropped for the simpler invitation. The result in
 * the message carries the dare ("Your turn"). The dailies pass their own page
 * and number, so the friend lands in the game and not on a menu; a number for
 * a day that has passed still opens today's, since a day can't be replayed.
 * The dailies are the same for everyone, so the comparison makes itself.
 *
 * "Challenge a friend" opens the device's share menu, which lists every app
 * installed (Messages, WhatsApp, KakaoTalk), on a Mac as on a phone. A
 * browser without one gets a small panel of send buttons instead.
 */
export default function ShareResult({ card, text, filename, path = "/", grid, replay }: Props) {
  const [imageState, setImageState] = useState<"idle" | "working" | "saved" | "failed">("idle");
  const [menu, setMenu] = useState(false);

  const link = `${siteUrl()}${path}`;
  const message = grid ? `${text}\n${grid}\nYour turn:` : `${text} Your turn:`;

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
    setMenu(true);
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
        Challenge a friend
      </button>
      {/* A recorded round has its video shared from inside Watch, so this
          row is the one button. The still card is only offered when the round
          wasn't recorded and there is no video to watch. */}
      {!replay && (
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
      {menu && <SendMenu message={message} link={link} onClose={() => setMenu(false)} />}
    </div>
  );
}
