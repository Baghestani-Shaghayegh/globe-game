import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { allBuckets } from "../lib/records";
import { refresh } from "../lib/achievements";
import { MAX_LEVEL, progressFor, totalXp, xpToReach } from "../lib/levels";
import {
  GLOBE_THEMES,
  activeThemeId,
  setGlobeTheme,
  type GlobeTheme,
} from "../lib/globeTheme";

/** A globe in miniature: enough of the palette to tell them apart at a glance. */
function Swatch({ theme }: { theme: GlobeTheme }) {
  const { palette } = theme;
  return (
    <span
      aria-hidden="true"
      className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/15"
      style={{ backgroundColor: palette.sphere }}
    >
      <span
        className="absolute inset-x-0 top-0 block h-1/2"
        style={{ backgroundColor: palette.idle }}
      />
      <span
        className="absolute bottom-1 left-1 block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: palette.found }}
      />
      <span
        className="absolute bottom-1 right-1 block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: palette.missed }}
      />
    </span>
  );
}

export default function Levels() {
  const xp = useMemo(() => totalXp(allBuckets(), refresh()), []);
  const progress = useMemo(() => progressFor(xp), [xp]);
  const [chosen, setChosen] = useState(activeThemeId);

  const choose = (theme: GlobeTheme) => {
    if (theme.level > progress.level) return;
    setGlobeTheme(theme.id);
    setChosen(theme.id);
  };

  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Level {progress.level}
        </h1>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-zinc-400">
              {xp.toLocaleString()} XP
            </span>
            <span className="text-sm tabular-nums text-zinc-500">
              {progress.toNext === null
                ? "Everything unlocked"
                : `${progress.toNext.toLocaleString()} to level ${progress.level + 1}`}
            </span>
          </div>
          <span
            aria-hidden="true"
            className="mt-3 block h-2 overflow-hidden rounded-full bg-white/[0.07]"
          >
            <span
              className="block h-full rounded-full bg-sky-400/70 transition-[width]"
              style={{ width: `${progress.share * 100}%` }}
            />
          </span>
          <p className="mt-3 text-sm text-zinc-500">
            Every round earns XP — points scored, plus a bonus for finishing a
            map and for each badge. Counted from everything you've already
            played.
          </p>
        </div>

        <h2 className="mt-9 px-1 text-sm uppercase tracking-wider text-zinc-500">
          Globe themes
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {GLOBE_THEMES.map((theme) => {
            const locked = theme.level > progress.level;
            const active = chosen === theme.id;
            return (
              <li key={theme.id}>
                <button
                  onClick={() => choose(theme)}
                  disabled={locked}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? "border-sky-400/40 bg-sky-400/[0.07]"
                      : locked
                        ? "cursor-not-allowed border-white/[0.07] bg-white/[0.02]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <span className={locked ? "opacity-30 grayscale" : ""}>
                    <Swatch theme={theme} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block font-medium ${
                        locked ? "text-zinc-500" : "text-zinc-100"
                      }`}
                    >
                      {theme.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-zinc-500">
                      {locked
                        ? `Unlocks at level ${theme.level}`
                        : active
                          ? "In use"
                          : "Tap to use"}
                    </span>
                  </span>
                  {locked && (
                    <span aria-hidden="true" className="shrink-0 text-zinc-600">
                      🔒
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-sm text-zinc-600">
          Level {MAX_LEVEL} is the last, at {xpToReach(MAX_LEVEL).toLocaleString()} XP.
        </p>
      </main>
    </div>
  );
}
