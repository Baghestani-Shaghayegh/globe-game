import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModeCard from "../components/ModeCard";
import { getCountryMeta, type Difficulty } from "../data/countries";
import { bestRun } from "../lib/records";

// Three.js is heavy — let the menu paint first, then fade the globe in behind it.
const BackgroundGlobe = lazy(() => import("../components/BackgroundGlobe"));

const modes: {
  id: Difficulty;
  name: string;
  desc: string;
  difficulty: "Easy" | "Hard";
}[] = [
  {
    id: "easy",
    name: "Countries only",
    desc: "The world's sovereign countries. A good place to start.",
    difficulty: "Easy",
  },
  {
    id: "hard",
    name: "Full map",
    desc: "Adds territories, islands and disputed regions.",
    difficulty: "Hard",
  },
];

/**
 * How many places each mode asks for, read from the same map the game uses so
 * the cards can't drift out of date. The globe behind the menu fetches this
 * file too, so it comes from the browser cache.
 */
function useModeCounts(): Record<Difficulty, number | null> {
  const [counts, setCounts] = useState<Record<Difficulty, number | null>>({
    easy: null,
    hard: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { features: { properties: { name: string } }[] }) => {
        if (cancelled) return;
        const countries = data.features.filter(
          (f) => getCountryMeta(f.properties.name).tier === "country"
        );
        setCounts({ easy: countries.length, hard: data.features.length });
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

export default function Home() {
  const navigate = useNavigate();
  const counts = useModeCounts();
  const [bests, setBests] = useState<Record<Difficulty, number | null>>({
    easy: null,
    hard: null,
  });

  // Read after mount — storage isn't available while rendering on every client.
  useEffect(() => {
    setBests({
      easy: bestRun("easy")?.ms ?? null,
      hard: bestRun("hard")?.ms ?? null,
    });
  }, []);

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
          {modes.map((mode) => (
            <ModeCard
              key={mode.id}
              name={mode.name}
              desc={mode.desc}
              difficulty={mode.difficulty}
              count={counts[mode.id]}
              bestMs={bests[mode.id]}
              onSelect={() => navigate(`/play/${mode.id}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
