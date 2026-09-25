import { Link } from "react-router-dom";
import { playTap } from "../lib/sound";

/**
 * The one tab strip, for pages that switch between views of the same thing.
 *
 * It was written twice: once under the masthead for the progress pages, once
 * as a row of filled chips on the leaderboard. Two rows of tabs two clicks
 * apart, in two different shapes, on a site with six pages. This is the
 * progress strip's shape, since that is the one that stayed.
 *
 * Underlined text rather than buttons: a row of chips reads as three things
 * to press, where a tab strip reads as one thing with three states.
 */
const BASE = "-mb-px border-b-2 px-0.5 pb-2.5 text-center transition-colors";
const ACTIVE = "border-teal-300 font-medium text-zinc-100";
const IDLE = "border-transparent text-zinc-400 hover:text-zinc-100";

export function TabRow({
  label,
  tablist = false,
  children,
}: {
  label: string;
  /** Set when the tabs switch a view in place rather than navigating. */
  tablist?: boolean;
  children: React.ReactNode;
}) {
  return (
    <nav
      role={tablist ? "tablist" : undefined}
      aria-label={label}
      className="mt-4 flex flex-wrap justify-center gap-6 border-b border-white/[0.07] text-sm"
    >
      {children}
    </nav>
  );
}

/** A tab that goes somewhere. */
export function TabLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={playTap}
      aria-current={active ? "page" : undefined}
      className={`${BASE} ${active ? ACTIVE : IDLE}`}
    >
      {children}
    </Link>
  );
}

/** A tab that swaps what is under it, without leaving the page. */
export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => {
        playTap();
        onClick();
      }}
      className={`${BASE} ${active ? ACTIVE : IDLE}`}
    >
      {children}
    </button>
  );
}
