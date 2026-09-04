import type { CSSProperties } from "react";

type ModeCardProps = {
  name: string;
  desc: string;
  difficulty: "Easy" | "Hard";
  /** How many places this mode asks for. Null until the map has loaded. */
  count: number | null;
  /** The player's record in this mode — a clear time or a score — if they have one. */
  best: string | null;
  onSelect: () => void;
};

/** Filled bars out of three — the difficulty read without a colour code. */
const LEVEL: Record<ModeCardProps["difficulty"], number> = { Easy: 1, Hard: 3 };
const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3.5"];

/**
 * One accent per mode, picked to sit on the navy page without fighting the
 * blue globe behind it. Only the artwork is tinted — the Easy/Hard label stays
 * neutral so it reads as a name, not a status colour.
 */
const ACCENT: Record<
  ModeCardProps["difficulty"],
  { solid: string; soft: string; line: string; glow: string }
> = {
  Easy: {
    solid: "#2dd4bf",
    soft: "rgba(45,212,191,0.12)",
    line: "rgba(45,212,191,0.4)",
    glow: "rgba(45,212,191,0.22)",
  },
  Hard: {
    solid: "#a78bfa",
    soft: "rgba(167,139,250,0.12)",
    line: "rgba(167,139,250,0.4)",
    glow: "rgba(167,139,250,0.22)",
  },
};

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
  best,
  onSelect,
}: ModeCardProps) {
  const level = LEVEL[difficulty];
  const accent = ACCENT[difficulty];

  return (
    <button
      onClick={onSelect}
      style={
        {
          "--accent": accent.solid,
          "--accent-soft": accent.soft,
          "--accent-line": accent.line,
          "--accent-glow": accent.glow,
        } as CSSProperties
      }
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-line)] hover:bg-white/[0.07] focus-visible:-translate-y-0.5 focus-visible:border-[var(--accent-line)] focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* Accent light pooling behind the icon */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full bg-[var(--accent-glow)] opacity-70 blur-2xl transition-opacity duration-200 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]">
          {difficulty === "Easy" ? <EasyIcon /> : <HardIcon />}
        </span>
        <span
          aria-hidden="true"
          className="text-zinc-600 transition duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
        >
          →
        </span>
      </div>

      <h2 className="relative mt-4 text-lg font-medium tracking-tight text-zinc-100">
        {name}
      </h2>
      <p className="relative mt-1.5 text-sm leading-relaxed text-zinc-400">
        {desc}
      </p>

      <div className="relative mt-5 flex items-center gap-3 border-t border-white/[0.07] pt-3 text-xs text-zinc-500">
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
                  i < level ? "bg-[var(--accent)]" : "bg-white/15"
                }`}
              />
            ))}
          </span>
          <span className="uppercase tracking-wider">{difficulty}</span>
        </span>
        {best && (
          <span className="ml-auto tabular-nums text-zinc-400">Best {best}</span>
        )}
      </div>
    </button>
  );
}
