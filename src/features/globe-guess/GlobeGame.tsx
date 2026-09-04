import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { Link, useNavigate } from "react-router-dom";
import GuessModal from "./GuessModal";
import RoundSummary from "./RoundSummary";
import GameHud from "./GameHud";
import ExitConfirm from "./ExitConfirm";
import { useRound } from "./useRound";
import { getCountryMeta } from "../../data/countries";
import { recordKey, type Mode } from "../../data/modes";
import { isCorrectGuess } from "../../lib/answerMatch";
import { theme } from "../../lib/globeTheme";


type CountryFeature = {
  properties: { name: string };
};

const globeMaterial = new THREE.MeshPhongMaterial({
  color: theme.sphere,
  shininess: 0,
});

type Props = {
  mode: Mode;
  limitMs: number | null;
};

export default function GlobeGame({ mode, limitMs }: Props) {
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

  const round = useRound(recordKey("name", mode.id, limitMs), limitMs);
  const { begin, reset, tick, end, summary } = round;

  const resetRun = useCallback(() => {
    reset();
    setFoundNames(new Set());
    setGuesses(0);
    setSelected(null);
    setGuess("");
    setIsWrong(false);
  }, [reset]);

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

  useEffect(() => {
    if (features.length) begin();
  }, [features, begin]);

  useEffect(() => {
    if (!features.length || summary) return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [features.length, summary, tick]);

  const suggestionNames = useMemo(
    () =>
      features
        .map((f) => getCountryMeta(f.properties.name).displayName)
        .sort((a, b) => a.localeCompare(b)),
    [features]
  );

  const allFound = features.length > 0 && foundNames.size === features.length;

  const endRun = useCallback(() => {
    end({ found: foundNames.size, total: features.length, guesses });
    setSelected(null);
  }, [end, foundNames.size, features.length, guesses]);

  // The countdown reaching zero ends the round wherever the player is.
  useEffect(() => {
    if (round.timeUp) endRun();
  }, [round.timeUp, endRun]);

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
    round.setConfirmingExit(true);
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

      <GameHud
        onBack={handleBack}
        found={foundNames.size}
        total={features.length}
        ms={round.displayMs}
        countdown={round.countdown}
        modeLabel={mode.label}
        modeLevel={mode.level}
        onFinish={summary ? null : endRun}
      />

      {round.confirmingExit && (
        <ExitConfirm
          found={foundNames.size}
          total={features.length}
          onFinish={endRun}
          onKeepPlaying={() => round.setConfirmingExit(false)}
          onDiscard={() => navigate("/")}
        />
      )}

      {summary && round.reviewingMap && (
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
            onClick={() => round.setReviewingMap(false)}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            Show summary
          </button>
        </div>
      )}

      {summary && !round.reviewingMap && (
        <RoundSummary
          completed={summary.completed}
          outOfTime={round.countdown && !summary.completed}
          ms={summary.ms}
          found={summary.found}
          total={summary.total}
          accuracy={summary.accuracy}
          isBest={summary.isBest}
          previousBest={summary.previousBest}
          missedCount={summary.total - summary.found}
          onPlayAgain={resetRun}
          onReviewMap={() => round.setReviewingMap(true)}
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
