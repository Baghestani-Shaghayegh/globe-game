import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import FindGame from "../features/globe-guess/FindGame";
import type { RoundOutcome } from "../features/globe-guess/FindGame";
import { getCountryMeta } from "../data/countries";
import { cluesFor } from "../data/clues";
import { flagUrl } from "../data/flags";
import { GAME_TYPES, type Mode } from "../data/modes";
import {
  challengeFor,
  dayKey,
  formatDay,
  resultFor,
  saveResult,
  shareText,
  streak,
  type Challenge,
  type DailyResult,
  type Outcome,
} from "../lib/daily";
import { formatDuration } from "../lib/records";

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
    .map((meta) => meta.geoName);
}

export default function Daily() {
  const day = dayKey();
  const [names, setNames] = useState<string[] | null>(null);
  const [result, setResult] = useState<DailyResult | null>(() => resultFor(day));
  const [copied, setCopied] = useState(false);

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
    const type = challengeFor(day, ["placeholder"]).type;
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

          <button
            onClick={() => {
              navigator.clipboard?.writeText(shareText(result));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-6 w-full rounded-lg bg-white/10 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            {copied ? "Copied" : "Copy result"}
          </button>

          <p className="mt-6 text-center text-sm text-zinc-500">
            One round a day. The next one lands at midnight UTC.
          </p>
        </main>
      </div>
    );
  }

  const mode = dailyMode(challenge);
  const shared = { mode, limitMs: null, ruleset: "relaxed" as const };

  return challenge.type === "name" ? (
    <GlobeGame {...shared} onRoundEnd={finish} />
  ) : (
    <FindGame
      {...shared}
      type={challenge.type}
      fixedOrder={challenge.countries}
      onRoundEnd={finish}
    />
  );
}
