import { choiceClass } from "./choice";

/**
 * One row of mutually exclusive choices, styled as a real segmented control.
 *
 * Shared rather than local to the options panel: the multiplayer room picker
 * asks the same kind of question, and when it had its own pill styling the two
 * screens drifted apart — six game types and six maps overflowed a
 * `rounded-full` container onto a second line, which read as broken. Buttons
 * that wrap are the normal case here, so the row wraps and each button keeps
 * its own shape.
 */
export default function Segmented<T>({
  label,
  hint,
  options,
  value,
  onChange,
  className = "px-4 py-3.5",
}: {
  label: string;
  hint?: string;
  options: { key: string; label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  /** Padding for the row, so a panel and a card can space it differently. */
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        {hint && <span className="truncate text-xs text-zinc-600">{hint}</span>}
      </div>
      <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={choiceClass(active)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
