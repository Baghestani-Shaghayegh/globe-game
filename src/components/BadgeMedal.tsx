/**
 * A badge drawn as a badge.
 *
 * These were emoji — 🌍 🔟 ⛓️ 🏆 — twenty-five of them from a dozen different
 * emoji families, at a dozen weights, in colours the page does not choose and
 * the system may swap out from under it. Side by side they read as a list of
 * things, not a set of awards, and a locked one looked the same as an earned
 * one with less opacity on it.
 *
 * So: one struck disc, one glyph family, two states. Earned is gold and lit;
 * locked is the same medal cast in the page's own dark, which is what a
 * disabled control looks like everywhere else here.
 */

/** The milled edge, sixteen teeth, computed once and pasted in. */
const EDGE =
  "M32.00 1.00 L37.19 5.91 L43.86 3.36 L46.78 9.88 L53.92 10.08 L54.12 17.22 L60.64 20.14 L58.09 26.81 L63.00 32.00 L58.09 37.19 L60.64 43.86 L54.12 46.78 L53.92 53.92 L46.78 54.12 L43.86 60.64 L37.19 58.09 L32.00 63.00 L26.81 58.09 L20.14 60.64 L17.22 54.12 L10.08 53.92 L9.88 46.78 L3.36 43.86 L5.91 37.19 L1.00 32.00 L5.91 26.81 L3.36 20.14 L9.88 17.22 L10.08 10.08 L17.22 9.88 L20.14 3.36 L26.81 5.91 Z";

/** A globe, and where on it a continent sits — the five region badges differ
 *  by their marker alone, since the name is on the line beside it. */
const globe = (mark: [number, number]) => (
  <>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M3.4 9h17.2M3.4 15h17.2" strokeWidth="1.3" />
    <ellipse cx="12" cy="12" rx="3.9" ry="8.8" strokeWidth="1.3" />
    {/* The marker is the whole difference between five of these, so it is
        drawn over a lighter globe rather than into it. */}
    <circle cx={mark[0]} cy={mark[1]} r="2.7" fill="currentColor" stroke="none" />
  </>
);

/**
 * One glyph per badge, all 24×24, all stroked, all the same hand as the
 * icons on the menu. Anything without an entry falls back to the star.
 */
const BADGE_GLYPHS: Record<string, React.ReactNode> = {
  // A chequered flag. It was a globe, and so were the five continents, the
  // whole world and nowhere left — eight near-identical discs down one page.
  "first-round": (
    <>
      <path d="M5.5 3.5v17" />
      <path d="M5.5 4.6h13.8v9.2H5.5z" />
      <path d="M5.5 4.6h4.6v4.6h4.6v4.6h-4.6V9.2H5.5zM14.7 4.6h4.6v4.6h-4.6z" fill="currentColor" stroke="none" />
    </>
  ),
  // Answers in a row, as a row: five struck, and the run still going. It was
  // a bar chart, which is what "Big round" is, four rows below.
  "streak-10": (
    <>
      <circle cx="4.6" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <path d="M19 8.4 22.4 12 19 15.6" strokeWidth="1.7" />
    </>
  ),
  // Two links of a chain, unbroken.
  "streak-50": (
    <>
      <path d="M10.5 13.5a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2" />
      <path d="M13.5 10.5a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2" />
    </>
  ),
  "clear-europe": globe([9.6, 7.4]),
  "clear-africa": globe([12, 15.4]),
  "clear-asia": globe([15.6, 8.4]),
  "clear-americas": globe([6.6, 12]),
  "clear-oceania": globe([17, 16.6]),
  // A compass rose, for having been everywhere on the map.
  "clear-all-regions": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5.2-5.2 2 2-5.2z" />
    </>
  ),
  // A globe in a wreath: the whole world, finished.
  "clear-easy": (
    <>
      <circle cx="12" cy="11.5" r="5.6" />
      <path d="M6.4 11.5h11.2M12 5.9c1.6 1.7 2.4 3.6 2.4 5.6s-.8 3.9-2.4 5.6c-1.6-1.7-2.4-3.6-2.4-5.6S10.4 7.6 12 5.9z" />
      <path d="M4.2 8.5c-.9 3.7.6 7.4 3.6 9.3M19.8 8.5c.9 3.7-.6 7.4-3.6 9.3" />
    </>
  ),
  // A folded map: the full sheet, territories and all.
  "clear-hard": (
    <>
      <path d="M9 4.5 3.8 6.4v13L9 17.6l6 1.9 5.2-1.9v-13L15 6.4z" />
      <path d="M9 4.5v13.1M15 6.4v13.1" />
    </>
  ),
  // A stopwatch with a bolt through it.
  "speed-region": (
    <>
      <path d="M9.6 2.8h4.8" />
      <path d="M19.2 8.4A8.2 8.2 0 1 1 12 4.4c1.6 0 3.1.5 4.4 1.3M17.6 4.4l1.8-1.8" />
      <path d="m12.8 8.2-2.6 4.4h3.2l-1 3.6" />
    </>
  ),
  // Four faces of a die, for playing every way there is.
  "every-game-type": (
    <>
      <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.8" />
      <rect x="13.4" y="3.4" width="7.2" height="7.2" rx="1.8" />
      <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="1.8" />
      <rect x="13.4" y="13.4" width="7.2" height="7.2" rx="1.8" />
    </>
  ),
  // A suitcase, for the hundred countries you have been shown.
  "met-100": (
    <>
      <rect x="3" y="7.4" width="18" height="12.6" rx="2.2" />
      <path d="M8.6 7.4V5.2a1.8 1.8 0 0 1 1.8-1.8h3.2a1.8 1.8 0 0 1 1.8 1.8v2.2M3 13h18" />
    </>
  ),
  // A globe, ticked: nowhere left to be shown.
  "met-all": (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="M3.4 8.4h15.2M3.4 13.6h12.6" />
      <path d="M11 3c2 2.4 3 5.1 3 8s-1 5.6-3 8c-2-2.4-3-5.1-3-8s1-5.6 3-8z" />
      <path d="m14.6 17.8 2.6 2.6 4-5" />
    </>
  ),
  // A target, hit.
  "sharp-eye": (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // The flame the streak already uses everywhere else.
  "daily-7": (
    <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.8.8-3.3 1.6-4.4.4 1 1 1.7 1.7 2.1.4-2.6.3-4.7 1.7-6.7z" />
  ),
  // A calendar, for a month of them.
  "daily-30": (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3.5V7M16 3.5V7" />
    </>
  ),
  // The same calendar, stacked: fifty of them, run or not.
  "daily-50": (
    <>
      <rect x="6.5" y="7" width="14" height="13.5" rx="2.4" />
      <path d="M6.5 11.5h14M11 5.2v3.6M17 5.2v3.6" />
      <path d="M3.5 17V6.2A2.4 2.4 0 0 1 5.9 3.8h10.6" />
    </>
  ),
  // A clean sweep of the day's ten: a starburst.
  "daily-perfect": (
    <>
      <path d="M12 3.2 13.9 9l5.9.2-4.7 3.6 1.7 5.7-4.8-3.3-4.8 3.3 1.7-5.7L4.2 9.2 10.1 9z" />
    </>
  ),
  // A cut stone: a round with no flaw in it.
  "flawless": (
    <>
      <path d="M7.4 4h9.2l4 5.4L12 20.4 3.4 9.4z" />
      <path d="M3.4 9.4h17.2M7.4 4l1.8 5.4L12 20.4l2.8-11L16.6 4" />
    </>
  ),
  // A line going up and off the top, for the biggest round on file.
  "big-round": (
    <>
      <path d="M3.5 20.5h17" />
      <path d="m4.5 16 4.5-5 3.4 3.2L20 5.5" />
      <path d="M15.6 5.5H20v4.4" />
    </>
  ),
  // A stack of rounds, a hundred deep.
  "rounds-100": (
    <>
      <path d="m12 3.2 8.6 4.4L12 12 3.4 7.6z" />
      <path d="m3.4 12 8.6 4.4L20.6 12M3.4 16.4 12 20.8l8.6-4.4" />
    </>
  ),
};

/** The star every badge without a glyph of its own falls back to. */
const FALLBACK = (
  <path d="M12 3.2 13.9 9l5.9.2-4.7 3.6 1.7 5.7-4.8-3.3-4.8 3.3 1.7-5.7L4.2 9.2 10.1 9z" />
);

export default function BadgeMedal({
  id,
  unlocked,
  className = "h-14 w-14",
}: {
  id: string;
  unlocked: boolean;
  className?: string;
}) {
  const gradient = `medal-${id}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className={`${className} shrink-0`}
    >
      {unlocked && (
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="48%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#a16207" />
          </linearGradient>
        </defs>
      )}

      {/* The milled edge, behind the face. */}
      <path
        d={EDGE}
        fill={unlocked ? "#f59e0b" : "#ffffff"}
        opacity={unlocked ? 0.4 : 0.05}
      />

      {/* The face, and the line struck just inside its rim. */}
      <circle
        cx="32"
        cy="32"
        r="25"
        fill={unlocked ? `url(#${gradient})` : "#121a25"}
        stroke={unlocked ? "#fef3c7" : "rgba(255,255,255,0.10)"}
        strokeWidth="1.4"
      />
      <circle
        cx="32"
        cy="32"
        r="20.8"
        fill="none"
        stroke={unlocked ? "rgba(120,53,15,0.32)" : "rgba(255,255,255,0.07)"}
        strokeWidth="1"
      />

      <g
        transform="translate(20 20)"
        fill="none"
        stroke={unlocked ? "#4a2c05" : "#4b5563"}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {BADGE_GLYPHS[id] ?? FALLBACK}
      </g>
    </svg>
  );
}
