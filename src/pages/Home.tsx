import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModeCard from "../components/ModeCard";
import ContinentCard from "../components/ContinentCard";
import { getCountryMeta } from "../data/countries";
import { MODES, type ModeId } from "../data/modes";
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

function useBests(): Partial<Record<ModeId, string | null>> {
  const [bests, setBests] = useState<Partial<Record<ModeId, string | null>>>({});

  // Read after mount — storage isn't available while rendering on every client.
  useEffect(() => {
    setBests(
      Object.fromEntries(MODES.map((mode) => [mode.id, bestLabel(mode.id)]))
    );
  }, []);

  return bests;
}

export default function Home() {
  const navigate = useNavigate();
  const counts = useModeCounts();
  const bests = useBests();

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
          Click any country on the globe and type its name. No timer, no
          multiple choice — just how much of the map you can actually recall.
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
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
              onSelect={() => navigate(`/play/${mode.id}`)}
            />
          ))}
        </div>

        <div className="mt-8 w-full max-w-2xl">
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
                onSelect={() => navigate(`/play/${mode.id}`)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
