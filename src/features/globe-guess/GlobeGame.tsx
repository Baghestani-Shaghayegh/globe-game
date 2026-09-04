import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { Link, useNavigate } from "react-router-dom";
import GuessModal from "./GuessModal";
import RoundSummary from "./RoundSummary";
import { getCountryMeta } from "../../data/countries";
import type { Mode } from "../../data/modes";
import { isCorrectGuess } from "../../lib/answerMatch";
import { theme } from "../../lib/globeTheme";
import { addRun, bestScore, bestTime, formatDuration } from "../../lib/records";

type CountryFeature = {
  properties: { name: string };
};

/** Everything the summary screen needs, frozen at the moment the run ended. */
type Summary = {
  ms: number;
  found: number;
  total: number;
  completed: boolean;
  accuracy: number | null;
  isBest: boolean;
  previousBest: string | null;
};

const globeMaterial = new THREE.MeshPhongMaterial({
  color: theme.sphere,
  shininess: 0,
});

type Props = {
  mode: Mode;
};

export default function GlobeGame({ mode }: Props) {
  const navigate = useNavigate();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrongTimer = useRef<number | undefined>(undefined);
  const framed = useRef(false);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [guess, setGuess] = useState("");
  const [isWrong, setIsWrong] = useState(false);
  const [foundNames, setFoundNames] = useState<Set<string>>(new Set());
  const [guesses, setGuesses] = useState(0);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [reviewingMap, setReviewingMap] = useState(false);

  // Stopwatch. It starts when the map is playable, not when the page mounts,
  // so a slow globe download doesn't land on the player's time.
  const startedAt = useRef<number | null>(null);
  const recorded = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);

  const resetRun = useCallback(() => {
    setFoundNames(new Set());
    setGuesses(0);
    setSelected(null);
    setGuess("");
    setIsWrong(false);
    setConfirmingExit(false);
    setReviewingMap(false);
    setElapsedMs(0);
    setSummary(null);
    startedAt.current = null;
    recorded.current = false;
  }, []);

  useEffect(() => {
    // Switching modes starts a fresh round, and with it a fresh clock.
    resetRun();

    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load map data (${res.status})`);
        return res.json();
      })
      .then((data: { features: CountryFeature[] }) => {
        if (cancelled) return;
        setFeatures(
          data.features.filter((f) =>
            mode.includes(getCountryMeta(f.properties.name))
          )
        );
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, resetRun]);

  useEffect(() => () => window.clearTimeout(wrongTimer.current), []);

  // Frame the globe a little closer than the default, once the map arrives.
  useEffect(() => {
    if (!features.length || framed.current) return;
    globeRef.current?.pointOfView({ lat: 12, lng: 20, altitude: 2.1 }, 0);
    framed.current = true;
  }, [features]);

  // Start the clock as soon as there is something to click.
  useEffect(() => {
    if (features.length && startedAt.current === null) {
      startedAt.current = performance.now();
    }
  }, [features]);

  // Only the readout needs ticking; the elapsed time itself is a subtraction,
  // so a coarse interval can't drift.
  useEffect(() => {
    if (!features.length || summary) return;
    const id = window.setInterval(() => {
      if (startedAt.current !== null) {
        setElapsedMs(performance.now() - startedAt.current);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [features.length, summary]);

  const suggestionNames = useMemo(
    () =>
      features
        .map((f) => getCountryMeta(f.properties.name).displayName)
        .sort((a, b) => a.localeCompare(b)),
    [features]
  );

  const allFound = features.length > 0 && foundNames.size === features.length;
  const progress = features.length
    ? Math.round((foundNames.size / features.length) * 100)
    : 0;

  /**
   * Ends the round — whether the player found everything or stopped early —
   * and files it, so a partial run still counts towards their records.
   */
  const endRun = useCallback(() => {
    if (recorded.current || startedAt.current === null) return;
    recorded.current = true;

    const ms = performance.now() - startedAt.current;
    const found = foundNames.size;
    const total = features.length;
    const completed = total > 0 && found === total;

    // Read the records before filing this run, so we compare against the past.
    const previousTime = bestTime(mode.id);
    const previousScore = bestScore(mode.id);
    // A run with nothing found isn't a result worth keeping.
    if (found > 0) addRun(mode.id, { ms, found, total });

    setSummary({
      ms,
      found,
      total,
      completed,
      accuracy: guesses > 0 ? Math.round((found / guesses) * 100) : null,
      isBest: completed
        ? !previousTime || ms < previousTime.ms
        : found > 0 && (!previousScore || found > previousScore.found),
      previousBest: completed
        ? previousTime
          ? formatDuration(previousTime.ms)
          : null
        : previousScore
          ? `${previousScore.found}/${previousScore.total}`
          : null,
    });
    setSelected(null);
    setConfirmingExit(false);
  }, [mode, features.length, foundNames, guesses]);

  // Finding the last country ends the round on its own.
  useEffect(() => {
    if (allFound) endRun();
  }, [allFound, endRun]);

  const closeModal = () => {
    setSelected(null);
    setGuess("");
    setIsWrong(false);
  };

  const handleSubmit = (value: string) => {
    if (!selected || !value.trim()) return;

    setGuesses((n) => n + 1);
    const country = getCountryMeta(selected.properties.name);
    if (isCorrectGuess(value, country)) {
      setFoundNames((prev) => new Set(prev).add(country.geoName));
      closeModal();
    } else {
      setIsWrong(true);
      window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setIsWrong(false), 600);
    }
  };

  /** The back arrow only interrupts when there is progress worth keeping. */
  const handleBack = () => {
    if (summary || foundNames.size === 0) {
      navigate("/");
      return;
    }
    setConfirmingExit(true);
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#07111c] px-6">
        <p className="text-zinc-100">Couldn't load the map data.</p>
        <Link
          to="/"
          className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100"
        >
          Back to modes
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07111c]">
      <Globe
        ref={globeRef}
        rendererConfig={{
          antialias: true,
          alpha: true,
          logarithmicDepthBuffer: true,
        }}
        backgroundColor={theme.page}
        globeMaterial={globeMaterial}
        atmosphereColor={theme.atmosphere}
        atmosphereAltitude={0.14}
        polygonsData={features}
        polygonCapColor={(d) => {
          const { name } = (d as CountryFeature).properties;
          if (foundNames.has(name)) return theme.found;
          // Once the run is over, everything left is shown as missed.
          if (summary) return theme.missed;
          if (selected && selected.properties.name === name)
            return theme.selected;
          return theme.unfound;
        }}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => theme.stroke}
        polygonAltitude={() => 0.012}
        polygonsTransitionDuration={0}
        onPolygonClick={(polygon) => {
          if (summary) return;
          const feature = polygon as CountryFeature;
          if (!foundNames.has(feature.properties.name)) {
            setSelected(feature);
          }
        }}
      />

      {/* HUD */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm backdrop-blur sm:left-4 sm:top-4 sm:gap-3 sm:px-3">
        <button
          onClick={handleBack}
          aria-label="Back to modes"
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <span className="h-4 w-px bg-white/10" aria-hidden="true" />

        <span className="tabular-nums text-zinc-100">
          <b className="font-medium">{foundNames.size}</b>
          <span className="text-zinc-500"> / {features.length}</span>
        </span>

        <span className="hidden h-1 w-20 overflow-hidden rounded-full bg-white/10 sm:block">
          <span
            className="block h-full rounded-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </span>

        <span
          className="hidden h-4 w-px bg-white/10 sm:block"
          aria-hidden="true"
        />

        <span
          className="tabular-nums text-zinc-300"
          aria-label="Time elapsed"
          role="timer"
        >
          {formatDuration(summary ? summary.ms : elapsedMs)}
        </span>

        <span
          className="hidden h-4 w-px bg-white/10 sm:block"
          aria-hidden="true"
        />

        <span className="hidden items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400 sm:flex">
          <span aria-hidden="true" className="flex items-end gap-[3px]">
            {["h-1.5", "h-2.5", "h-3.5"].map((height, i) => (
              <span
                key={height}
                className={`w-[3px] rounded-full ${height} ${
                  i < mode.level ? "bg-zinc-300" : "bg-white/15"
                }`}
              />
            ))}
          </span>
          {mode.label}
        </span>

        {!summary && features.length > 0 && (
          <>
            <span className="h-4 w-px bg-white/10" aria-hidden="true" />
            <button
              onClick={endRun}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
            >
              Finish
            </button>
          </>
        )}
      </div>

      {confirmingExit && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07111c]/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141b23] p-6 text-center">
            <p className="font-medium text-zinc-100">Leave this run?</p>
            <p className="mt-1.5 text-sm text-zinc-400">
              You've found {foundNames.size} of {features.length}. Finishing
              saves it to your records.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={endRun}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
              >
                Finish &amp; save
              </button>
              <button
                onClick={() => setConfirmingExit(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
              >
                Keep playing
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-4 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Discard and leave
              </button>
            </div>
          </div>
        </div>
      )}

      {summary && reviewingMap && (
        <div className="absolute inset-x-0 bottom-6 z-20 mx-auto flex w-fit items-center gap-3 rounded-full border border-white/10 bg-[#141b23]/90 py-2 pl-4 pr-2 text-sm backdrop-blur">
          <span className="flex items-center gap-2 text-zinc-400">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: theme.missed }}
            />
            {summary.total - summary.found} missed
          </span>
          <button
            onClick={() => setReviewingMap(false)}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            Show summary
          </button>
        </div>
      )}

      {summary && !reviewingMap && (
        <RoundSummary
          completed={summary.completed}
          ms={summary.ms}
          found={summary.found}
          total={summary.total}
          accuracy={summary.accuracy}
          isBest={summary.isBest}
          previousBest={summary.previousBest}
          missedCount={summary.total - summary.found}
          onPlayAgain={resetRun}
          onReviewMap={() => setReviewingMap(true)}
        />
      )}

      <GuessModal
        open={selected !== null}
        names={suggestionNames}
        value={guess}
        isWrong={isWrong}
        onChange={setGuess}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />
    </div>
  );
}
