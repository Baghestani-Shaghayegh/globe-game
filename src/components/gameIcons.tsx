import type { GameType } from "../data/modes";

/**
 * One icon family for everything on the menu.
 *
 * The daily cards carried emoji — 🗺️ 🔥 🔗 — directly above a row of drawn
 * line icons, so two rows of cards eight pixels apart were lit by two
 * different visual languages, at two different weights, in colours the page
 * does not choose. These are all one stroke and all `currentColor`, so a card
 * tints its icon by tinting its text.
 *
 * `drawn` is a lowercase helper rather than an `<Icon>` component on purpose:
 * this file exports drawings, not components, and fast refresh wants a
 * component file to export nothing else — the same reason `choice.ts` sits
 * apart from `Segmented`.
 */
const drawn = (children: React.ReactNode) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** The six ways a round can ask its question. */
export const GAME_ICONS: Record<GameType, React.ReactNode> = {
  // A pin, for the country you are pointing at and naming.
  name: drawn(
    <>
      <path d="M12 21s6-5.7 6-10a6 6 0 1 0-12 0c0 4.3 6 10 6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  // A magnifier: we say it, you go looking for it.
  find: drawn(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  // A flag on its pole.
  flag: drawn(
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h10.5l-2 3.5 2 3.5H6" />
    </>
  ),
  // A landmark, for the clue about what a place is known for.
  famous: drawn(
    <>
      <path d="M4 20h16" />
      <path d="M6 20v-8l6-5 6 5v8" />
      <path d="M10 20v-4.5h4V20" />
    </>
  ),
  // A coastline: the shape without the name on it.
  outline: drawn(
    <path d="M8 3.5 4 7l2.5 4L4 15l4 5.5 6-2 6 1-1.5-6L20 8l-5-1.5-3.5-3z" />
  ),
  // The star a map puts on a capital.
  capital: drawn(
    <path d="m12 4 2.3 4.9 5.2.7-3.8 3.7.9 5.3-4.6-2.6-4.6 2.6.9-5.3L4.5 9.6l5.2-.7z" />
  ),
};

/** Today's three, in the same hand as the six above. */
export const DAILY_ICONS = {
  // A folded map: ten countries to go and find.
  hunt: drawn(
    <>
      <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13l-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  // A flame, for warmer and colder.
  mystery: drawn(
    <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.8.8-3.3 1.6-4.4.4 1 1 1.7 1.7 2.1.4-2.6.3-4.7 1.7-6.7z" />
  ),
  // Two links of a chain.
  connect: drawn(
    <>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" />
    </>
  ),
} as const;
