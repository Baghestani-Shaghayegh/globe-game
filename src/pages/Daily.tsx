import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import FindGame from "../features/globe-guess/FindGame";
import type { RoundOutcome } from "../features/globe-guess/FindGame";
import { getCountryMeta } from "../data/countries";
import { cluesFor } from "../data/clues";
import { capitalOf } from "../data/capitals";
import { flagUrl } from "../data/flags";
import { GAME_TYPES, type Mode } from "../data/modes";
import {
  challengeFor,
  dailyType,
  DAILY_MULTIPLIER,
  dayKey,
  formatDay,
  resultFor,
  saveResult,
  streak,
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

/** A mode built for one day: the ten countries the challenge asks for. */
function dailyMode(challenge: Challenge): Mode {
  const wanted = new Set(challenge.countries);
  return {
    id: "daily",
    name: "Daily challenge",
    desc: "",
    label: `#${challenge.number}`,
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
    topScores(recordKey(type, "daily", null), dayStart(), 10)
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
      };
      saveResult(saved);
      setResult(saved);
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
      <div className="flex min-h-screen items-center justify-center bg-[#07111c] text-zinc-400">
        Loading today's round…
      </div>
    );
  }

  if (result) {
    const label = GAME_TYPES.find((t) => t.id === result.type)?.label ?? "";
    const days = streak(day);
    return (
      <div className="min-h-screen bg-[#07111c] px-5 py-12">
        <main className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            ← Modes
          </Link>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
            Daily #{result.number}
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
            <p className="mt-4 text-2xl leading-none tracking-widest">
              {result.outcomes
                .map((o) =>
                  o === "first" ? "🟩" : o === "retried" ? "🟨" : "⬜"
                )
                .join("")}
            </p>
          </div>

          {days > 1 && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              🔥 {days}-day streak
            </p>
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
    limitMs: null,
    ruleset: "relaxed" as const,
    pointsMultiplier: DAILY_MULTIPLIER,
  };

  return challenge.type === "name" ? (
    <GlobeGame {...shared} onRoundEnd={finish} />
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
}
