import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import FindGame from "../features/globe-guess/FindGame";
import DailyResultGlobe from "../features/globe-guess/DailyResultGlobe";
import ShareResult from "../components/ShareResult";
import SignInNudge from "../components/SignInNudge";
import ReplayActions from "../features/replay/ReplayActions";
import RecordSwitch from "../features/replay/RecordSwitch";
import { todaysReplay, type Replay } from "../lib/replay";
import { CARD_FOUND, CARD_MISSED } from "../features/globe-guess/RoundShare";
import type { RoundOutcome } from "../features/globe-guess/FindGame";
import { getCountryMeta } from "../data/countries";
import { cluesFor } from "../data/clues";
import { capitalOf } from "../data/capitals";
import { flagUrl } from "../data/flags";
import { GAME_TYPES, type Mode } from "../data/modes";
import {
  challengeFor,
  dailyType,
  DAILY_LIMIT_MS,
  DAILY_LIMIT_SECONDS,
  DAILY_MULTIPLIER,
  dayKey,
  formatDay,
  resultCountries,
  resultFor,
  saveResult,
  type Challenge,
  type DailyResult,
  type Outcome,
} from "../lib/daily";
import { formatDuration } from "../lib/records";
import AdSlot from "../components/AdSlot";
import Celebrate from "../components/Celebrate";
import { dayStart, topScores, type BoardRow } from "../lib/leaderboard";
import { accountsEnabled } from "../lib/supabase";
import { recordKey } from "../data/modes";
import { siteHost } from "../lib/site";

/** A mode built for one day: the ten countries the challenge asks for. */
function dailyMode(challenge: Challenge): Mode {
  const wanted = new Set(challenge.countries);
  return {
    id: "daily",
    name: "Daily challenge",
    desc: "",
    label: "Daily",
    level: 2,
    accent: "#38bdf8",
    regional: false,
    noun: "countries",
    includes: (meta) => wanted.has(meta.geoName),
  };
}

/** Countries today's game type can actually pose a question about. */
function poolFor(type: Challenge["type"], names: string[]): string[] {
  return names
    .map(getCountryMeta)
    .filter((meta) => meta.tier === "country")
    .filter((meta) => type !== "flag" || flagUrl(meta.geoName) !== null)
    .filter((meta) => type !== "famous" || cluesFor(meta.geoName).length > 0)
          .filter((meta) => type !== "capital" || capitalOf(meta.geoName) !== null)
    .map((meta) => meta.geoName);
}

/**
 * Today's board. The daily challenge is the one round everybody plays the
 * same, so it's the only place a leaderboard compares like with like without
 * anyone choosing settings — which makes it the place worth showing one.
 */
function TodaysBoard({ type }: { type: Challenge["type"] }) {
  const [rows, setRows] = useState<BoardRow[] | null>(null);

  useEffect(() => {
    if (!accountsEnabled) return;
    let cancelled = false;
    // The limit goes in because recordKey puts it in: a timed round files
    // under "@300", and a board that looked the daily up without it read an
    // empty bucket every day.
    topScores(recordKey(type, "daily", DAILY_LIMIT_SECONDS), dayStart(), 10)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        // A board that won't load shouldn't bury the player's own result.
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  if (!accountsEnabled || !rows?.length) return null;

  return (
    <section className="mt-8">
      <h2 className="px-1 text-sm uppercase tracking-wider text-zinc-500">
        Today's board
      </h2>
      <ol className="mt-2 divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        {rows.map((row) => (
          <li
            key={row.user_id}
            className="flex items-center gap-3 px-4 py-2 text-sm"
          >
            <span className="w-5 shrink-0 text-right tabular-nums text-zinc-600">
              {row.rank}
            </span>
            {row.country && (
              <img
                src={`/flags/${row.country}.svg`}
                alt=""
                width={18}
                height={14}
                className="w-[18px] shrink-0 rounded-[2px]"
              />
            )}
            <span className="truncate text-zinc-100">{row.username}</span>
            {row.has_replay && row.score_id && (
              <Link
                to={`/replay/${row.score_id}`}
                aria-label={`Watch ${row.username}'s run`}
                className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-xs text-zinc-300 hover:border-teal-300/60 hover:text-teal-200"
              >
                ▶ Watch
              </Link>
            )}
            <span className="ml-auto shrink-0 tabular-nums text-zinc-300">
              {row.points.toLocaleString()}
            </span>
          </li>
        ))}
      </ol>
      <Link
        to="/leaderboard"
        className="mt-3 inline-block px-1 text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
      >
        All leaderboards
      </Link>
    </section>
  );
}

export default function Daily() {
  const day = dayKey();
  const [names, setNames] = useState<string[] | null>(null);
  const [result, setResult] = useState<DailyResult | null>(() => resultFor(day));
  /** Today's round as recorded, to watch back and post. A finished daily that
   *  is opened again gets its recording back from the device, without a board
   *  entry to post to: that was settled when the round ended. */
  const [recorded, setRecorded] = useState<{
    replay: Replay;
    postedId?: () => Promise<number | null>;
  } | null>(() => {
    if (!resultFor(day)) return null;
    const kept = todaysReplay(day, (game) => !["mystery", "connect", "bigger", "clues"].includes(game.type));
    return kept ? { replay: kept } : null;
  });
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { features: { properties: { name: string } }[] }) => {
        if (!cancelled) setNames(data.features.map((f) => f.properties.name));
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Built in two passes: the date picks the game type, and the type decides
  // which countries can be asked about at all.
  const challenge = useMemo(() => {
    if (!names) return null;
    const type = dailyType(day);
    return challengeFor(day, poolFor(type, names));
  }, [day, names]);

  const finish = useCallback(
    (outcome: RoundOutcome) => {
      if (!challenge) return;
      const fumbled = new Set(outcome.fumbled);
      const missed = new Set(outcome.missed);
      const outcomes: Outcome[] = challenge.countries.map((name) =>
        missed.has(name) ? "missed" : fumbled.has(name) ? "retried" : "first"
      );
      const saved: DailyResult = {
        day: challenge.day,
        number: challenge.number,
        type: challenge.type,
        points: outcome.points,
        ms: outcome.ms,
        found: outcome.found.length,
        total: challenge.countries.length,
        outcomes,
        countries: challenge.countries,
      };
      saveResult(saved);
      setResult(saved);
      if (outcome.replay) {
        const id = outcome.postedId ?? Promise.resolve(null);
        setRecorded({ replay: outcome.replay, postedId: () => id });
      }
      // Fired here rather than on the result screen, so re-opening a finished
      // daily is a record to read and not a party thrown again.
      if (outcome.found.length === challenge.countries.length) {
        setBurst((n) => n + 1);
      }
    },
    [challenge]
  );

  if (!challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-zinc-400">
        Loading today's round…
      </div>
    );
  }

  if (result) {
    const label = GAME_TYPES.find((t) => t.id === result.type)?.label ?? "";
    const played = resultCountries(
      result,
      challenge.day === result.day ? challenge.countries : null
    );
    return (
      <div className="min-h-screen bg-page px-5 py-12">
        <main className="mx-auto w-full max-w-[1180px]">
          <Link
            to="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            ← Modes
          </Link>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
            Daily challenge
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatDay(result.day)} · {label}
          </p>
          <p className="mt-1 text-xs text-sky-300/70">
            Daily rounds count {DAILY_MULTIPLIER}× towards the leaderboard.
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-4xl font-semibold tabular-nums text-zinc-50">
              {result.points.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs uppercase tracking-wider text-zinc-500">
              points
            </p>
            <p className="mt-3 text-sm tabular-nums text-zinc-400">
              {result.found} of {result.total} found ·{" "}
              {formatDuration(result.ms)}
            </p>
            {/* Otherwise a round the clock ended reads as a round you simply
                stopped playing, and "5:00" alone does not say which. */}
            {result.found < result.total &&
              result.ms >= DAILY_LIMIT_MS && (
                <p className="mt-1 text-xs text-amber-300/80">
                  Time ran out.
                </p>
              )}
            {/* One line on a phone too: ten squares at the desktop size are
                wider than a 390px screen, and the tenth wrapped on its own. */}
            <p className="mt-4 whitespace-nowrap text-xl leading-none tracking-wide sm:text-2xl sm:tracking-widest">
              {result.outcomes
                .map((o) =>
                  o === "first" ? "🟩" : o === "retried" ? "🟨" : "⬜"
                )
                .join("")}
            </p>
            {/* Today's only: a challenge on yesterday's hunt would send a
                friend to a round they can't play. */}
            {result.day === dayKey() && (
              <div className="mx-auto mt-6 max-w-sm border-t border-white/[0.07] pt-5">
                <ShareResult
                  replay={recorded?.replay}
                  text={`I found ${result.found}/${result.total} in ${formatDuration(result.ms)} on today's GuessGlobe Country hunt.`}
                  filename={`guessglobe-hunt-${result.day}.png`}
                  card={(features) => ({
                    eyebrow: `Country hunt · ${formatDay(result.day)}`,
                    title: `${result.found} / ${result.total}`,
                    subtitle: `${formatDuration(result.ms)} · ${result.points.toLocaleString()} points`,
                    tiles: result.outcomes.map((o) =>
                      o === "first" ? CARD_FOUND : o === "retried" ? "#fbbf24" : CARD_MISSED
                    ),
                    // The globe, but none of today's ten on it: the card goes
                    // to people who haven't played yet.
                    globe: features ? { features, colors: {} } : undefined,
                    site: siteHost(),
                  })}
                />
              </div>
            )}
          </div>

          <SignInNudge />

          {recorded && (
            <div className="mx-auto mt-4 max-w-sm rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <ReplayActions replay={recorded.replay} postedId={recorded.postedId} />
            </div>
          )}

          {played && (
            <DailyResultGlobe countries={played} outcomes={result.outcomes} />
          )}

          <AdSlot className="mt-8" />

          <TodaysBoard type={result.type} />

          <Celebrate burst={burst} count={110} />

          <p className="mt-6 text-center text-sm text-zinc-500">
            One round a day. The next one lands at midnight UTC.
          </p>
        </main>
      </div>
    );
  }

  const mode = dailyMode(challenge);
  const shared = {
    mode,
    limitMs: DAILY_LIMIT_MS,
    ruleset: "relaxed" as const,
    pointsMultiplier: DAILY_MULTIPLIER,
  };

  const game = challenge.type === "name" ? (
    <GlobeGame
      {...shared}
      // The day's ten are scattered at random across the world, so on their
      // own they are ten specks on an empty sphere. The whole map is drawn
      // behind them to navigate by, with the ten raised out of it — in this
      // game that marking gives nothing away, because the ten are the
      // questions and the answers are their names.
      backdrop
      showInPlay
      // Leaving part-way doesn't use up the day: the hunt is done only when
      // it is finished, the clock runs out, or the player presses Quit.
      leaveDiscards
      onRoundEnd={finish}
    />
  ) : (
    <FindGame
      {...shared}
      type={challenge.type}
      fixedOrder={challenge.countries}
      // The day's ten countries are picked at random from the whole world, so
      // they share no geography. Drawn alone they are specks on an empty
      // sphere with nothing to navigate by; the rest of the map is what makes
      // finding them possible.
      backdrop
      onRoundEnd={finish}
    />
  );
  return (
    <>
      {game}
      {/* Recording, as on every globe round: on by default, tap to stop. */}
      <div className="pointer-events-none fixed right-4 top-4 z-30 lg:bottom-4 lg:top-auto">
        <RecordSwitch />
      </div>
    </>
  );
}
