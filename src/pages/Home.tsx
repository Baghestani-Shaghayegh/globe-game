import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DailyCard from "../components/DailyCard";
import AdSlot from "../components/AdSlot";
import { playTap } from "../lib/sound";
import { replayTodaysDailies } from "../lib/localData";
import { clearTodaysDailyScore } from "../lib/leaderboard";
import { getCountryMeta } from "../data/countries";
import {
  GAME_TYPES,
  MODES,
  DEFAULT_ROUND_LENGTH,
  gamePath,
  recordKey,
  type GameType,
  type ModeId,
} from "../data/modes";
import { bestLabel } from "../lib/records";
import { hintsEnabled } from "../lib/prefs";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import { DAILY_MULTIPLIER, dayKey, resultFor, streak } from "../lib/daily";
import { loadMystery } from "../lib/mystery";
import { loadConnect } from "../lib/connect";
import { dueCount } from "../lib/practice";
import { flagUrl } from "../data/flags";
import { cluesFor } from "../data/clues";
import { capitalOf } from "../data/capitals";

// Three.js is heavy — let the menu paint first, then fade the globe in behind it.
const BackgroundGlobe = lazy(() => import("../components/BackgroundGlobe"));

/** How many game types sit on the bar before the rest fold into "More". */
const TABS_SHOWN = 3;

/**
 * What a round started from the menu is: ten countries, no clock, relaxed
 * rules. These were three controls on this page; every one of them was
 * answered the same way nearly every time, and the page is one screen now.
 * The other shapes still exist — a room sets its own, and a link carries
 * whatever it was made with — they just aren't a decision to make before
 * every round.
 */
const ROUND_LENGTH = DEFAULT_ROUND_LENGTH;
const CLOCK = null;
const RULES = "relaxed" as const;

/**
 * Whether the decorative globe behind the menu is worth its download.
 *
 * It costs about half a megabyte of three.js, which is most of what the menu
 * weighs — and on a phone it is mostly hidden behind the content anyway. Small
 * screens and metered connections get the gradient alone, and three.js then
 * only arrives when a round actually starts.
 */
function useBackdropWanted(): boolean {
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    const wideEnough = window.matchMedia("(min-width: 768px)").matches;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData === true;
    setWanted(wideEnough && !saveData);
  }, []);

  return wanted;
}

type Counts = Partial<Record<ModeId, number>>;

/**
 * How many places each mode asks for, read from the same map the game uses so
 * the labels can't drift out of date. The globe behind the menu fetches this
 * file too, so it comes from the browser cache.
 */
function useModeCounts(type: GameType): Counts {
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { features: { properties: { name: string } }[] }) => {
        if (cancelled) return;
        // A flag round can only ask for countries that have a flag.
        const metas = data.features
          .map((f) => getCountryMeta(f.properties.name))
          .filter((meta) => type !== "flag" || flagUrl(meta.geoName) !== null)
          .filter((meta) => type !== "famous" || cluesFor(meta.geoName).length > 0)
          .filter((meta) => type !== "capital" || capitalOf(meta.geoName) !== null);
        setCounts(
          Object.fromEntries(
            MODES.map((mode) => [
              mode.id,
              metas.filter((meta) => mode.includes(meta)).length,
            ])
          )
        );
      })
      .catch(() => {
        /* the labels read fine without a count */
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  return counts;
}

/** The best time or score for the round the menu would start, or null. */
function useBest(type: GameType, modeId: ModeId): string | null {
  const [best, setBest] = useState<string | null>(null);

  // Read after mount — storage isn't available while rendering on every client.
  useEffect(() => {
    setBest(
      bestLabel(recordKey(type, modeId, CLOCK, RULES, ROUND_LENGTH))
    );
  }, [type, modeId]);

  return best;
}

/**
 * A dropdown, built rather than borrowed.
 *
 * This was a native `<select>`, which on a Mac opens as a system menu: white,
 * square, its own typeface, nothing to do with the page it was opened from.
 * The list is short and fixed, so the menu is drawn here — closing on a click
 * outside, on Escape, and on a choice.
 */
function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; note?: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const chosen = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <span className="mb-1.5 block text-xs text-zinc-400">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          playTap();
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center gap-2 rounded-xl border bg-white/[0.04] px-3.5 py-2.5 text-left text-sm text-zinc-100 transition-colors ${
          open
            ? "border-teal-300/60"
            : "border-white/15 hover:border-white/30"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{chosen?.label ?? value}</span>
        {chosen?.note && (
          <span className="shrink-0 text-xs text-zinc-500">{chosen.note}</span>
        )}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-white/15 bg-[#0b1622] p-1 shadow-2xl shadow-black/60"
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  playTap();
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  option.value === value
                    ? "bg-teal-300/15 text-teal-100"
                    : "text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.note && (
                  <span className="shrink-0 text-xs text-zinc-500">
                    {option.note}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One of today's three, or one of the other ways to play. */
function WayToPlay({
  to,
  title,
  note,
  icon,
  badge,
}: {
  to: string;
  title: string;
  note: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <Link
      onClick={playTap}
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#07111c]/70 px-4 py-[clamp(0.4rem,1.6vh,1.3rem)] backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-[#07111c]/80"
    >
      <span className="shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-medium text-zinc-100">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-200">
              {badge}
            </span>
          )}
        </span>
        <span className="block truncate text-sm text-zinc-500">{note}</span>
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300"
      >
        ›
      </span>
    </Link>
  );
}

/** The icons on the cards — drawn, so they match at any size and any theme. */
const icons = {
  practice: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  ),
  together: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M17 11a2.6 2.6 0 1 0-2-4.3M17.5 19a5 5 0 0 0-3-4.6" />
    </svg>
  ),
  bigger: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20 20 4M4 14v6h6M20 10V4h-6" />
    </svg>
  ),
} as const;

export default function Home() {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const backdropWanted = useBackdropWanted();

  const [gameType, setGameType] = useState<GameType>("name");
  const [modeId, setModeId] = useState<ModeId>("easy");
  const [hints, setHints] = useState(true);
  const [moreTypes, setMoreTypes] = useState(false);

  const [daily, setDaily] = useState<{ played: boolean; streak: number } | null>(
    null
  );
  // Which of today's three are finished. Mystery and connect count as done
  // only when solved — one abandoned halfway is still waiting for you.
  const [doneToday, setDoneToday] = useState({
    daily: false,
    mystery: false,
    connect: false,
  });
  const [duePractice, setDuePractice] = useState(0);

  const counts = useModeCounts(gameType);
  const best = useBest(gameType, modeId);

  useEffect(() => {
    const today = dayKey();
    setDaily({ played: resultFor(today) !== null, streak: streak(today) });
    setDoneToday({
      daily: resultFor(today) !== null,
      mystery: loadMystery(today)?.solved === true,
      connect: loadConnect(today)?.solved === true,
    });
    setDuePractice(dueCount());
    setHints(hintsEnabled());
  }, []);

  const shown = GAME_TYPES.slice(0, TABS_SHOWN);
  const folded = GAME_TYPES.slice(TABS_SHOWN);
  // The chosen type always has a tab, even when it lives under "More".
  const openMore = moreTypes || folded.some((t) => t.id === gameType);

  const start = () =>
    navigate(gamePath(gameType, modeId, CLOCK, RULES, ROUND_LENGTH));

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#07111c]">
      {backdropWanted && (
        <div className="pointer-events-none absolute inset-0 animate-fade-in">
          <Suspense fallback={null}>
            <BackgroundGlobe />
          </Suspense>
        </div>
      )}

      {/*
        The globe sits behind the right-hand side, so the scrim runs across
        rather than down: dense at the left where the words are, gone by the
        time it reaches the globe. It has to clear early — held over the map it
        darkens the land past the colour the palette actually asks for, and
        what is on screen stops being the colour that was chosen. The cards
        that sit over the globe carry their own backing instead.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgba(7,17,28,0.97) 0%, rgba(7,17,28,0.88) 26%, rgba(7,17,28,0.44) 41%, rgba(7,17,28,0.1) 55%, transparent 68%)",
        }}
      />

      {/*
        The masthead spans the window while everything under it is capped and
        left-aligned: it is the frame of the page rather than part of the
        column, so the account sits in the corner of the screen and not at the
        end of a 1180px measure. Three grid tracks with the middle one `auto`
        put the links on the centre line of the window, which a flex row with
        two uneven sides cannot do.
      */}
      <header className="relative z-10 w-full px-5 py-4 [text-shadow:0_1px_4px_rgba(7,17,28,0.85)] sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:grid md:grid-cols-[1fr_auto_1fr]">
          <span className="flex items-center gap-2.5">
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
          </span>

          <nav className="flex items-center gap-5 text-sm md:justify-self-center">
            <span className="border-b-2 border-teal-300 pb-0.5 font-medium text-zinc-100">
              Play
            </span>
            {accountsEnabled && (
              <Link
                to="/leaderboard"
                onClick={playTap}
                className="text-zinc-400 transition-colors hover:text-zinc-100"
              >
                Leaderboard
              </Link>
            )}
            <Link
              to="/records"
              onClick={playTap}
              className="text-zinc-400 transition-colors hover:text-zinc-100"
            >
              My progress
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3 md:ml-0 md:justify-self-end">
            <Link
              to="/settings"
              onClick={playTap}
              className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
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

      <div className="relative flex w-full max-w-[1180px] flex-1 flex-col px-5 sm:px-8 lg:px-12">
        <main className="flex flex-1 flex-col">
          <div aria-hidden="true" className="grow-[0.45]" />

          <section className="pt-[clamp(0.5rem,2.1vh,2.25rem)]">
            <p className="text-xs uppercase tracking-[0.22em] text-teal-300/80">
              The world is your playground
            </p>
            <h1 className="mt-3 max-w-lg text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-50 sm:text-[clamp(2.1rem,4.9vh,3rem)]">
              How well do you know your world?
            </h1>
            <p className="mt-2.5 text-base text-zinc-400 sm:text-lg">
              Pick a challenge. Discover somewhere new.
            </p>
          </section>

          {/* Start a round: what kind, where, how long, go. */}
          <section className="mt-[clamp(0.75rem,2.1vh,1.75rem)] max-w-2xl">
            <div role="tablist" aria-label="Game type" className="flex flex-wrap gap-1.5">
              {[...shown, ...(openMore ? folded : [])].map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={gameType === t.id}
                  onClick={() => {
                    playTap();
                    setGameType(t.id);
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    gameType === t.id
                      ? "bg-teal-300 text-[#07111c]"
                      : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:text-zinc-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              {!openMore && (
                <button
                  onClick={() => {
                    playTap();
                    setMoreTypes(true);
                  }}
                  aria-expanded={false}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
                >
                  More
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              )}
            </div>

            {/*
              Two decisions and a button: what kind of round, which map, go.
              The round length and the clock used to live here too, behind a
              "Customize round" control that opened a panel that then had to be
              opened again. Rounds are ten countries counting up now, and hints
              are a setting rather than a per-round choice — they were the same
              answer every time, which is what a setting is for.
            */}
            <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Picker
                label="Map"
                value={modeId}
                onChange={(v) => setModeId(v as ModeId)}
                options={MODES.map((mode) => ({
                  value: mode.id,
                  label: mode.name,
                  note: counts[mode.id] ? String(counts[mode.id]) : undefined,
                }))}
              />
              <button
                onClick={() => {
                  playTap();
                  start();
                }}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-300 px-6 py-2.5 font-semibold text-[#07111c] transition-colors hover:bg-teal-200"
              >
                Start playing
                <span aria-hidden="true">→</span>
              </button>
            </div>

            <p className="mt-2.5 text-sm text-zinc-500">
              {ROUND_LENGTH} countries · no clock ·{" "}
              {hints ? "hints on" : "hints off"}
              {best && <> · your best {best}</>}
            </p>

          </section>

          <section className="mt-[clamp(0.75rem,2.4vh,2.5rem)]">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                Today's challenges
              </h2>
              <span className="text-xs text-zinc-500">Resets at midnight UTC</span>
              {import.meta.env.DEV && <ReplayToday />}
            </div>

            {/* Said once, above all three, because it is true of all three —
                it used to be a pill on the first card, which read as though
                that card alone was worth the extra. */}
            <p className="mt-1.5 flex w-fit items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-0.5 text-xs font-medium text-teal-200">
              <span aria-hidden="true">★</span>
              All three score {DAILY_MULTIPLIER}× on the leaderboard
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <DailyCard
                to="/daily"
                icon="🗺️"
                title="Country hunt"
                note={
                  doneToday.daily
                    ? "Played — see your result"
                    : "Ten countries, the same ten for everyone."
                }
                accent="sky"
                badge={daily && daily.streak > 1 ? `🔥 ${daily.streak}` : undefined}
                done={doneToday.daily}
                action="Start the hunt"
              />
              <DailyCard
                to="/mystery"
                icon="🔥"
                title="Mystery country"
                note={
                  doneToday.mystery
                    ? "Found — see your result"
                    : "Find it with warmer-or-colder clues."
                }
                accent="rose"
                done={doneToday.mystery}
                action="Solve mystery"
              />
              <DailyCard
                to="/connect"
                icon="🔗"
                title="Connect"
                note={
                  doneToday.connect
                    ? "Linked — see your result"
                    : "Link two countries across the map."
                }
                accent="violet"
                done={doneToday.connect}
                action="Make a connection"
              />
            </div>
          </section>

          <section className="mt-[clamp(0.75rem,2.4vh,1.75rem)]">
            <h2 className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              More ways to play
            </h2>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
              <WayToPlay
                to="/practice"
                title="Practice"
                note={
                  duePractice > 0
                    ? `${duePractice} waiting`
                    : "Work on your weak spots"
                }
                icon={icons.practice}
              />
              {accountsEnabled && (
                <WayToPlay
                  to="/play-together"
                  title="Play together"
                  note="Challenge a friend"
                  icon={icons.together}
                />
              )}
              <WayToPlay
                to="/bigger"
                title="Which is bigger?"
                note="Compare country sizes"
                icon={icons.bigger}
              />
            </div>
          </section>

          <AdSlot className="mt-[clamp(0.75rem,2.4vh,1.75rem)]" />

          {/* Eats whatever height is left over, so the footer sits on the
              bottom of the window when the page fits and stays a normal gap
              below the content when it does not. */}
          <div aria-hidden="true" className="flex-1" />

        </main>
      </div>

        <footer className="relative z-10 mt-[clamp(0.6rem,1.2vh,1.75rem)] flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] px-5 pb-[clamp(0.75rem,2.2vh,1.5rem)] pt-3.5 text-sm text-zinc-500 sm:px-8 lg:px-12">
          <Link to="/records" className="transition-colors hover:text-zinc-300">
            Records
          </Link>
          <Link to="/stats" className="transition-colors hover:text-zinc-300">
            Stats
          </Link>
          <Link to="/achievements" className="transition-colors hover:text-zinc-300">
            Badges
          </Link>
          <Link to="/levels" className="transition-colors hover:text-zinc-300">
            Level &amp; themes
          </Link>
          <Link
            to="/privacy"
            className="ml-auto transition-colors hover:text-zinc-300"
          >
            Privacy
          </Link>
        </footer>
    </div>
  );
}

/**
 * Put today's three puzzles back to unplayed, from the row they sit on.
 *
 * Development only — `import.meta.env.DEV` keeps it out of every built bundle,
 * because a daily anyone can replay is not a daily at all.
 */
function ReplayToday() {
  return (
    <button
      onClick={() => {
        replayTodaysDailies(dayKey());
        // Also takes today's score off the board, so a replayed daily can
        // actually land there. Allowed for listed accounts only.
        void clearTodaysDailyScore().finally(() => window.location.reload());
      }}
      title="Development only — puts today's three puzzles back to unplayed"
      className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-200/90 transition-colors hover:bg-amber-400/20"
    >
      Replay today
    </button>
  );
}
