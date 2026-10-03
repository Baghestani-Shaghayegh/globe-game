import ShareResult from "../components/ShareResult";
import { CARD_FOUND } from "../features/globe-guess/RoundShare";
import RecordSwitch from "../features/replay/RecordSwitch";
import ReplayActions from "../features/replay/ReplayActions";
import { keepReplay, recordingOn, ReplayRecorder, type Replay } from "../lib/replay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ExitConfirm from "../features/globe-guess/ExitConfirm";
import { useLeaveGuard } from "../features/globe-guess/useLeaveGuard";
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
import { siteHost } from "../lib/site";

type CountryFeature = { properties: { name: string }; geometry: Geometry };

const display = (name: string) => getCountryMeta(name).displayName;

type Verdict = { picked: string; correct: boolean } | null;

function Card({
  name,
  shape,
  onPick,
  verdict,
  disabled,
  winner,
}: {
  name: string;
  shape: string;
  onPick: () => void;
  verdict: Verdict;
  disabled: boolean;
  /** The bigger of the pair, once judged. */
  winner: string | null;
}) {
  const judged = verdict !== null;
  // Compared against the other card, not the one picked: measured against the
  // pick, the picked card was always "bigger" than itself, so a wrong answer
  // put BIGGER under both countries.
  const isWinner = judged && winner === name;
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

  /**
   * The countries asked about lately, so a question can't come back around
   * while it is still fresh in mind. Long enough to cover a few rounds,
   * short enough that a streak never runs out of countries to ask.
   */
  const recent = useRef<string[]>([]);
  const remember = useCallback((...names: string[]) => {
    recent.current = [...names, ...recent.current].slice(0, 8);
  }, []);

  useEffect(() => {
    if (pool.length && !pair) {
      const first = nextPair(pool);
      if (first) remember(first.left, first.right);
      setPair(first);
    }
  }, [pool, pair, remember]);

  const shapes = useMemo(() => {
    if (!pair) return { left: "", right: "" };
    const of = (name: string) => {
      const feature = features.find((f) => f.properties.name === name);
      return feature ? outlinePath(feature.geometry) : "";
    };
    return { left: of(pair.left), right: of(pair.right) };
  }, [pair, features]);

  const [burst, setBurst] = useState(0);
  /** The streak a wrong answer just ended, to share; cleared by the next run. */
  const [ended, setEnded] = useState(0);

  // A run, recorded from its first pair to the pick that ends it: each pair
  // and what was picked. No globe here, so no camera.
  const recorder = useRef<ReplayRecorder | null>(null);
  const [recorded, setRecorded] = useState<Replay | null>(null);
  useEffect(() => {
    if (!pair) return;
    recorder.current ??= new ReplayRecorder();
    recorder.current.mark(["b", pair.left, pair.right, "", 0]);
  }, [pair]);

  const pick = useCallback(
    (picked: string) => {
      if (!pair || verdict) return;
      const correct = bigger(pair.left, pair.right) === picked;
      setVerdict({ picked, correct });
      const rec = recorder.current;
      rec?.mark(["b", pair.left, pair.right, picked, correct ? 1 : 0]);
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
        setEnded(0);
        setRecorded(null);
      } else {
        playLose();
        if (scores.streak > 0) setEnded(scores.streak);
        // The run is over: kept if it got anywhere, and the next pair starts
        // a new one.
        recorder.current = null;
        if (rec && scores.streak > 0 && recordingOn()) {
          const replay = rec.finish(
            { type: "bigger", mode: "streak", label: "Which is bigger?", bucket: "" },
            {
              ms: rec.elapsed(),
              points: scores.streak,
              found: scores.streak,
              total: scores.streak + 1,
            }
          );
          keepReplay(replay);
          setRecorded(replay);
        }
      }

      window.setTimeout(() => {
        setVerdict(null);
        // A correct answer keeps the winner on screen, so it plays as a chain
        // rather than a series of unrelated questions.
        const next = nextPair(
          pool,
          Math.random,
          correct ? bigger(pair.left, pair.right) : undefined,
          recent.current
        );
        if (next) remember(next.left, next.right);
        setPair(next);
      }, 1600);
    },
    [pair, verdict, pool, scores.streak, scores.best, remember]
  );


  /**
   * Leaving mid-game asks first, by the link or by the browser's Back — which
   * on a trackpad is a two-finger swipe, easy to trigger while dragging a
   * globe around.
   *
   * The streak is the whole game here, and leaving ends it. Asked only once
   * there is one to lose.
   */
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const goingSomewhere = useRef(false);
  const inProgress = scores.streak > 0;
  useLeaveGuard(inProgress && !goingSomewhere.current, () => setLeaving(true));

  const leave = () => {
    goingSomewhere.current = true;
    navigate("/");
  };
  return (
    <div className="min-h-screen bg-page px-5 py-10 sm:px-8 lg:px-12">
      <main className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Link
            to="/"
            onClick={(e) => {
              if (!inProgress) return;
              e.preventDefault();
              setLeaving(true);
            }}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            ← Modes
          </Link>
          <span className="ml-auto">
            <RecordSwitch />
          </span>
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
          By land area.
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
                winner={verdict ? bigger(pair.left, pair.right) : null}
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
                winner={verdict ? bigger(pair.left, pair.right) : null}
              />
            </div>

            {/* No line under the cards: their colours, the areas and the
                "bigger" label already say how it went, and Sara found the
                sentence repeating them unnecessary. Kept for screen readers,
                which can't see the colours. */}
            {ended > 0 && !verdict && (
              <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-center text-sm text-zinc-300">
                  That streak ended at{" "}
                  <span className="font-semibold text-zinc-50">{ended}</span>.
                </p>
                <div className="mt-4">
                  <ShareResult
                    replay={recorded}
                    text={`I got ${ended} in a row on GuessGlobe's Which is bigger?`}
                    filename="guessglobe-bigger.png"
                    card={(features) => ({
                      eyebrow: "Which is bigger?",
                      title: `${ended} in a row`,
                      subtitle: "Countries by land area",
                      tiles: Array.from({ length: Math.min(ended, 40) }, () => CARD_FOUND),
                      globe: features ? { features, colors: {} } : undefined,
                      site: siteHost(),
                    })}
                  />
                </div>
                {recorded && (
                  <div className="mt-4 border-t border-white/[0.07] pt-4">
                    <ReplayActions replay={recorded} />
                  </div>
                )}
              </div>
            )}

            <p className="sr-only" aria-live="polite">
              {verdict
                ? verdict.correct
                  ? "Right."
                  : `No — ${display(bigger(pair.left, pair.right))} is bigger.`
                : ""}
            </p>
          </>
        )}
      </main>

      <Celebrate burst={burst} count={80} />
      {leaving && (
        <ExitConfirm onFinish={leave} onKeepPlaying={() => setLeaving(false)} />
      )}

    </div>
  );
}
