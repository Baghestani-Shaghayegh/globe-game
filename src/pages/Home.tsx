import { Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import ModeCard from "../components/ModeCard";
import type { Difficulty } from "../data/countries";

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

export default function Home() {
  const navigate = useNavigate();

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

        <div className="mt-10 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {modes.map((mode) => (
            <ModeCard
              key={mode.id}
              name={mode.name}
              desc={mode.desc}
              difficulty={mode.difficulty}
              onSelect={() => navigate(`/play/${mode.id}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
