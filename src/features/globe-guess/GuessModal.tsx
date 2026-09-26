import { useEffect, useMemo, useRef } from "react";
import type { Suggestable } from "../../lib/answerMatch";
import { wrongNameQuip } from "../../lib/quips";
import { useSuggestions } from "./useSuggestions";

type Props = {
  open: boolean;
  /** The first letter, once that hint has been bought for this country. */
  hintLetter: string | null;
  /** Seconds left on this country under blitz rules, or null when untimed. */
  secondsLeft: number | null;
  /** Buys the first letter. Null when the player has hints turned off. */
  onHint: (() => void) | null;
  /**
   * The countries on offer. Names *and* aliases, because the list has to be
   * able to suggest "United States" to somebody who typed "usa".
   */
  names: Suggestable[];
  value: string;
  isWrong: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

const MAX_SUGGESTIONS = 6;

export default function GuessModal({
  open,
  hintLetter,
  secondsLeft,
  onHint,
  names,
  value,
  isWrong,
  onChange,
  onSubmit,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Re-rolled when a wrong answer lands, not on every keystroke: the line has
  // to sit still while you type the next attempt.
  const jab = useMemo(() => (isWrong ? wrongNameQuip() : ""), [isWrong]);
  const { matches, highlighted, setHighlighted, onKeyDown } = useSuggestions(
    names,
    value,
    MAX_SUGGESTIONS
  );

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setHighlighted(-1);
    }
  }, [open, setHighlighted]);

  if (!open) return null;

  const handleChange = (next: string) => {
    setHighlighted(-1);
    onChange(next);
  };

  const handleSelect = (name: string) => {
    onChange(name);
    setHighlighted(-1);
    onSubmit(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    onKeyDown(e, handleSelect, () => onSubmit(value));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-6 sm:pb-12"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-xl border border-white/10 bg-[#102030] p-5 shadow-2xl ${
          isWrong ? "animate-shake" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="guess-input"
            className="block text-sm font-medium text-zinc-100"
          >
            Which country is this?
          </label>
          {secondsLeft !== null && (
            <span
              className={`text-sm font-medium tabular-nums ${
                secondsLeft <= 5 ? "text-rose-400" : "text-zinc-400"
              }`}
              aria-label="Seconds left on this country"
            >
              {secondsLeft}s
            </span>
          )}
        </div>

        <input
          id="guess-input"
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing a name"
          autoComplete="off"
          className={`mt-2 w-full rounded-lg border bg-white/5 px-3 py-2 text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 ${
            isWrong
              ? "border-red-500/60 focus:border-red-500"
              : "border-white/10 focus:border-white/40"
          }`}
        />

        {isWrong && <p className="mt-2 text-sm text-red-400">{jab}</p>}

        {matches.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-lg border border-white/10">
            {matches.map((name, index) => (
              <li
                key={name}
                onClick={() => handleSelect(name)}
                onMouseEnter={() => setHighlighted(index)}
                className={`cursor-pointer px-3 py-2 text-sm text-zinc-200 ${
                  index === highlighted ? "bg-white/10" : "bg-transparent"
                }`}
              >
                {name}
              </li>
            ))}
          </ul>
        )}

        {/* A hint costs points, so it is bought once and then just displayed.
            The continent is not offered here: the globe already shows it. */}
        {(hintLetter || onHint) && (
          <div className="mt-3 text-xs">
            {hintLetter ? (
              <span className="rounded-md bg-white/5 px-2 py-1 text-zinc-300">
                Starts with <b className="font-medium">{hintLetter}</b>
              </span>
            ) : (
              <button
                onClick={onHint ?? undefined}
                className="rounded-md border border-white/10 px-2 py-1 text-zinc-400 transition-colors hover:border-white/25 hover:text-zinc-100"
              >
                First letter{" "}
                <span className="text-zinc-600">½ points</span>
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => onSubmit(value)}
            className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            Guess
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-white/25 hover:text-zinc-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
