/**
 * The × inside a country box that empties it in one tap, so a wrong guess
 * doesn't have to be backspaced letter by letter on a phone.
 *
 * Sits over the right end of the input, which needs a `relative` parent and
 * room on its right (pr-8). Pressing it keeps the keyboard up: the mousedown
 * is swallowed so the input never loses focus, and focus is put back anyway
 * for taps that do blur it.
 */
export default function ClearButton({
  show,
  onClear,
  inputId,
}: {
  show: boolean;
  onClear: () => void;
  /** The input to give focus back to. */
  inputId: string;
}) {
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Clear"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onClear();
        document.getElementById(inputId)?.focus();
      }}
      className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-base leading-none text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
    >
      ×
    </button>
  );
}
