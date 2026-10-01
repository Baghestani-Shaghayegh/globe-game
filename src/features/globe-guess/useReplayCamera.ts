import { useEffect, type MutableRefObject } from "react";
import type { GlobeMethods } from "react-globe.gl";

/**
 * Feeds the recording where the globe is looking, a few times a second while
 * the round runs. Polled rather than hooked to the controls' change event:
 * the game's own flights to a country tween the camera without one.
 */
export function useReplayCamera(
  globeRef: MutableRefObject<GlobeMethods | undefined>,
  active: boolean,
  look: (lat: number, lng: number, altitude: number, force?: boolean) => void
) {
  useEffect(() => {
    if (!active) return;
    let last = "";
    const sample = (force = false) => {
      const at = globeRef.current?.pointOfView();
      if (!at) return;
      const key = `${at.lat.toFixed(2)},${at.lng.toFixed(2)},${at.altitude.toFixed(2)}`;
      if (key === last && !force) return;
      last = key;
      look(at.lat, at.lng, at.altitude, force);
    };
    sample(true);
    const id = window.setInterval(() => sample(), 120);
    return () => {
      window.clearInterval(id);
      sample(true);
    };
  }, [globeRef, active, look]);
}
