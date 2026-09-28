import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DailyCard from "../components/DailyCard";
import AdSlot from "../components/AdSlot";
import SiteHeader, { SiteFooter } from "../components/SiteHeader";
import { DAILY_ICONS } from "../components/gameIcons";
import { playTap } from "../lib/sound";
import { getCountryMeta } from "../data/countries";
import {
  GAME_TYPES,
  MODES,
  gamePath,
  type GameType,
  type ModeId,
} from "../data/modes";
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
 * The map every round card below plays on, as a row of choices you can see.
 *
 * This was a dropdown reading "Map · Countries only", and a first-time
 * visitor had no way to know it was a choice at all, let alone what else was
 * in it — Sara found it unclear. All seven maps fit on a line or two, so they
 * are laid out as pills under a plain heading: what the options are is
 * visible before anything is pressed, and the one picked is lit.
 *
 * The two whole-world maps come first and the continents after, with a gap
 * between, because that is the real choice: everywhere, or one part of it.
 */
function MapChips({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; note?: string; group: "world" | "region" }[];
  onChange: (value: string) => void;
}) {
  const chip = (option: (typeof options)[number]) => {
    const picked = option.value === value;
    return (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={picked}
        onClick={() => {
          playTap();
          onChange(option.value);
        }}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors ${
          picked
            ? "border-teal-300 bg-teal-300 text-teal-950"
            : "border-white/15 bg-surface/90 text-zinc-300 hover:border-teal-300/60 hover:text-zinc-50"
        }`}
      >
        {option.label}
        {option.note && (
          <span
            className={`text-xs tabular-nums ${picked ? "text-teal-900/70" : "text-zinc-500"}`}
          >
            {option.note}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      role="radiogroup"
      aria-label="Choose your map"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {options.filter((o) => o.group === "world").map(chip)}
      <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />
      {options.filter((o) => o.group === "region").map(chip)}
    </div>
  );
}

/** The cut-off corner, bottom right, on every game card. */
const CUT = 20;
const corner = (size: number) =>
  `polygon(0 0, 100% 0, 100% calc(100% - ${size}px), calc(100% - ${size}px) 100%, 0 100%)`;

/**
 * One game in "Discover more games": a picture of it being played, its name
 * and one line on what it asks.
 *
 * Sara's reference was a games site whose other games sit under the main one
 * as picture cards, and a picture does what a name like "Find it" cannot — it
 * shows a first-time visitor what they are about to play. The pictures are
 * screenshots of this game, not stock photos, for the same reason.
 *
 * The border is the outer element showing through a two pixel gap
 * round the inner one, because a CSS border does not follow a clipped corner.
 */
function GameCard({
  to,
  image,
  title,
  note,
  badge,
}: {
  to: string;
  image: string;
  title: string;
  note: string;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      onClick={playTap}
      style={{ clipPath: corner(CUT) }}
      className="group block h-full bg-teal-300/55 p-[2px] transition-colors hover:bg-teal-300"
    >
      <span
        // A hair smaller than the outer cut, so the border keeps its width
        // along the diagonal as well as the sides.
        style={{ clipPath: corner(CUT - 1) }}
        className="flex h-full flex-col bg-surface"
      >
        <span className="night relative block aspect-video overflow-hidden bg-page">
          <img
            src={image}
            alt=""
            loading="lazy"
            width={800}
            height={450}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {badge && (
            <span className="absolute right-2 top-2 rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
              {badge}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col items-center px-3 pb-5 pt-3 text-center">
          <span className="text-base font-semibold text-teal-300 sm:text-lg">
            {title}
          </span>
          <span className="mt-1 text-xs leading-snug text-zinc-400 sm:text-sm">
            {note}
          </span>
        </span>
      </span>
    </Link>
  );
}

export default function Home() {
  const backdropWanted = useBackdropWanted();

  const [modeId, setModeId] = useState<ModeId>("easy");

  // Which of today's three are finished. Mystery and connect count as done
  // only when solved — one abandoned halfway is still waiting for you.
  const [doneToday, setDoneToday] = useState({
    daily: false,
    mystery: false,
    connect: false,
  });
  const [duePractice, setDuePractice] = useState(0);

  // The picker's counts are the size of each map, so they are read for the
  // plain country game: they now label a choice that every card shares.
  const counts = useModeCounts("name");

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


  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-page">
      {backdropWanted && (
        <div className="pointer-events-none absolute inset-0 animate-fade-in">
          {/* Faded right back in light mode: the globe is dark whatever the
              page is, and at full strength the words on top of it were dark
              on dark. There it is a watermark, like the globe on an atlas's
              title page. */}
          <div className="home-globe h-full w-full">
            <Suspense fallback={null}>
              <BackgroundGlobe />
            </Suspense>
          </div>
        </div>
      )}

      {/*
        The scrim used to run across the page — dense at the left where the
        words were, gone by the time it reached the globe on the right. The
        column is centred now, so it darkens the middle and clears by the
        edges, which is where the limb of the sphere still shows. It must
        clear: held over the whole map it darkens the land past the colour the
        palette asks for, and what is on screen stops being the colour that
        was chosen.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 48%, color-mix(in srgb, var(--page) 72%, transparent) 0%, color-mix(in srgb, var(--page) 50%, transparent) 45%, color-mix(in srgb, var(--page) 18%, transparent) 72%, color-mix(in srgb, var(--page) 2%, transparent) 90%, transparent 100%)",
        }}
      />

      <SiteHeader />

      <div className="relative mx-auto flex w-full max-w-[960px] flex-1 flex-col px-5 sm:px-8">
        <main className="flex flex-1 flex-col">
          <div aria-hidden="true" className="grow-[0.45]" />

          {/* One headline, not three. An eyebrow above it and a tagline
              under it said the same thing a third and a fourth time, and
              three competing lines of prose is how a page starts to read as
              noise before anything on it has been clicked. */}
          <section className="pt-[clamp(0.5rem,2.1vh,2.25rem)]">
            <h1 className="mx-auto max-w-xl text-center text-4xl font-semibold [text-shadow:0_2px_12px_color-mix(in_srgb,var(--page)_90%,transparent)] leading-[1.08] tracking-tight text-zinc-50 sm:text-[clamp(2rem,4.4vh,2.75rem)]">
              How well do you know your world?
            </h1>
          </section>

          {/* Today's three first. They are the reason to come back, they are
              the same for everyone, and they are over in a few minutes — a
              visitor who has never played should meet something to do, not a
              form to fill in. Free play is under them, where someone who
              wants a longer round will look for it. */}
          <section className="mt-[clamp(0.75rem,2.4vh,2rem)]">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                Today's challenges
              </h2>
              <span className="rounded-full bg-teal-300/15 px-2.5 py-0.5 text-xs font-semibold text-teal-200">
                {DAILY_MULTIPLIER}× points
              </span>
            </div>

            {/* What each one is stays said when it's done: the button says
                "Result" now, so the line under the title doesn't have to. */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
              <DailyCard
                to="/daily"
                icon={DAILY_ICONS.hunt}
                title="Country hunt"
                note={`Ten countries, ${DAILY_LIMIT_SECONDS / 60} minutes`}
                accent="sky"
                done={doneToday.daily}
              />
              <DailyCard
                to="/mystery"
                icon={DAILY_ICONS.mystery}
                title="Mystery country"
                note="Warmer or colder clues"
                accent="rose"
                done={doneToday.mystery}
              />
              <DailyCard
                to="/connect"
                icon={DAILY_ICONS.connect}
                title="Connect"
                note="Link two countries by land"
                accent="violet"
                done={doneToday.connect}
              />
            </div>
          </section>

          {/* The other games, as picture cards under the dailies — the
              layout of the games site Sara pointed at. Each round card is the
              question and the answer: this is what it asks you, press it to
              play it. The map applies to whichever round you press, so it
              stays one control under the heading rather than one per card.

              Under the dailies, not beside them: these were the largest
              cards on the page once, six of them above the fold, and a
              first-time visitor took them for the main event. */}
          <section className="mt-[clamp(1.75rem,4vh,3rem)]">
            <div className="flex flex-col items-center">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                Discover more games
              </h2>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                Choose your map
              </p>
              <div className="mt-2.5 max-w-4xl">
                <MapChips
                  value={modeId}
                  onChange={(v) => setModeId(v as ModeId)}
                  options={MODES.map((mode) => ({
                    value: mode.id,
                    label: mode.name,
                    note: counts[mode.id] ? String(counts[mode.id]) : undefined,
                    group: mode.regional ? "region" : "world",
                  }))}
                />
              </div>
            </div>

            {/* A wrapping row rather than a grid, so an odd card out on the
                last line sits in the middle rather than hard left. */}
            <ul className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-5">
              {[
                ...GAME_TYPES.map((type) => ({
                  id: type.id as string,
                  to: gamePath(type.id, modeId, CLOCK, RULES, ROUND_LENGTH),
                  title: type.label,
                  note: type.blurb,
                  badge: undefined as string | undefined,
                })),
                {
                  id: "practice",
                  to: "/practice",
                  title: "Practice",
                  note: "Work on your weak spots.",
                  badge: duePractice > 0 ? `${duePractice} waiting` : undefined,
                },
                {
                  id: "bigger",
                  to: "/bigger",
                  title: "Which is bigger?",
                  note: "Two countries, pick the larger.",
                  badge: undefined,
                },
              ].map((game) => (
                <li
                  key={game.id}
                  className="w-[calc(50%-0.375rem)] sm:w-[calc((100%-2.5rem)/3)]"
                >
                  <GameCard
                    to={game.to}
                    image={`/cards/${game.id}.jpg`}
                    title={game.title}
                    note={game.note}
                    badge={game.badge}
                  />
                </li>
              ))}
            </ul>
          </section>

          <div aria-hidden="true" className="grow-[0.55]" />

          <AdSlot className="mt-[clamp(0.75rem,2.4vh,1.75rem)]" />


        </main>
      </div>

        <SiteFooter className="mt-[clamp(0.6rem,1.2vh,1.75rem)]" />
    </div>
  );
}

