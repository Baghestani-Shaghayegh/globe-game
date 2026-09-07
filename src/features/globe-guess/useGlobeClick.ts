import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Click detection for the globe.
 *
 * The library's own onPolygonClick never fires if the pointer moves at all
 * between press and release: touch and pen get a one-pixel tolerance, but for
 * a mouse any movement counts as a drag and the click is thrown away. A real
 * hand is never that still, so countries took several attempts to select.
 *
 * This allows a few pixels of drift instead, and reuses the library's own
 * raycasting rather than repeating it — but reads it at the moment of pressing,
 * because the library stops updating what is hovered as soon as it decides a
 * drag has begun, which by pointerup has already cleared it to nothing.
 */
const DRIFT_TOLERANCE_PX = 9;
const MAX_PRESS_MS = 700;

export function useGlobeClick<T>(onClick: (target: T) => void) {
  const hovered = useRef<T | null>(null);
  const pressed = useRef<{
    x: number;
    y: number;
    at: number;
    /** What was under the pointer when it went down. */
    target: T | null;
  } | null>(null);

  /** Only presses that start on the canvas count — not ones on the UI over it. */
  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    pressed.current =
      (event.target as HTMLElement).tagName === "CANVAS"
        ? {
            x: event.clientX,
            y: event.clientY,
            at: performance.now(),
            target: hovered.current,
          }
        : null;
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const from = pressed.current;
      pressed.current = null;
      if (!from || (event.target as HTMLElement).tagName !== "CANVAS") return;

      const drift = Math.hypot(event.clientX - from.x, event.clientY - from.y);
      // A real drag rotates the globe and must not also select a country.
      if (drift > DRIFT_TOLERANCE_PX) return;
      if (performance.now() - from.at > MAX_PRESS_MS) return;

      // What was under the pointer when it went down, or — if the library's
      // throttled raycast hadn't caught up by then, as happens on a quick
      // click — whatever it knows now. A drag clears the latter, and is
      // excluded by the drift check above anyway.
      const target = from.target ?? hovered.current;
      if (target) onClick(target);
    },
    [onClick]
  );

  /**
   * Also drives the cursor: the library only offers that for its own click
   * handler, which this replaces.
   */
  const setHovered = useCallback((target: T | null, canvas?: HTMLElement) => {
    hovered.current = target;
    const element =
      canvas ?? (document.querySelector("canvas") as HTMLElement | null);
    if (element) element.style.cursor = target ? "pointer" : "";
  }, []);

  return { onPointerDown, onPointerUp, setHovered };
}
