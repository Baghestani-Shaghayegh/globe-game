import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCountryMeta } from "../data/countries";
import { areaOf } from "../data/areas";
import { VIEW, outlinePath } from "../lib/outline";
import Celebrate from "../components/Celebrate";
import { playCorrect, playLose, playRecord } from "../lib/sound";
import type { Geometry } from "../lib/geo";
import {
  askable,
  bigger,
  formatArea,
  loadBest,
  nextPair,
  saveBest,
  score,
  type Pair,
} from "../lib/higherLower";

type CountryFeature = { properties: { name: string }; geometry: Geometry };

const display = (name: string) => getCountryMeta(name).displayName;

type Verdict = { picked: string; correct: boolean } | null;

function Card({
  name,
  shape,
  onPick,
  verdict,
  disabled,
}: {
  name: string;
  shape: string;
  onPick: () => void;
  verdict: Verdict;
  disabled: boolean;
}) {
  const judged = verdict !== null;
  const isWinner = judged && bigger(verdict.picked, name) === name && true;
  // Once judged, the truth is shown regardless of what was picked.
  const revealed = judged;
  const chosen = judged && verdict.picked === name;

  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className={`group flex flex-1 flex-col items-center gap-4 rounded-2xl border p-6 transition-colors ${
        revealed
          ? chosen
            ? verdict.correct
              ? "border-emerald-400/50 bg-emerald-400/[0.08]"
              : "border-rose-400/50 bg-rose-400/[0.08]"
            : "border-white/10 bg-white/[0.02]"
          : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]"
      }`}
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="h-28 w-28 sm:h-36 sm:w-36"
        role="img"
        aria-label={`Outline of ${display(name)}`}
      >
        <path
          d={shape}
          className={
            revealed
              ? chosen && verdict.correct
                ? "fill-emerald-400"
                : chosen
                  ? "fill-rose-400"
                  : "fill-zinc-600"
              : "fill-teal-400 transition-colors group-hover:fill-teal-300"
          }
        />
      </svg>
      <span className="text-center text-lg font-medium text-zinc-50">
        {display(name)}
      </span>
      <span
        className={`text-sm tabular-nums transition-opacity ${
          revealed ? "text-zinc-300 opacity-100" : "opacity-0"
        }`}
      >
        {formatArea(areaOf(name) ?? 0)}
      </span>
      {isWinner && revealed && (
        <span className="text-xs uppercase tracking-wider text-emerald-300/70">
          bigger
        </span>
      )}
    </button>
  );
}

export default function HigherLower() {
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [pair, setPair] = useState<Pair | null>(null);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [scores, setScores] = useState({ streak: 0, best: 0 });

  useEffect(() => {
    setScores({ streak: 0, best: loadBest() });
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => res.json())
      .then((data: { features: CountryFeature[] }) => {
        if (!cancelled) setFeatures(data.features);
      })
      .catch(() => {
        /* the page says so below */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pool = useMemo(() => {
    if (!features.length) return [];
    const drawable = new Set(features.map((f) => f.properties.name));
    return askable().filter((name) => drawable.has(name));
  }, [features]);

  useEffect(() => {
    if (pool.length && !pair) setPair(nextPair(pool));
  }, [pool, pair]);

  const shapes = useMemo(() => {
    if (!pair) return { left: "", right: "" };
    const of = (name: string) => {
      const feature = features.find((f) => f.properties.name === name);
      return feature ? outlinePath(feature.geometry) : "";
    };
    return { left: of(pair.left), right: of(pair.right) };
  }, [pair, features]);

  const [burst, setBurst] = useState(0);

  const pick = useCallback(
    (picked: string) => {
      if (!pair || verdict) return;
      const correct = bigger(pair.left, pair.right) === picked;
      setVerdict({ picked, correct });
      setScores((current) => {
        const next = score(current, correct);
        if (next.best > current.best) saveBest(next.best);
        return next;
      });

      // This mode is a streak and nothing else, so the streak is what the
      // sound tracks: each right answer a step higher, a wrong one the fall.
      if (correct) {
        playCorrect(scores.streak);
        // A new personal best is the only thing here worth paper for.
        if (scores.streak + 1 > scores.best) {
          playRecord();
          setBurst((n) => n + 1);
        }
      } else {
        playLose();
      }

      window.setTimeout(() => {
        setVerdict(null);
        // A correct answer keeps the winner on screen, so it plays as a chain
        // rather than a series of unrelated questions.
        setPair(
          nextPair(pool, Math.random, correct ? bigger(pair.left, pair.right) : undefined)
        );
      }, 1600);
    },
    [pair, verdict, pool, scores.streak, scores.best]
  );

  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Link
            to="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            ← Modes
          </Link>
          <span className="text-sm tabular-nums text-zinc-400">
            {scores.streak} in a row
            {scores.best > 0 && (
              <span className="text-zinc-600"> · best {scores.best}</span>
            )}
          </span>
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Which is bigger?
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          By land area. Pairs are only offered when one is clearly larger, so
          there are no coin flips.
        </p>

        {!pair ? (
          <p className="mt-10 text-center text-zinc-500">
            {features.length ? "Finding a pair…" : "Loading the map…"}
          </p>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <Card
                name={pair.left}
                shape={shapes.left}
                onPick={() => pick(pair.left)}
                verdict={verdict}
                disabled={verdict !== null}
              />
              <div className="flex items-center justify-center">
                <span className="text-sm uppercase tracking-wider text-zinc-600">
                  or
                </span>
              </div>
              <Card
                name={pair.right}
                shape={shapes.right}
                onPick={() => pick(pair.right)}
                verdict={verdict}
                disabled={verdict !== null}
              />
            </div>

            <p
              className={`mt-6 text-center text-sm ${
                verdict
                  ? verdict.correct
                    ? "text-emerald-300"
                    : "text-rose-300"
                  : "text-transparent"
              }`}
            >
              {verdict
                ? verdict.correct
                  ? "Right."
                  : `No — ${display(bigger(pair.left, pair.right))} is bigger.`
                : "placeholder"}
            </p>
          </>
        )}
      </main>

      <Celebrate burst={burst} count={80} />
    </div>
  );
}
