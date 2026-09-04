type ModeCardProps = {
  name: string;
  desc: string;
  difficulty: "Easy" | "Hard";
  onSelect: () => void;
};

export default function ModeCard({
  name,
  desc,
  difficulty,
  onSelect,
}: ModeCardProps) {
  return (
    <button
      onClick={onSelect}
      className="group flex items-start gap-4 rounded-lg border border-white/10 bg-white/5 p-4 text-left backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:border-white/40 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-medium text-zinc-100">{name}</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              difficulty === "Easy"
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-amber-500/10 text-amber-300"
            }`}
          >
            {difficulty}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{desc}</p>
      </div>
      <span
        aria-hidden="true"
        className="mt-1 text-zinc-600 transition-colors group-hover:text-zinc-300"
      >
        →
      </span>
    </button>
  );
}
