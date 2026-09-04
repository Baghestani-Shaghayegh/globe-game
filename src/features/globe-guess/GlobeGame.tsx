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

  useEffect(() => {
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

        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            difficulty === "easy"
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {difficulty === "easy" ? "Easy" : "Hard"}
        </span>
      </div>

      {isComplete && (
        <div className="absolute inset-x-0 top-20 z-10 mx-auto w-fit rounded-xl border border-white/10 bg-[#141b23] px-6 py-4 text-center">
          <p className="font-medium text-zinc-100">You found all {features.length}.</p>
          <Link
            to="/"
            className="mt-1 inline-block text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100"
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
