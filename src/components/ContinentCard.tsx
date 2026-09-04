import type { CSSProperties } from "react";

type Props = {
  name: string;
  /** How many places the region asks for. Null until the map has loaded. */
  count: number | null;
  /** The player's record here — a clear time or a score — if they have one. */
  best: string | null;
  accent: string;
  noun: string;
  onSelect: () => void;
};

/**
 * The compact card used for continent modes. These are short rounds, so they
 * get a denser card than the two headline modes.
 */
export default function ContinentCard({
  name,
  count,
  best,
  accent,
  noun,
  onSelect,
}: Props) {
  return (
    <button
      onClick={onSelect}
      style={{ "--accent": accent } as CSSProperties}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-left backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:bg-white/[0.07] focus-visible:border-[var(--accent)] focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent)] opacity-70 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="pl-2">
        <p className="text-sm font-medium text-zinc-100">{name}</p>
        <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
          {count === null ? "—" : count} {noun}
          {best && (
            <>
              <span className="mx-1.5 text-zinc-700">·</span>
              <span className="text-zinc-400">{best}</span>
            </>
          )}
        </p>
      </div>
    </button>
  );
}
