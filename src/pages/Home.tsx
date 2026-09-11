import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ModeCard from "../components/ModeCard";
import ContinentCard from "../components/ContinentCard";
import DailyCard from "../components/DailyCard";
import Options from "../components/Options";
import AdSlot from "../components/AdSlot";
import { choiceClass } from "../components/choice";
import { getCountryMeta } from "../data/countries";
import {
  GAME_TYPES,
  MODES,
  DEFAULT_ROUND_LENGTH,
  gamePath,
  recordKey,
  type GameType,
  type Ruleset,
  type ModeId,
} from "../data/modes";
import { bestLabel } from "../lib/records";
import { hintsEnabled, setHintsEnabled } from "../lib/prefs";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import { dayKey, resultFor, streak } from "../lib/daily";
import { dueCount } from "../lib/practice";
import { flagUrl } from "../data/flags";
import { cluesFor } from "../data/clues";
import { capitalOf } from "../data/capitals";

// Three.js is heavy — let the menu paint first, then fade the globe in behind it.
const BackgroundGlobe = lazy(() => import("../components/BackgroundGlobe"));

/**
 * Whether the decorative globe behind the menu is worth its download.
 *
 * It costs about half a megabyte of three.js, which is most of what the menu
 * weighs — and on a phone it is mostly hidden behind the cards anyway. Small
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
 * the cards can't drift out of date. The globe behind the menu fetches this
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
        /* the cards read fine without a count */
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  return counts;
}

/**
 * Records are per game type, clock and round length, so the labels follow all
 * three — a ten-country best has nothing to say about a marathon.
 */
function useBests(
  type: GameType,
  limit: number | null,
  ruleset: Ruleset,
  count: number | null
): Partial<Record<ModeId, string | null>> {
  const [bests, setBests] = useState<Partial<Record<ModeId, string | null>>>({});

  // Read after mount — storage isn't available while rendering on every client.
  useEffect(() => {
    setBests(
      Object.fromEntries(
        MODES.map((mode) => [
          mode.id,
          bestLabel(recordKey(type, mode.id, limit, ruleset, count)),
        ])
      )
    );
  }, [type, limit, ruleset, count]);

  return bests;
}

export default function Home() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [gameType, setGameType] = useState<GameType>("name");
  const counts = useModeCounts(gameType);
  const [limit, setLimit] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(DEFAULT_ROUND_LENGTH);
  const [ruleset, setRuleset] = useState<Ruleset>("relaxed");
  const backdropWanted = useBackdropWanted();
  const [daily, setDaily] = useState<{ played: boolean; streak: number } | null>(
    null
  );
  const [duePractice, setDuePractice] = useState(0);
  // Unlike the clock and rules, this is a standing preference, so it sticks.
  const [hints, setHints] = useState(true);

  useEffect(() => {
    const today = dayKey();
    setDaily({ played: resultFor(today) !== null, streak: streak(today) });
    setDuePractice(dueCount());
    setHints(hintsEnabled());
  }, []);

  const bests = useBests(gameType, limit, ruleset, count);
  const blurb =
    GAME_TYPES.find((t) => t.id === gameType)?.blurb ?? GAME_TYPES[0].blurb;

  const headline = MODES.filter((mode) => !mode.regional);
  const regional = MODES.filter((mode) => mode.regional);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111c]">
      {backdropWanted && (
        <div className="pointer-events-none absolute inset-0 animate-fade-in">
          <Suspense fallback={null}>
            <BackgroundGlobe />
          </Suspense>
        </div>
      )}

      {/*
        Pushes the globe back behind the cards. The old scrim was tuned for a
        centred hero with space around it; this layout is a dense column, and
        anything less than this reads as noise through the cards rather than
        depth behind them.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,17,28,0.55) 0%, rgba(7,17,28,0.86) 30%, rgba(7,17,28,0.94) 100%)",
        }}
      />

      <main className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-10 sm:py-14">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
              WorldGuess
            </h1>
            <p className="mt-2 text-zinc-400">
              How much of the world map can you actually recall?
            </p>
          </div>
          {accountsEnabled && (
            <Link
              to="/account"
              className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
            >
              {profile?.country && (
                <img
                  src={`/flags/${profile.country}.svg`}
                  alt=""
                  width={20}
                  height={15}
                  className="w-5 rounded-[2px]"
                />
              )}
              {profile ? profile.username : session ? "Finish setup" : "Sign in"}
            </Link>
          )}
        </header>

        {/* Today — one click each, the same for everyone, gone tomorrow. */}
        <Section title="Today" hint="new at midnight UTC">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <DailyCard
              to="/daily"
              icon="🗓️"
              title="Daily challenge"
              note={
                daily?.played
                  ? "Played — see your result"
                  : "Ten countries, the same for everyone."
              }
              accent="sky"
              badge={daily && daily.streak > 1 ? `🔥 ${daily.streak}` : undefined}
            />
            <DailyCard
              to="/mystery"
              icon="🔥"
              title="Mystery country"
              note="One hidden country. Warmer or colder with every guess."
              accent="rose"
            />
            <DailyCard
              to="/connect"
              icon="🔗"
              title="Connect"
              note="Two ends. Name the countries that link them."
              accent="violet"
            />
          </div>
        </Section>

        {/* Play — the configurable round. */}
        <Section title="Play">
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
                onClick={() => setGameType(t.id)}
                className={choiceClass(gameType === t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-2.5 px-1 text-sm text-zinc-400">{blurb}</p>

          <Options
            count={count}
            onCount={setCount}
            limit={limit}
            onLimit={setLimit}
            ruleset={ruleset}
            onRuleset={setRuleset}
            hints={hints}
            onHints={(on) => {
              setHints(on);
              setHintsEnabled(on);
            }}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {headline.map((mode) => (
              <ModeCard
                key={mode.id}
                name={mode.name}
                desc={mode.desc}
                label={mode.label}
                level={mode.level}
                accent={mode.accent}
                noun={mode.noun}
                count={counts[mode.id] ?? null}
                best={bests[mode.id] ?? null}
                onSelect={() =>
                  navigate(gamePath(gameType, mode.id, limit, ruleset, count))
                }
              />
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {regional.map((mode) => (
              <ContinentCard
                key={mode.id}
                name={mode.name}
                accent={mode.accent}
                noun={mode.noun}
                count={counts[mode.id] ?? null}
                best={bests[mode.id] ?? null}
                onSelect={() =>
                  navigate(gamePath(gameType, mode.id, limit, ruleset, count))
                }
              />
            ))}
          </div>
        </Section>

        {/* Everything that isn't a round of the main game. */}
        <Section title="More">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <SmallLink
              to="/play-together"
              icon="⚔️"
              title="Play together"
              note="Race a friend"
              hidden={!accountsEnabled}
            />
            <SmallLink
              to="/bigger"
              icon="⚖️"
              title="Which is bigger?"
              note="Pick the larger one"
            />
            <SmallLink
              to="/practice"
              icon="🎯"
              title="Practice"
              note={
                duePractice > 0
                  ? `${duePractice} waiting`
                  : "Drill your weak spots"
              }
              highlight={duePractice > 0}
            />
          </div>
        </Section>

        <AdSlot className="mt-10" />

        <nav className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-zinc-500">
          {[
            ["/records", "Records"],
            ["/stats", "Stats"],
            ["/achievements", "Badges"],
            ["/levels", "Level & themes"],
            ...(accountsEnabled ? [["/leaderboard", "Leaderboard"]] : []),
            ["/settings", "Settings"],
            ["/privacy", "Privacy"],
          ].flatMap(([to, label], i) => [
            // The separator is its own item, so one gap sits between every
            // pair rather than a gap plus a nested gap.
            ...(i > 0
              ? [
                  <span key={`${to}-sep`} aria-hidden="true" className="text-zinc-700">
                    ·
                  </span>,
                ]
              : []),
            <Link
              key={to}
              to={to}
              className="underline underline-offset-4 transition-colors hover:text-zinc-300"
            >
              {label}
            </Link>,
          ])}
        </nav>
      </main>
    </div>
  );
}

/** A titled band of the menu, so the page reads as three decisions not thirty. */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-2.5 flex items-baseline gap-3 px-1">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500">
          {title}
        </h2>
        <span className="h-px flex-1 bg-white/[0.07]" aria-hidden="true" />
        {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** A secondary destination: present, but not competing with the main game. */
function SmallLink({
  to,
  icon,
  title,
  note,
  hidden,
  highlight,
}: {
  to: string;
  icon: string;
  title: string;
  note: string;
  hidden?: boolean;
  highlight?: boolean;
}) {
  if (hidden) return null;
  return (
    <Link
      to={to}
      className={`group flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-colors ${
        highlight
          ? "border-amber-400/30 bg-amber-400/[0.06] hover:border-amber-400/50"
          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
      }`}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-zinc-100">
          {title}
        </span>
        <span className="block truncate text-xs text-zinc-500">{note}</span>
      </span>
    </Link>
  );
}
