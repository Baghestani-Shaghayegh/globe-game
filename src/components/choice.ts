/**
 * The look of one choice in a row of them — a segmented control's option, the
 * game-type tabs on the menu, the practice picker.
 *
 * Its own module rather than a second export from `Segmented`: those rows only
 * agree on styling, not on semantics (a tablist wants `aria-selected`, a
 * toggle group wants `aria-pressed`), and fast refresh wants a component file
 * to export nothing else.
 *
 * Deliberately a self-contained rounded rectangle, not a segment of a shared
 * pill. There are six game types and six maps now, so these rows wrap on any
 * narrow screen, and a `rounded-full` container split over two lines reads as
 * a broken control rather than a wrapped one.
 */
export function choiceClass(active: boolean): string {
  return `rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
    active
      ? "border-sky-400/40 bg-sky-400/15 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-zinc-100"
  }`;
}
