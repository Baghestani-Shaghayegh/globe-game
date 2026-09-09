import { useSyncExternalStore } from "react";
import { activeThemeId, subscribeToTheme } from "../../lib/globeTheme";

/**
 * Re-renders the calling component when the globe palette changes.
 *
 * The palette itself is read straight from `theme`, which is mutated in place;
 * this only exists to tell React that the colours it painted last time are no
 * longer the right ones.
 */
export function useGlobeTheme(): string {
  return useSyncExternalStore(subscribeToTheme, activeThemeId, activeThemeId);
}
