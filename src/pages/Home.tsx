// src/pages/Home.tsx
import ModeCard from "../components/ModeCard";

export default function Home() {
  const modes = [
    {
      name: "Countries Only",
      icon: "🌎",
      desc: "Guess from 195 countries. Easier mode.",
      difficulty: "Easy" as const,
    },
    {
      name: "Full Map Challenge",
      icon: "🗺️",
      desc: "Includes territories & islands. Hard mode.",
      difficulty: "Hard" as const,
    },
  ];

  function startGame(mode: string) {
    console.log("Selected mode:", mode);
    // Later: navigate to game page with this mode
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 p-6">
      {/* Title */}
      <h1 className="text-5xl font-bold mb-16 text-white drop-shadow-lg">
        🌍 WorldGuess
      </h1>

      {/* Centered Cards */}
      <div className="flex gap-10 flex-col sm:flex-row">
        {modes.map((mode) => (
          <ModeCard
            key={mode.name}
            icon={mode.icon}
            name={mode.name}
            desc={mode.desc}
            difficulty={mode.difficulty}
            onSelect={() => startGame(mode.name)}
          />
        ))}
      </div>
    </div>
  );
}
