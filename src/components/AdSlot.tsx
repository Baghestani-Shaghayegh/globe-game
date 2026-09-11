import { useEffect, useRef, useSyncExternalStore } from "react";
import { adsAllowed, adsClient, fillSlot, loadAds } from "../lib/ads";
import { readConsent, subscribeToConsent } from "../lib/consent";

const SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined;

/**
 * One advertisement, or nothing at all.
 *
 * Nothing is the common case: no publisher id in this build, or no consent, or
 * a blocker eating the script. So the slot occupies no space until it has
 * something to show — an empty grey box labelled "advertisement" is worse than
 * an ad and much worse than clean space.
 *
 * Ads never appear inside a round. A question you are being timed on is not a
 * place to put something that moves, and a misclick there costs the player
 * points. The placements are the menu, the leaderboard, and the screen after a
 * round ends — the moments a player is already reading rather than playing.
 */
export default function AdSlot({ className = "" }: { className?: string }) {
  // Re-renders when the answer changes, so granting consent in the banner
  // fills the slot without a reload.
  useSyncExternalStore(subscribeToConsent, readConsent);
  const box = useRef<HTMLModElement>(null);
  const filled = useRef(false);

  const showing = adsAllowed() && Boolean(SLOT);

  useEffect(() => {
    if (!showing || filled.current || !box.current) return;
    filled.current = true;
    loadAds()
      .then(fillSlot)
      .catch(() => {
        // Blocked or offline. The slot has no height of its own, so a failure
        // leaves the page exactly as it was.
        filled.current = false;
      });
  }, [showing]);

  if (!showing) return null;

  return (
    <div className={className}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-zinc-600">
        Advertisement
      </p>
      <ins
        ref={box}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={adsClient}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
