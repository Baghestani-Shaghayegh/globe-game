type ModeCardProps = {
  name: string;
  desc: string;
  difficulty: "Easy" | "Hard";
  /** How many places this mode asks for. Null until the map has loaded. */
  count: number | null;
  onSelect: () => void;
};

/** Filled bars out of three — the difficulty read without a colour code. */
const LEVEL: Record<ModeCardProps["difficulty"], number> = { Easy: 1, Hard: 3 };
const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3.5"];

function EasyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="3.7" ry="8.5" />
      <path d="M3.5 12h17" />
    </svg>
  );
}

function HardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="13.5" r="7.2" />
      <ellipse cx="10.5" cy="13.5" rx="3.1" ry="7.2" />
      <path d="M3.3 13.5h14.4" />
      {/* the outlying territories hard mode adds */}
      <circle cx="19.6" cy="4.6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="21.2" cy="8.9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16.1" cy="2.6" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function ModeCard({
  name,
  desc,
  difficulty,
  count,
  onSelect,
}: ModeCardProps) {
  const level = LEVEL[difficulty];

  return (
    <button
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07] focus-visible:-translate-y-0.5 focus-visible:border-white/40 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* Light catching the top edge on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />

      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition-colors duration-200 group-hover:border-white/20 group-hover:text-zinc-100">
          {difficulty === "Easy" ? <EasyIcon /> : <HardIcon />}
        </span>
        <span
          aria-hidden="true"
          className="text-zinc-600 transition duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-300"
        >
          →
        </span>
      </div>

      <h2 className="mt-4 text-lg font-medium tracking-tight text-zinc-100">
        {name}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{desc}</p>

      <div className="mt-5 flex items-center gap-3 border-t border-white/[0.07] pt-3 text-xs text-zinc-500">
        <span className="tabular-nums">
          {count === null ? "—" : count} places
        </span>
        <span aria-hidden="true" className="h-3 w-px bg-white/10" />
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="flex items-end gap-[3px]">
            {BAR_HEIGHTS.map((height, i) => (
              <span
                key={height}
                className={`w-[3px] rounded-full ${height} ${
                  i < level
                    ? "bg-zinc-300 transition-colors group-hover:bg-white"
                    : "bg-white/15"
                }`}
              />
            ))}
          </span>
          <span className="uppercase tracking-wider">{difficulty}</span>
        </span>
      </div>
    </button>
  );
}
