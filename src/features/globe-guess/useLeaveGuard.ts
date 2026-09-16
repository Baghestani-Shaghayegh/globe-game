import { useEffect, useRef } from "react";

/**
 * Makes the browser's Back answer the same question the game's own back
 * arrow does.
 *
 * The arrow in the corner has always asked before abandoning a run with
 * progress in it. Back did not — and Back is not only a button: on a Mac it
 * is a two-finger swipe, which is easy to do by accident while dragging a
 * globe around, and on a phone it is the edge swipe people navigate with all
 * day. Losing a half-finished round to a gesture you did not mean to make is
 * the worst version of this, because there is nothing to undo afterwards.
 *
 * React Router's own blocker needs a data router; this app uses
 * BrowserRouter, so the guard is done against history directly. A spare entry
 * is pushed while a run is worth keeping, so there is something for Back to
 * consume; when it is consumed the entry is put straight back and the
 * question is asked instead. Back stays where it is, rather than being
 * disabled — the gesture still does something, it just asks first.
 */
export function useLeaveGuard(active: boolean, onAttempt: () => void) {
  // Read through a ref so a fresh callback each render does not tear the
  // listener down and rebuild it — which would push a second spare entry.
  const attempt = useRef(onAttempt);
  attempt.current = onAttempt;

  useEffect(() => {
    if (!active) return;

    const armed = { current: true };
    window.history.pushState({ worldguessGuard: true }, "");

    const onPop = () => {
      if (!armed.current) return;
      // Replace what the gesture just consumed, so the next Back has
      // something to eat too and the player stays where they are.
      window.history.pushState({ worldguessGuard: true }, "");
      attempt.current();
    };

    window.addEventListener("popstate", onPop);
    return () => {
      armed.current = false;
      window.removeEventListener("popstate", onPop);
    };
  }, [active]);
}
