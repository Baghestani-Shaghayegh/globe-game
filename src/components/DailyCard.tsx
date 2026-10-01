import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { playTap } from "../lib/sound";

/**
 * One of today's rounds, and the biggest thing on the page.
 *
 * Built like the picture cards under it — a cut corner, a coloured frame and
 * a picture on top — so the page reads as one game rather than two sets of
 * boxes. The picture is today's puzzle, drawn: the hunt's ten targets, the
 * mystery's hot-and-cold rings, the day's two Connect flags. Once played it
 * shows how it went, so the cards double as today's scorecard.
 */

const CUT = 18;
const corner = (size: number) =>
  `polygon(0 0, 100% 0, 100% calc(100% - ${size}px), calc(100% - ${size}px) 100%, 0 100%)`;

type Accent = "sky" | "rose" | "violet";

const FRAME: Record<Accent, string> = {
  sky: "bg-sky-400/50 hover:bg-sky-300",
  rose: "bg-rose-400/50 hover:bg-rose-300",
  violet: "bg-violet-400/50 hover:bg-violet-300",
};

/** The picture's backdrop: the accent, glowing from the middle. */
const ART: Record<Accent, string> = {
  sky: "[background-image:radial-gradient(120%_90%_at_50%_0%,rgba(56,189,248,0.30),rgba(56,189,248,0.06)_70%)] text-sky-300",
  rose: "[background-image:radial-gradient(120%_90%_at_50%_0%,rgba(251,113,133,0.28),rgba(251,113,133,0.05)_70%)] text-rose-300",
  violet:
    "[background-image:radial-gradient(120%_90%_at_50%_0%,rgba(167,139,250,0.30),rgba(167,139,250,0.06)_70%)] text-violet-300",
};

const ACTION: Record<Accent, string> = {
  sky: "bg-sky-300 text-sky-950 group-hover:bg-sky-200",
  rose: "bg-rose-300 text-rose-950 group-hover:bg-rose-200",
  violet: "bg-violet-300 text-violet-950 group-hover:bg-violet-200",
};

/** A faint globe grid behind every picture: these are map games. */
function Graticule() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 100"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.6"
    >
      <ellipse cx="100" cy="120" rx="130" ry="110" />
      <ellipse cx="100" cy="120" rx="90" ry="110" />
      <ellipse cx="100" cy="120" rx="45" ry="110" />
      <line x1="100" y1="0" x2="100" y2="100" />
      <path d="M-20 40 Q100 10 220 40" />
      <path d="M-20 70 Q100 45 220 70" />
      <path d="M-20 100 Q100 80 220 100" />
    </svg>
  );
}

export default function DailyCard({
  to,
  icon,
  kicker,
  title,
  note,
  visual,
  accent,
  done = false,
}: {
  to: string;
  icon: ReactNode;
  /** The puzzle's number, and what kind: "#274 · Name it". */
  kicker: string;
  title: string;
  /** One line under the title: what to do, or how it went. */
  note: string;
  /** Today's puzzle, drawn; or once played, the result. */
  visual: ReactNode;
  accent: Accent;
  /** Already finished today: shows the result, and stops shouting. */
  done?: boolean;
}) {
  return (
    <Link
      onClick={playTap}
      to={to}
      style={{ clipPath: corner(CUT) }}
      className={`group block h-full p-[2px] transition-colors ${FRAME[accent]}`}
    >
      <span
        style={{ clipPath: corner(CUT - 1) }}
        className="flex h-full flex-col bg-surface"
      >
        {/* The picture. */}
        <span
          className={`relative flex h-32 items-center justify-center overflow-hidden px-5 sm:h-36 ${ART[accent]}`}
        >
          <Graticule />
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-page/70 px-2 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-sm">
            <span aria-hidden="true" className="[&_svg]:h-3.5 [&_svg]:w-3.5">
              {icon}
            </span>
            {kicker}
          </span>
          {done && (
            <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-1 text-[11px] font-bold text-emerald-950">
              ✓ Played
            </span>
          )}
          <span className="relative mt-5 flex w-full max-w-[17rem] justify-center transition-transform duration-300 group-hover:scale-[1.04]">
            {visual}
          </span>
        </span>

        {/* The words, and the way in. */}
        {/* Side by side on a phone, where the card has the width; stacked in
            the three narrow columns, where it hasn't. */}
        <span className="flex flex-1 items-end gap-3 px-4 pb-5 pt-3.5 sm:flex-col sm:items-stretch sm:px-5">
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
              {title}
            </span>
            <span className="mt-0.5 block truncate text-sm text-zinc-400 sm:whitespace-normal">
              {note}
            </span>
          </span>
          <span
            className={`flex shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              done ? "bg-white/[0.08] text-zinc-200 group-hover:bg-white/[0.14]" : ACTION[accent]
            }`}
          >
            {done ? "See result" : "Play"}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
