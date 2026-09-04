import { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { Link } from "react-router-dom";
import GuessModal from "./GuessModal";
import { getCountryMeta } from "../../data/countries";
import type { Difficulty } from "../../data/countries";
import { isCorrectGuess } from "../../lib/answerMatch";
import { theme } from "../../lib/globeTheme";
import { addRun, bestRun, formatDuration } from "../../lib/records";
import type { Run } from "../../lib/records";

type CountryFeature = {
  properties: { name: string };
};

const globeMaterial = new THREE.MeshPhongMaterial({
  color: theme.sphere,
  shininess: 0,
});

type Props = {
  difficulty: Difficulty;
};

export default function GlobeGame({ difficulty }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrongTimer = useRef<number | undefined>(undefined);
  const framed = useRef(false);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [guess, setGuess] = useState("");
  const [isWrong, setIsWrong] = useState(false);
  const [foundNames, setFoundNames] = useState<Set<string>>(new Set());

  // Stopwatch. It starts when the map is playable, not when the page mounts,
  // so a slow globe download doesn't land on the player's time.
  const startedAt = useRef<number | null>(null);
  const recorded = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [previousBest, setPreviousBest] = useState<Run | null>(null);

  useEffect(() => {
    // Switching modes restarts the round, and with it the clock.
    setFoundNames(new Set());
    setElapsedMs(0);
    setFinishedMs(null);
    setPreviousBest(null);
    startedAt.current = null;
    recorded.current = false;

    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load map data (${res.status})`);
        return res.json();
      })
      .then((data: { features: CountryFeature[] }) => {
        if (cancelled) return;
        const playable =
          difficulty === "hard"
            ? data.features
            : data.features.filter(
                (f) => getCountryMeta(f.properties.name).tier === "country"
              );
        setFeatures(playable);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [difficulty]);

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
    if (!features.length || finishedMs !== null) return;
    const id = window.setInterval(() => {
      if (startedAt.current !== null) {
        setElapsedMs(performance.now() - startedAt.current);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [features.length, finishedMs]);

  const suggestionNames = useMemo(
    () =>
      features
        .map((f) => getCountryMeta(f.properties.name).displayName)
        .sort((a, b) => a.localeCompare(b)),
    [features]
  );

  const isComplete = features.length > 0 && foundNames.size === features.length;
  const progress = features.length
    ? Math.round((foundNames.size / features.length) * 100)
    : 0;

  // Stamp the finish time the moment the last country lands, and file the run.
  useEffect(() => {
    if (!isComplete || recorded.current || startedAt.current === null) return;
    recorded.current = true;
    const ms = performance.now() - startedAt.current;
    setPreviousBest(bestRun(difficulty));
    addRun(difficulty, ms);
    setFinishedMs(ms);
  }, [isComplete, difficulty]);

  const closeModal = () => {
    setSelected(null);
    setGuess("");
    setIsWrong(false);
  };

  const handleSubmit = (value: string) => {
    if (!selected || !value.trim()) return;

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
          if (selected && selected.properties.name === name)
            return theme.selected;
          return theme.unfound;
        }}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => theme.stroke}
        polygonAltitude={() => 0.012}
        polygonsTransitionDuration={0}
        onPolygonClick={(polygon) => {
          const feature = polygon as CountryFeature;
          if (!foundNames.has(feature.properties.name)) {
            setSelected(feature);
          }
        }}
      />

      {/* HUD */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm backdrop-blur">
        <Link to="/" className="text-zinc-400 transition-colors hover:text-zinc-100">
          Modes
        </Link>

        <span className="h-4 w-px bg-white/10" aria-hidden="true" />

        <span className="tabular-nums text-zinc-100">
          <b className="font-medium">{foundNames.size}</b>
          <span className="text-zinc-500"> / {features.length}</span>
        </span>

        <span className="h-1 w-20 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </span>

        <span className="h-4 w-px bg-white/10" aria-hidden="true" />

        <span
          className="tabular-nums text-zinc-300"
          aria-label="Time elapsed"
          role="timer"
        >
          {formatDuration(finishedMs ?? elapsedMs)}
        </span>

        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
          <span aria-hidden="true" className="flex items-end gap-[3px]">
            {["h-1.5", "h-2.5", "h-3.5"].map((height, i) => (
              <span
                key={height}
                className={`w-[3px] rounded-full ${height} ${
                  i < (difficulty === "easy" ? 1 : 3)
                    ? "bg-zinc-300"
                    : "bg-white/15"
                }`}
              />
            ))}
          </span>
          {difficulty === "easy" ? "Easy" : "Hard"}
        </span>
      </div>

      {isComplete && finishedMs !== null && (
        <div className="absolute inset-x-0 top-20 z-10 mx-auto w-fit rounded-xl border border-white/10 bg-[#141b23] px-8 py-5 text-center">
          <p className="text-sm text-zinc-400">
            You found all {features.length}
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums text-zinc-50">
            {formatDuration(finishedMs)}
          </p>

          {previousBest === null || finishedMs < previousBest.ms ? (
            <p className="mt-2 text-xs uppercase tracking-wider text-emerald-300">
              New personal best
            </p>
          ) : (
            <p className="mt-2 text-xs tabular-nums text-zinc-500">
              Your best {formatDuration(previousBest.ms)}
            </p>
          )}

          <Link
            to="/"
            className="mt-3 inline-block text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100"
          >
            Play another mode
          </Link>
        </div>
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
