import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import StreakChip from "./StreakChip";
import { playTap } from "../lib/sound";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import { dayKey, streakState, type Streak } from "../lib/daily";

/**
 * The masthead, on every page that isn't a round in progress.
 *
 * It used to live in the menu alone. Everywhere else — the leaderboard, the
 * records, the badges, the settings — had one grey "← Modes" link in the
 * corner and nothing else, so a player looking at the board who wanted their
 * badges had to go back to the menu and find them in the footer. Thirteen
 * pages, one way out of each.
 *
 * Not on a page where a round is being played. There the way out is the exit
 * guard, and a navigation bar over a live clock is an invitation to lose the
 * run.
 */

/**
 * Where "My progress" leads, and the pages that count as being under it.
 *
 * Not `/levels`. That page stopped carrying the progress tabs — it is the
 * level and the palettes, reached from Settings as often as from here — and a
 * nav item underlined on a page that does not belong to it says the player is
 * somewhere they are not.
 */
const PROGRESS_PATHS = ["/records", "/stats", "/achievements"];

function NavLink({
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
      className={
        active
          ? "border-b-2 border-teal-300 pb-0.5 font-medium text-zinc-100"
          : "pb-0.5 text-zinc-400 transition-colors hover:text-zinc-100"
      }
    >
      {children}
    </Link>
  );
}

export default function SiteHeader() {
  const { profile, session } = useAuth();
  const { pathname } = useLocation();

  // The streak is kept on the device, so it stands whether or not anyone is
  // signed in — and it is read here rather than passed in, so every page that
  // carries the masthead carries the flame too.
  const [daily, setDaily] = useState<Streak | null>(null);
  useEffect(() => {
    setDaily(streakState(dayKey()));
  }, []);

  return (
    <header className="relative z-10 w-full px-5 py-4 [text-shadow:0_1px_4px_rgba(7,17,28,0.85)] sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link to="/" onClick={playTap} className="flex items-center gap-2.5">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-7 w-7 text-teal-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3.3 9h17.4M3.3 15h17.4" />
          </svg>
          <span className="text-xl font-semibold tracking-tight text-zinc-50">
            WorldGuess
          </span>
        </Link>

        <nav className="flex items-center gap-5 text-sm md:justify-self-center">
          <NavLink to="/" active={pathname === "/"}>
            Play
          </NavLink>
          {accountsEnabled && (
            <NavLink to="/leaderboard" active={pathname === "/leaderboard"}>
              Leaderboard
            </NavLink>
          )}
          <NavLink to="/records" active={PROGRESS_PATHS.includes(pathname)}>
            My progress
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3 md:ml-0 md:justify-self-end">
          <Link
            to="/settings"
            onClick={playTap}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              pathname === "/settings"
                ? "text-zinc-100"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2.2" />
              <circle cx="10" cy="17" r="2.2" />
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </Link>
          {daily && <StreakChip streak={daily} />}
          {accountsEnabled && (
            <Link
              to="/account"
              onClick={playTap}
              className="flex items-center gap-2 rounded-xl border border-white/15 px-3.5 py-1.5 text-sm text-zinc-100 transition-colors hover:border-white/35"
            >
              {profile?.country && (
                <img
                  src={`/flags/${profile.country}.svg`}
                  alt=""
                  width={18}
                  height={14}
                  className="w-[18px] rounded-[2px]"
                />
              )}
              {profile ? profile.username : session ? "Finish setup" : "Sign in"}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * The footer, wherever the masthead is.
 *
 * One link now that the progress pages carry their own tabs, but it is the
 * one every page needs within reach: a privacy policy an ad network can find
 * from anywhere on the site, not only from the menu.
 */
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`relative z-10 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/[0.07] px-5 pb-[clamp(0.75rem,2.2vh,1.5rem)] pt-3.5 text-sm text-zinc-500 sm:px-8 lg:px-12 ${className}`}
    >
      <Link to="/privacy" className="transition-colors hover:text-zinc-300">
        Privacy
      </Link>
    </footer>
  );
}

/**
 * The page under the masthead: background, header, and a capped column.
 *
 * Nine pages had this same wrapper copied out by hand, down to the padding
 * and the 1180px measure, each with its own back link where the nav now is.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#07111c]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 pb-12 pt-4 sm:px-8 lg:px-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * The four pages about your own play, as tabs across the top of each.
 *
 * These were four links in the menu's footer — a second navigation, on the one
 * page that already had one. Moved here they are where they are used, and the
 * menu loses a row it never needed.
 */
export function ProgressTabs() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/records", label: "Records" },
    { to: "/stats", label: "Stats" },
    { to: "/achievements", label: "Badges" },
    { to: "/levels", label: "Level & themes" },
  ];

  return (
    <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Your progress">
      {tabs.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            onClick={playTap}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "border-teal-300/60 bg-teal-300/[0.14] text-teal-100"
                : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.06] hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
