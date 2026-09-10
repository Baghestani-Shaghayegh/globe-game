import { useState } from "react";
import { RULESETS, TIME_LIMITS, type Ruleset } from "../data/modes";
import Segmented from "./Segmented";

/**
 * The clock, the rules and the hint setting, folded away behind a control that
 * looks like one.
 *
 * The first version of this was a line of text with a chevron, which nobody
 * would guess was a button. It now carries the same border, background and
 * hover as the cards around it, shows the current settings as chips rather
 * than a sentence, and marks itself when anything is off the default — so a
 * player who has set a three-minute blitz can see that from the closed state.
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

  const chips = [
    TIME_LIMITS.find((t) => t.seconds === limit)?.label ?? "Count up",
    RULESETS.find((r) => r.id === ruleset)?.label ?? "Relaxed",
    hints ? "Hints on" : "Hints off",
  ];
  const customised = limit !== null || ruleset !== "relaxed" || !hints;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
          open
            ? "rounded-b-none border-white/15 bg-white/[0.05]"
            : customised
              ? "border-sky-400/30 bg-sky-400/[0.05] hover:border-sky-400/50"
              : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-zinc-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2.2" />
          <circle cx="10" cy="17" r="2.2" />
        </svg>

        <span className="text-sm font-medium text-zinc-200">Options</span>

        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="hidden shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-400 sm:inline"
            >
              {chip}
            </span>
          ))}
          <span className="truncate text-xs text-zinc-500 sm:hidden">
            {chips.join(" · ")}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="divide-y divide-white/[0.06] rounded-b-xl border border-t-0 border-white/15 bg-white/[0.02]">
          <Segmented
            label="Clock"
            hint={
              limit === null
                ? "Play until you're done"
                : "The round stops when it runs out"
            }
            options={TIME_LIMITS.map((option) => ({
              key: option.label,
              label: option.label,
              value: option.seconds,
            }))}
            value={limit}
            onChange={onLimit}
          />
          <Segmented
            label="Rules"
            hint={RULESETS.find((r) => r.id === ruleset)?.blurb}
            options={RULESETS.map((option) => ({
              key: option.id,
              label: option.label,
              value: option.id,
            }))}
            value={ruleset}
            onChange={onRuleset}
          />
          <Segmented
            label="Hints"
            hint={
              hints
                ? "Buy a nudge, and pay for it in points"
                : "No nudges — you can still be shown an answer"
            }
            options={[
              { key: "on", label: "On", value: true },
              { key: "off", label: "Off", value: false },
            ]}
            value={hints}
            onChange={onHints}
          />

          {customised && (
            <div className="px-4 py-2.5">
              <button
                onClick={() => {
                  onLimit(null);
                  onRuleset("relaxed");
                  onHints(true);
                }}
                className="text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
              >
                Back to defaults
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
