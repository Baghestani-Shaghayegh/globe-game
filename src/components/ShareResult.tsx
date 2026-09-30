import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import {
  challengeFromUrl,
  challengeLink,
  cleanName,
  saveShareName,
  savedShareName,
  verdict,
  type Challenge,
} from "../lib/challenge";
import { drawCard, shareCard, type CardGlobe, type CardSpec } from "../lib/shareCard";
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
  /** This result as a challenge; the name is added from the box. */
  mine: Omit<Challenge, "name">;
  /** The image, built only when asked for. Given the map if it loaded. */
  card: (features: World | null) => CardSpec;
  /** What goes with the link: "I found 9/10 in 2:14 on WorldGuess." */
  text: string;
  filename: string;
};

/**
 * The end of a game: send it to a friend as a challenge, or post the result
 * as an image. And, if this game was opened from someone's challenge, how
 * you did against them.
 *
 * The challenge comes first because it brings someone back to play; an image
 * in a story is seen and scrolled past. Both carry the link.
 */
export default function ShareResult({ mine, card, text, filename }: Props) {
  const { profile } = useAuth();
  const { search } = useLocation();
  const [theirs] = useState(() => challengeFromUrl(search));
  const [name, setName] = useState(() => savedShareName() || profile?.username || "");
  const [linkState, setLinkState] = useState<"idle" | "copied" | "failed">("idle");
  const [imageState, setImageState] = useState<"idle" | "working" | "saved" | "failed">("idle");

  const challenge: Challenge = { ...mine, name: cleanName(name) };
  const link = challengeLink(challenge, window.location.href);
  const result = theirs ? verdict(challenge, theirs) : null;

  const remember = () => {
    if (name.trim()) saveShareName(name.trim());
  };

  const sendChallenge = async () => {
    playTap();
    remember();
    const message = `${text} Beat it:`;
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
    remember();
    setImageState("working");
    try {
      const blob = await drawCard(card(await loadWorld()));
      const outcome = await shareCard(blob, { text: `${text} ${link}`, filename });
      setImageState(outcome === "downloaded" ? "saved" : outcome === "failed" ? "failed" : "idle");
    } catch {
      setImageState("failed");
    }
    window.setTimeout(() => setImageState("idle"), 2600);
  };

  return (
    <div className="text-left">
      {theirs && result && (
        <div
          className={`mb-3 rounded-lg px-3 py-2.5 text-sm ${
            result === "won"
              ? "bg-emerald-400/10 text-emerald-200"
              : result === "lost"
                ? "bg-rose-400/10 text-rose-200"
                : "bg-white/5 text-zinc-200"
          }`}
        >
          <p className="font-semibold">
            {result === "won"
              ? `You beat ${theirs.name}`
              : result === "lost"
                ? `${theirs.name} wins this one`
                : `A tie with ${theirs.name}`}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {theirs.name} {theirs.said}. You {mine.said}.
          </p>
        </div>
      )}

      <label className="block text-xs text-zinc-500" htmlFor="share-name">
        Your name on it
      </label>
      <input
        id="share-name"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 16))}
        placeholder="A friend"
        autoComplete="nickname"
        className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
      />
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={sendChallenge}
          className="flex-[1.4] whitespace-nowrap rounded-lg bg-teal-300 px-3 py-2 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
        >
          {linkState === "copied"
            ? "Link copied"
            : linkState === "failed"
              ? "Couldn't copy"
              : "Challenge a friend"}
        </button>
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
      </div>
    </div>
  );
}
