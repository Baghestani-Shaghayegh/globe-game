import { useMemo, useState } from "react";
import { suggestNames, type Suggestable } from "../../lib/answerMatch";

/**
 * The list of countries under a box you type a name into, and the keys that
 * drive it.
 *
 * Name it had this inside its guess modal and the mystery country had nothing:
 * a bare box that took an exact-ish name or said "No country called". The two
 * boxes ask the same question, so they share one answer to it.
 */
export function useSuggestions(names: Suggestable[], value: string, limit = 6) {
  const [highlighted, setHighlighted] = useState(-1);

  const matches = useMemo(
    () => suggestNames(names, value, limit).map((m) => m.displayName),
    [names, value, limit]
  );

  /**
   * Arrow keys walk the list; Enter takes the highlighted name, or the only
   * one left, or else hands back whatever was typed. Anything else is left to
   * the caller — Escape means different things in a modal and on a page.
   */
  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    pick: (name: string) => void,
    submitTyped: () => void
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((prev) =>
        matches.length === 0 ? -1 : (prev + 1) % matches.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((prev) =>
        matches.length === 0 ? -1 : prev <= 0 ? matches.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && matches[highlighted]) {
        pick(matches[highlighted]);
      } else if (matches.length === 1) {
        // One suggestion left is not a choice — it is the answer, and making
        // someone arrow down to it, or finish typing a name the box has
        // already worked out, is a keystroke tax on knowing it.
        pick(matches[0]);
      } else {
        submitTyped();
      }
    }
  };

  return { matches, highlighted, setHighlighted, onKeyDown };
}
