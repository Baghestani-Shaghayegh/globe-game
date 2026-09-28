import { useSyncExternalStore } from "react";
import { playTap } from "../lib/sound";
import {
  appearance,
  setAppearance,
  subscribeToAppearance,
} from "../lib/appearance";

/**
 * The sun and moon in the header: one press between light and dark.
 *
 * "Match device" lives in Settings with the other two; here a single button
 * has to do the obvious thing, which is to flip what is on screen now.
 */
export default function ThemeToggle() {
  useSyncExternalStore(subscribeToAppearance, appearance);
  const light = document.documentElement.dataset.theme === "light";

  return (
    <button
      type="button"
      onClick={() => {
        playTap();
        setAppearance(light ? "dark" : "light");
      }}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Dark mode" : "Light mode"}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
    >
      {light ? (
        // Moon: what you get by pressing it.
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      ) : (
        // Sun.
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
