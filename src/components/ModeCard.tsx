// src/components/ModeCard.tsx
type ModeCardProps = {
  icon: string;
  name: string;
  desc: string;
  difficulty: "Easy" | "Hard";
  onSelect: () => void;
};

export default function ModeCard({
  icon,
  name,
  desc,
  difficulty,
  onSelect,
}: ModeCardProps) {
  return (
    <button
      onClick={onSelect}
      className="backdrop-blur-md bg-white/20 border border-white/30 
                 rounded-2xl shadow-lg p-8 flex flex-col items-center 
                 hover:scale-105 hover:shadow-2xl transition w-72"
    >
      <span className="text-6xl mb-4">{icon}</span>
      <h2 className="text-2xl font-semibold text-white">{name}</h2>
      <p className="text-gray-200 mt-2 text-center">{desc}</p>
      <span
        className={`mt-3 text-sm font-bold px-3 py-1 rounded-full ${
          difficulty === "Easy"
            ? "bg-green-200/30 text-green-100 border border-green-300/30"
            : "bg-red-200/30 text-red-100 border border-red-300/30"
        }`}
      >
        {difficulty}
      </span>
    </button>
  );
}
