import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

/**
 * "A new version is ready", offered rather than imposed.
 *
 * The service worker is registered with `prompt`, so a new build downloads in
 * the background and then waits. That matters for a game: taking over
 * immediately would reload the page, and a reload during a timed round loses
 * it. The player picks the moment instead.
 *
 * Registration happens here rather than at startup so the toast and the worker
 * that triggers it can't get out of step.
 */
export default function UpdateToast() {
  const [ready, setReady] = useState(false);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setReady(true);
        // Stored as a thunk: `useState` calls a bare function argument.
        setUpdate(() => () => updateSW(true));
      },
    });
  }, []);

  if (!ready) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-40 px-5 pb-4 sm:inset-x-auto sm:right-5 sm:w-80"
    >
      <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#0b1624]/95 px-4 py-3 shadow-lg backdrop-blur">
        <p className="flex-1 text-sm text-zinc-300">A new version is ready.</p>
        <button
          onClick={() => void update?.()}
          className="shrink-0 rounded-lg bg-sky-500/25 px-3 py-1.5 text-sm font-medium text-sky-100 transition-colors hover:bg-sky-500/35"
        >
          Reload
        </button>
        <button
          onClick={() => setReady(false)}
          aria-label="Not now"
          className="shrink-0 text-lg leading-none text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ×
        </button>
      </div>
    </div>
  );
}
