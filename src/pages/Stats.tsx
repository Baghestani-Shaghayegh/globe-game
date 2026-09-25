import { useMemo, useState } from "react";
import {
  MASTERY_ACCURACY,
  MASTERY_CLEAN,
  allCountries,
  byContinent,
  mastery,
  totals,
  type ContinentRow,
  type CountryRow,
} from "../lib/countryStats";
import { allBuckets, bestRun, formatDuration } from "../lib/records";
import { dayKey, scoreSpread, streakState } from "../lib/daily";
import { MODES } from "../data/modes";
import type { Continent } from "../data/continents";
import { PageShell, ProgressTabs } from "../components/SiteHeader";

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

function Tile({
  value,
  unit,
  label,
}: {
  value: string;
  /**
   * What the figure is counted in, small and quiet beside it.
   *
   * Spelled out rather than abbreviated: the hint buttons in a round say
   * "½ points" and "0 points", and the menu says "2× points", so "pts" here
   * would be the only abbreviation in the game.
   */
  unit?: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums text-zinc-50">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-medium text-zinc-500">{unit}</span>
        )}
      </p>
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

/**
 * How much of the map is yours, as one bar.
 *
 * The four figures above answer "how am I doing"; this answers "how far
 * through am I", which is the question a geography game is really asking. It
 * is the one number here that has an end, so it is the one that reads as
 * progress rather than as a score.
 */
function MasteryBar({ mastered, total }: { mastered: number; total: number }) {
  const share = total > 0 ? Math.min(1, mastered / total) : 0;
  return (
    <div className="mt-3">
      <span
        aria-hidden="true"
        className="block h-2 overflow-hidden rounded-full bg-white/[0.07]"
      >
        <span
          className="block h-full rounded-full bg-teal-300/80"
          style={{ width: `${share * 100}%` }}
        />
      </span>
      <p className="mt-1.5 text-xs text-zinc-600">
        {total - mastered} to go
      </p>
    </div>
  );
}

/**
 * Every daily you have played, by how many of the ten you found.
 *
 * One row per score, ten at the top, so a good run of days leans the bars
 * upward — the shape is the point, which is why the bars are all one colour
 * and only the counts are labelled. Today's score is not marked out: the row
 * it lands in is the mark.
 */
function DailySpread({ spread }: { spread: { found: number; days: number }[] }) {
  const most = Math.max(...spread.map((bin) => bin.days), 1);

  // Eleven rows of which seven are empty is not a shape, it is a gap. The
  // chart runs from ten down to the worst day there has been, and never
  // shows fewer than five rows — a week of tens would otherwise be a single
  // bar with nothing to be better than.
  const worst = spread.reduce(
    (last, bin, index) => (bin.days > 0 ? index : last),
    0
  );
  const rows = spread.slice(0, Math.max(worst, 4) + 1);

  return (
    <ul className="space-y-1 px-4 py-3">
      {rows.map((bin) => (
        <li key={bin.found} className="flex items-center gap-3 text-xs">
          <span className="w-5 shrink-0 text-right tabular-nums text-zinc-500">
            {bin.found}
          </span>
          <span className="flex h-4 min-w-0 flex-1 items-center">
            <span
              className="h-full rounded-[3px] bg-teal-300/70"
              style={{ width: `${Math.max(bin.days > 0 ? 3 : 0, (bin.days / most) * 100)}%` }}
            />
            {bin.days > 0 && (
              <span className="ml-2 tabular-nums text-zinc-400">{bin.days}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
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
  const played = useMemo(() => {
    const runs = allBuckets().flatMap((b) => b.runs);
    return {
      runs: runs.length,
      ms: runs.reduce((sum, run) => sum + run.ms, 0),
    };
  }, []);
  const [run] = useState(() => streakState(dayKey()));
  const learned = useMemo(() => mastery(rows), [rows]);
  const best = useMemo(() => bestRun(), []);
  const spread = useMemo(() => scoreSpread(), []);

  return (
    <PageShell>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
        Your stats
      </h1>

      <ProgressTabs />

      {summary.accuracy === null ? (
        <p className="mt-4 text-zinc-400">
          Nothing measured yet. Play a round and this page fills in with the
          countries you know and the ones that keep getting away.
        </p>
      ) : (
        <>
          {/* Four figures worth chasing, not four worth decoding. "66% first
              try" and "88 countries met" were a report card: true, hard to
              place, and impossible to brag about. What replaces them is the
              set every game of this kind shows — how far through you are,
              your best, your streak, and how much you have played. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              value={`${learned.mastered}/${learned.total}`}
              label="Countries mastered"
            />
            <Tile
              value={best ? best.points.toLocaleString() : "—"}
              unit={best ? "points" : undefined}
              label={best ? "Best round" : "No scored round yet"}
            />
            {/* Two tiles, the way Wordle counts a streak: the one you are on
                and the best you have had. As a "· best 3" tacked onto the
                label it read as a footnote about the same number.

                Nought is a number here. The chip beside the player's name
                hides at nought on purpose — an empty flame there is a
                reproach — but this page is the place that answers "how am I
                doing", and a dash answers nothing. */}
            <Tile
              value={run.days > 0 ? `🔥 ${run.days}` : "0"}
              label="Day streak"
            />
            <Tile value={String(run.best)} label="Best streak" />
          </div>

          <MasteryBar mastered={learned.mastered} total={learned.total} />

          {spread.some((bin) => bin.days > 0) && (
            <Section title="Daily scores" hint="how each day has gone">
              <DailySpread spread={spread} />
            </Section>
          )}

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-zinc-50">
            Where you're weak
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Counted from every country a round has actually put in front of
            you. A country counts as mastered once you have named it{" "}
            {MASTERY_CLEAN} times with no wrong answer, and get it right first
            time at least {MASTERY_ACCURACY}% of the time.
          </p>

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

          <p className="mt-6 text-sm tabular-nums text-zinc-600">
            {summary.seen} {summary.seen === 1 ? "country" : "countries"} put
            to you across {played.runs} {played.runs === 1 ? "round" : "rounds"}
            {played.ms > 0 && ` · ${formatDuration(played.ms)} played`}
          </p>
        </>
      )}

    </PageShell>
  );
}
