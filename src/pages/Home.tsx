import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DailyCard from "../components/DailyCard";
import AdSlot from "../components/AdSlot";
import SiteHeader, { SiteFooter } from "../components/SiteHeader";
import { playTap } from "../lib/sound";
import { getCountryMeta } from "../data/countries";
import {
  GAME_TYPES,
  MODES,
  gamePath,
  type GameType,
  type ModeId,
} from "../data/modes";
import { accountsEnabled } from "../lib/supabase";
import {
  DAILY_LIMIT_SECONDS,
  DAILY_MULTIPLIER,
  dayKey,
  resultFor,
} from "../lib/daily";
import { loadMystery } from "../lib/mystery";
import { loadConnect } from "../lib/connect";
import { dueCount } from "../lib/practice";
import { flagUrl } from "../data/flags";
import { cluesFor } from "../data/clues";
import { capitalOf } from "../data/capitals";

// Three.js is heavy — let the menu paint first, then fade the globe in behind it.
const BackgroundGlobe = lazy(() => import("../components/BackgroundGlobe"));

/**
 * What a round started from the menu is: the whole map you chose, no clock,
 * relaxed rules.
 *
 * It used to be ten countries of it, which is what the Round control was for.
 * With that control gone, picking "Countries only · 167" and then being asked
 * ten of them read as the page ignoring the choice — so the map you pick is
 * now the round you get, and the number beside it is the number you play.
 */
const ROUND_LENGTH = null;
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
  className = "",
}: {
  label: string;
  value: string;
  options: { value: string; label: string; note?: string }[];
  onChange: (value: string) => void;
  className?: string;
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
    <div ref={box} className={`relative min-w-0 flex-1 ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          playTap();
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center gap-2 rounded-xl border bg-white/[0.04] py-2.5 pl-3 pr-3.5 text-left text-sm text-zinc-100 transition-colors ${
          open ? "border-teal-300/60" : "border-white/15 hover:border-white/30"
        }`}
      >
        {/* The label rides inside the field. Above it, it cost a line of a
            page that has to fit one window — and inside it reads as part of
            the same control rather than a heading for it. */}
        <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">
          {label}
        </span>
        <span className="min-w-0 truncate">{chosen?.label ?? value}</span>
        {chosen?.note && (
          <span className="shrink-0 text-xs text-zinc-500">
            · {chosen.note}
          </span>
        )}
        <span className="flex-1" />
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
      className="group flex items-center gap-3 rounded-xl border border-white/12 bg-[#0a1420]/95 px-4 py-[clamp(0.4rem,1.6vh,1.3rem)] backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-[#0d1928]"
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
        <span className="block truncate text-sm text-zinc-400">{note}</span>
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
  const backdropWanted = useBackdropWanted();

  const [gameType, setGameType] = useState<GameType>("name");
  const [modeId, setModeId] = useState<ModeId>("easy");

  // Which of today's three are finished. Mystery and connect count as done
  // only when solved — one abandoned halfway is still waiting for you.
  const [doneToday, setDoneToday] = useState({
    daily: false,
    mystery: false,
    connect: false,
  });
  const [duePractice, setDuePractice] = useState(0);

  const counts = useModeCounts(gameType);

  useEffect(() => {
    const today = dayKey();
    setDoneToday({
      daily: resultFor(today) !== null,
      mystery: (() => {
        const saved = loadMystery(today);
        return saved?.solved === true || saved?.gaveUp === true;
      })(),
      connect: loadConnect(today)?.solved === true,
    });
    setDuePractice(dueCount());
  }, []);


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

      <SiteHeader />

      <div className="relative flex w-full max-w-[1180px] flex-1 flex-col px-5 sm:px-8 lg:px-12">
        <main className="flex flex-1 flex-col">
          <div aria-hidden="true" className="grow-[0.45]" />

          {/* One headline, not three. An eyebrow above it and a tagline
              under it said the same thing a third and a fourth time, and
              three competing lines of prose is how a page starts to read as
              noise before anything on it has been clicked. */}
          <section className="pt-[clamp(0.5rem,2.1vh,2.25rem)]">
            <h1 className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-50 sm:text-[clamp(2.1rem,4.9vh,3rem)]">
              How well do you know your world?
            </h1>
          </section>

          {/* Start a round: what kind, where, how long, go. */}
          <section className="mt-[clamp(0.75rem,2.1vh,1.75rem)] max-w-2xl">
            {/*
              One panel, not a scatter of loose controls. The tabs, the line
              that explains them and the map picker are three parts of a
              single decision — start a round — and over a moving globe a row
              of unbacked chips read as debris on the page rather than as a
              thing to use. The surface is near-opaque for the same reason:
              a 3% white fill over continents is a smudge, not a card.
            */}
            <div className="rounded-2xl border border-white/12 bg-[#0b1726]/92 p-4 backdrop-blur-sm sm:p-5">
              {/*
                All six, always. Three of them used to fold behind a "More"
                chevron, which hid half the game behind a control that told you
                nothing about what was under it — and the ones it hid are the
                ones a returning player is most likely to want.
              */}
              <div
                role="tablist"
                aria-label="Game type"
                className="flex flex-wrap gap-1.5"
              >
                {GAME_TYPES.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={gameType === t.id}
                    title={t.blurb}
                    onClick={() => {
                      playTap();
                      setGameType(t.id);
                    }}
                    className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      gameType === t.id
                        ? "border-teal-300/60 bg-teal-300/[0.14] text-teal-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.06] hover:text-zinc-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* What the chosen game actually is. Every type already carried
                  this line; it was a `title` attribute, which is invisible on a
                  phone and a second late on a desktop — and "Famous for" and
                  "Outlines" mean nothing until someone tells you. */}
              <p className="mt-2 text-sm text-zinc-400">
                {GAME_TYPES.find((t) => t.id === gameType)?.blurb}
              </p>

              {/*
                Two decisions and a button: what kind of round, which map, go.
                The round length and the clock used to live here too, behind a
                "Customize round" control that opened a panel that then had to be
                opened again. Rounds are ten countries counting up now, and hints
                are a setting rather than a per-round choice — they were the same
                answer every time, which is what a setting is for.
              */}
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Picker
                  className="sm:max-w-[17rem]"
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

            </div>
          </section>

          <section className="mt-[clamp(0.75rem,2.4vh,2.5rem)]">
            {/* The multiplier was a sentence under this heading — "Get 3×
                more points by doing daily challenges" — which is eleven words
                to carry one number. As a chip it reads in a glance and stops
                competing with the cards it is about. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                Today's challenges
              </h2>
              <span className="rounded-full bg-teal-300/15 px-2.5 py-0.5 text-xs font-semibold text-teal-200">
                {DAILY_MULTIPLIER}× points
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <DailyCard
                to="/daily"
                icon="🗺️"
                title="Country hunt"
                note={
                  doneToday.daily
                    ? "See your result"
                    : `Ten countries, ${DAILY_LIMIT_SECONDS / 60} minutes`
                }
                accent="sky"
                done={doneToday.daily}
              />
              <DailyCard
                to="/mystery"
                icon="🔥"
                title="Mystery country"
                note={
                  doneToday.mystery ? "See your result" : "Warmer or colder clues"
                }
                accent="rose"
                done={doneToday.mystery}
              />
              <DailyCard
                to="/connect"
                icon="🔗"
                title="Connect"
                note={
                  doneToday.connect ? "See your result" : "Link two countries by land"
                }
                accent="violet"
                done={doneToday.connect}
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

          <div aria-hidden="true" className="grow-[0.55]" />

          <AdSlot className="mt-[clamp(0.75rem,2.4vh,1.75rem)]" />


        </main>
      </div>

        <SiteFooter className="mt-[clamp(0.6rem,1.2vh,1.75rem)]" />
    </div>
  );
}

