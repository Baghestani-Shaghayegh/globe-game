import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  allCountries,
  byContinent,
  mostMissed,
  totals,
  type ContinentRow,
  type CountryRow,
} from "../lib/countryStats";
import { allBuckets, formatDuration } from "../lib/records";
import { dayKey, streak } from "../lib/daily";
import { MODES } from "../data/modes";
import type { Continent } from "../data/continents";

const FALLBACK_ACCENT = "#8fb8d1";

function continentName(id: Continent): string {
  return MODES.find((m) => m.id === id)?.name ?? id;
}

function continentAccent(id: Continent): string {
  return MODES.find((m) => m.id === id)?.accent ?? FALLBACK_ACCENT;
}

/** The colour of a percentage: green when it's solid, red when it isn't. */
function gradeColor(accuracy: number): string {
  if (accuracy >= 80) return "#4ade80";
  if (accuracy >= 55) return "#fbbf24";
  return "#fb7185";
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums text-zinc-50">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function ContinentBar({ row }: { row: ContinentRow }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: continentAccent(row.continent) }}
      />
      <span className="w-24 shrink-0 text-sm text-zinc-200">
        {continentName(row.continent)}
      </span>
      <span
        aria-hidden="true"
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]"
      >
        <span
          className="block h-full rounded-full transition-[width]"
          style={{
            width: `${row.accuracy}%`,
            backgroundColor: gradeColor(row.accuracy),
          }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-zinc-200">
        {row.accuracy}%
      </span>
      <span className="hidden w-28 shrink-0 text-right text-xs tabular-nums text-zinc-600 sm:block">
        {row.countries} {row.countries === 1 ? "country" : "countries"}
      </span>
    </li>
  );
}

function MissedRow({ row }: { row: CountryRow }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
      <span className="text-zinc-100">{row.displayName}</span>
      <span className="text-xs text-zinc-600">
        {row.continents.map(continentName).join(" · ")}
      </span>
      <span className="ml-auto flex items-center gap-3 tabular-nums">
        {row.missed > 0 && (
          <span className="text-rose-300/80">
            {row.missed} missed
          </span>
        )}
        {row.fumbled > 0 && (
          <span className="text-amber-300/70">
            {row.fumbled} on the retry
          </span>
        )}
        <span
          className="w-9 text-right"
          style={{ color: gradeColor(row.accuracy) }}
        >
          {row.accuracy}%
        </span>
      </span>
    </li>
  );
}

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
      <div className="flex items-baseline gap-3 px-1">
        <h2 className="text-sm uppercase tracking-wider text-zinc-500">
          {title}
        </h2>
        {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        {children}
      </div>
    </section>
  );
}

export default function Stats() {
  // Read once on mount: storage isn't reactive, and nothing here changes
  // while the page is open.
  const [rows] = useState<CountryRow[]>(() => allCountries());
  const summary = useMemo(() => totals(rows), [rows]);
  const continents = useMemo(() => byContinent(rows), [rows]);
  const missed = useMemo(() => mostMissed(10, rows), [rows]);
  const played = useMemo(() => {
    const runs = allBuckets().flatMap((b) => b.runs);
    return {
      runs: runs.length,
      ms: runs.reduce((sum, run) => sum + run.ms, 0),
    };
  }, []);
  const [days] = useState(() => streak(dayKey()));

  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Your stats
        </h1>

        {summary.accuracy === null ? (
          <p className="mt-4 text-zinc-400">
            Nothing measured yet. Play a round and this page fills in with the
            countries you know and the ones that keep getting away.
          </p>
        ) : (
          <>
            <p className="mt-2 text-zinc-400">
              Counted from every country a round has actually put in front of
              you.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile value={`${summary.accuracy}%`} label="First try" />
              <Tile value={String(summary.countries)} label="Countries met" />
              <Tile value={String(played.runs)} label="Rounds" />
              <Tile
                value={days > 0 ? `🔥 ${days}` : "—"}
                label="Daily streak"
              />
            </div>

            <Section
              title="Accuracy by continent"
              hint="weakest first"
            >
              <ul className="divide-y divide-white/[0.05]">
                {continents.map((row) => (
                  <ContinentBar key={row.continent} row={row} />
                ))}
              </ul>
            </Section>

            {missed.length > 0 && (
              <Section
                title="Keeps beating you"
                hint="practice these"
              >
                <ul className="divide-y divide-white/[0.05]">
                  {missed.map((row) => (
                    <MissedRow key={row.geoName} row={row} />
                  ))}
                </ul>
              </Section>
            )}

            <p className="mt-6 text-sm tabular-nums text-zinc-600">
              {summary.seen} {summary.seen === 1 ? "country" : "countries"} put
              to you across {played.runs} {played.runs === 1 ? "round" : "rounds"}
              {played.ms > 0 && ` · ${formatDuration(played.ms)} played`}
            </p>
          </>
        )}

        <Link
          to="/records"
          className="mt-8 inline-block text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
        >
          Your records
        </Link>
      </main>
    </div>
  );
}
