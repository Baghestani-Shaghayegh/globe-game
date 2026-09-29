import { useSyncExternalStore } from "react";
import { globeLookKey, subscribeToTheme } from "../../lib/globeTheme";

/**
 * Re-renders the calling component when the globe palette changes, or when
 * light mode switches the globes to their daylight version.
 *
 * The palette itself is read straight from `theme`, which is mutated in place;
 * this only exists to tell React that the colours it painted last time are no
 * longer the right ones.
 */
export function useGlobeTheme(): string {
  return useSyncExternalStore(subscribeToTheme, globeLookKey, globeLookKey);
}
