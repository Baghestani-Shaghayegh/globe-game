import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { readConsent, setConsent, subscribeToConsent } from "../lib/consent";
import { adsConfigured } from "../lib/ads";

/**
 * The cookie question, asked once.
 *
 * Deliberately not a wall across the page: the game is playable behind it, and
 * nothing that needs consent runs until it is answered, so there is nothing to
 * block. Both buttons are the same size — a "no" that is harder to find than a
 * "yes" is the dark pattern this is meant to avoid.
 *
 * Silent on a build with no publisher id, which is every build until the site
 * is approved. Asking permission for cookies that cannot be set would be a
 * question under false pretences, and it would train people to dismiss it.
 */
export default function ConsentBanner() {
  const consent = useSyncExternalStore(subscribeToConsent, readConsent);

  if (!adsConfigured || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b1624]/95 px-5 py-4 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-relaxed text-zinc-300">
          WorldGuess is free because of ads. May we allow advertising cookies?
          Your scores and settings work either way.{" "}
          <Link
            to="/privacy"
            className="text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
          >
            How this works
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setConsent("denied")}
            className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-white/30 hover:text-zinc-100 sm:flex-none"
          >
            No thanks
          </button>
          <button
            onClick={() => setConsent("granted")}
            className="flex-1 rounded-lg bg-sky-500/25 px-4 py-2 text-sm font-medium text-sky-100 transition-colors hover:bg-sky-500/35 sm:flex-none"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
