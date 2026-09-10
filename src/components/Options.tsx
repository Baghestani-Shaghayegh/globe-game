import { useState } from "react";
import {
  RULESETS,
  TIME_LIMITS,
  type Ruleset,
} from "../data/modes";

const pillRow =
  "flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/5 p-1";

function pill(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
    active ? "bg-white/15 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
  }`;
}

/**
 * The clock, the rules and the hint setting, folded away.
 *
 * They used to occupy three rows of the menu permanently, which put the least
 * used controls in the most valuable space — most people play the default and
 * never touch them. Closed, the summary line still says what they are set to,
 * so nothing is hidden, only tidied.
 */
export default function Options({
  limit,
  onLimit,
  ruleset,
  onRuleset,
  hints,
  onHints,
}: {
  limit: number | null;
  onLimit: (seconds: number | null) => void;
  ruleset: Ruleset;
  onRuleset: (ruleset: Ruleset) => void;
  hints: boolean;
  onHints: (hints: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  const summary = [
    TIME_LIMITS.find((t) => t.seconds === limit)?.label ?? "Count up",
    RULESETS.find((r) => r.id === ruleset)?.label ?? "Relaxed",
    hints ? "Hints on" : "Hints off",
  ].join(" · ");

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <span className="text-xs uppercase tracking-wider">Options</span>
        <span className="truncate text-zinc-400">{summary}</span>
        <span
          aria-hidden="true"
          className={`ml-auto shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="w-12 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
              Clock
            </span>
            <div className={pillRow}>
              {TIME_LIMITS.map((option) => (
                <button
                  key={option.label}
                  aria-pressed={limit === option.seconds}
                  onClick={() => onLimit(option.seconds)}
                  className={pill(limit === option.seconds)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="w-12 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
              Rules
            </span>
            <div className={pillRow}>
              {RULESETS.map((option) => (
                <button
                  key={option.id}
                  aria-pressed={ruleset === option.id}
                  onClick={() => onRuleset(option.id)}
                  className={pill(ruleset === option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="w-12 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
              Hints
            </span>
            <div className={pillRow}>
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  aria-pressed={hints === on}
                  onClick={() => onHints(on)}
                  className={pill(hints === on)}
                >
                  {on ? "On" : "Off"}
                </button>
              ))}
            </div>
          </div>

          <p className="px-1 text-xs text-zinc-600">
            {RULESETS.find((r) => r.id === ruleset)?.blurb}
          </p>
        </div>
      )}
    </div>
  );
}
