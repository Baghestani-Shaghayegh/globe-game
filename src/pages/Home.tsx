import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ModeCard from "../components/ModeCard";
import ContinentCard from "../components/ContinentCard";
import { getCountryMeta } from "../data/countries";
import {
  GAME_TYPES,
  MODES,
  RULESETS,
  TIME_LIMITS,
  gamePath,
  recordKey,
  type GameType,
  type Ruleset,
  type ModeId,
} from "../data/modes";
import { bestLabel } from "../lib/records";

// Three.js is heavy — let the menu paint first, then fade the globe in behind it.
const BackgroundGlobe = lazy(() => import("../components/BackgroundGlobe"));

type Counts = Partial<Record<ModeId, number>>;

/**
 * How many places each mode asks for, read from the same map the game uses so
 * the cards can't drift out of date. The globe behind the menu fetches this
 * file too, so it comes from the browser cache.
 */
function useModeCounts(): Counts {
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { features: { properties: { name: string } }[] }) => {
        if (cancelled) return;
        const metas = data.features.map((f) =>
          getCountryMeta(f.properties.name)
        );
        setCounts(
          Object.fromEntries(
            MODES.map((mode) => [
              mode.id,
              metas.filter((meta) => mode.includes(meta)).length,
            ])
          )
        );
      })
      .catch(() => {
        /* the cards read fine without a count */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

/** Records are per game type and clock, so the labels follow both controls. */
function useBests(
  type: GameType,
  limit: number | null,
  ruleset: Ruleset
): Partial<Record<ModeId, string | null>> {
  const [bests, setBests] = useState<Partial<Record<ModeId, string | null>>>({});

  // Read after mount — storage isn't available while rendering on every client.
  useEffect(() => {
    setBests(
      Object.fromEntries(
        MODES.map((mode) => [
          mode.id,
          bestLabel(recordKey(type, mode.id, limit, ruleset)),
        ])
      )
    );
  }, [type, limit, ruleset]);

  return bests;
}

export default function Home() {
  const navigate = useNavigate();
  const counts = useModeCounts();
  const [gameType, setGameType] = useState<GameType>("name");
  const [limit, setLimit] = useState<number | null>(null);
  const [ruleset, setRuleset] = useState<Ruleset>("relaxed");
  const bests = useBests(gameType, limit, ruleset);
  const blurb =
    GAME_TYPES.find((t) => t.id === gameType)?.blurb ?? GAME_TYPES[0].blurb;

  const headline = MODES.filter((mode) => !mode.regional);
  const regional = MODES.filter((mode) => mode.regional);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111c]">
      <div className="pointer-events-none absolute inset-0 animate-fade-in">
        <Suspense fallback={null}>
          <BackgroundGlobe />
        </Suspense>
      </div>

      {/* Darkens the middle of the globe just enough to read type over it */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(7,17,28,0.88) 0%, rgba(7,17,28,0.6) 45%, rgba(7,17,28,0) 78%)",
        }}
      />

      <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <h1 className="text-center text-5xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
          WorldGuess
        </h1>
        <p className="mt-4 max-w-md text-center text-zinc-300">
          How much of the world map can you actually recall?
        </p>

        <div className="mt-10 w-full max-w-2xl rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 backdrop-blur-sm sm:p-4">
          {/* Anchored to the cards because it changes what every one of them does. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-3">
            <span className="text-xs uppercase tracking-wider text-zinc-500">
              How to play
            </span>
            <div
              role="tablist"
              aria-label="Game type"
              className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1"
            >
              {GAME_TYPES.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={gameType === t.id}
                  onClick={() => setGameType(t.id)}
                  className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
                    gameType === t.id
                      ? "bg-white/15 text-zinc-50"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="text-sm text-zinc-400">{blurb}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-3">
            <span className="text-xs uppercase tracking-wider text-zinc-500">
              Clock
            </span>
            <div
              role="group"
              aria-label="Time limit"
              className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/5 p-1"
            >
              {TIME_LIMITS.map((option) => (
                <button
                  key={option.label}
                  aria-pressed={limit === option.seconds}
                  onClick={() => setLimit(option.seconds)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    limit === option.seconds
                      ? "bg-white/15 text-zinc-50"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="text-sm text-zinc-400">
              {limit === null
                ? "Play until you're done."
                : "The round stops when the clock runs out."}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-3">
            <span className="text-xs uppercase tracking-wider text-zinc-500">
              Rules
            </span>
            <div
              role="group"
              aria-label="Rules"
              className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/5 p-1"
            >
              {RULESETS.map((option) => (
                <button
                  key={option.id}
                  aria-pressed={ruleset === option.id}
                  onClick={() => setRuleset(option.id)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    ruleset === option.id
                      ? "bg-white/15 text-zinc-50"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="text-sm text-zinc-400">
              {RULESETS.find((r) => r.id === ruleset)?.blurb}
            </span>
          </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {headline.map((mode) => (
            <ModeCard
              key={mode.id}
              name={mode.name}
              desc={mode.desc}
              label={mode.label}
              level={mode.level}
              accent={mode.accent}
              noun={mode.noun}
              count={counts[mode.id] ?? null}
              best={bests[mode.id] ?? null}
              onSelect={() => navigate(gamePath(gameType, mode.id, limit, ruleset))}
            />
          ))}
        </div>

        <div className="mt-6 px-1">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-zinc-500">
              By continent
            </span>
            <span className="h-px flex-1 bg-white/[0.07]" aria-hidden="true" />
            <span className="text-xs text-zinc-600">shorter rounds</span>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {regional.map((mode) => (
              <ContinentCard
                key={mode.id}
                name={mode.name}
                accent={mode.accent}
                noun={mode.noun}
                count={counts[mode.id] ?? null}
                best={bests[mode.id] ?? null}
                onSelect={() => navigate(gamePath(gameType, mode.id, limit, ruleset))}
              />
            ))}
          </div>
        </div>
        </div>
        <Link
          to="/records"
          className="mt-6 text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
        >
          Your records
        </Link>
      </main>
    </div>
  );
}
