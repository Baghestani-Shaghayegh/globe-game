import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { Link } from "react-router-dom";
import { useGlobeClick } from "../features/globe-guess/useGlobeClick";
import { useGlobeTheme } from "../features/globe-guess/useGlobeTheme";
import { getCountryMeta } from "../data/countries";
import { globeMaterial, theme } from "../lib/globeTheme";
import { featureCentre, type Geometry } from "../lib/geo";
import { dayKey, formatDay } from "../lib/daily";
import {
  arrowFor,
  closeness,
  distanceKm,
  heatColor,
  heatSquare,
  loadMystery,
  mysteryFor,
  mysteryNumber,
  saveMystery,
  scoreFor,
  type MysteryResult,
  type Point,
} from "../lib/mystery";

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

export default function Mystery() {
  useGlobeTheme();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const day = useMemo(dayKey, []);
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<MysteryResult | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Only sovereign countries, so the answer is never an overseas territory
  // nobody would think to click.
  const pool = useMemo(
    () =>
      features
        .map((f) => f.properties.name)
        .filter((name) => getCountryMeta(name).tier === "country")
        .sort(),
    [features]
  );

  const answer = useMemo(() => mysteryFor(day, pool), [day, pool]);

  const centres = useMemo(() => {
    const map = new Map<string, Point>();
    for (const feature of features) {
      const { lat, lng } = featureCentre(feature.geometry);
      map.set(feature.properties.name, { lat, lng });
    }
    return map;
  }, [features]);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { features: CountryFeature[] }) => {
        if (!cancelled) setFeatures(data.features);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pick the day's round back up, or start one.
  useEffect(() => {
    if (!answer) return;
    const saved = loadMystery(day);
    setResult(
      saved ?? {
        day,
        number: mysteryNumber(day),
        answer,
        guesses: [],
        solved: false,
      }
    );
  }, [day, answer]);

  const guessed = useMemo(
    () => new Map((result?.guesses ?? []).map((g) => [g.name, g.km])),
    [result]
  );

  const handleClick = useCallback(
    (name: string) => {
      if (!result || result.solved || !answer) return;
      if (guessed.has(name)) {
        setFlash(`${getCountryMeta(name).displayName} — already guessed`);
        return;
      }
      const from = centres.get(name);
      const to = centres.get(answer);
      if (!from || !to) return;

      const km = Math.round(distanceKm(from, to));
      const next: MysteryResult = {
        ...result,
        guesses: [{ name, km }, ...result.guesses],
        solved: name === answer,
      };
      saveMystery(next);
      setResult(next);
      setFlash(null);

      if (name === answer) {
        const centre = centres.get(answer);
        if (centre) {
          globeRef.current?.pointOfView({ ...centre, altitude: 1.6 }, 900);
        }
      }
    },
    [result, answer, guessed, centres]
  );

  const globeClick = useGlobeClick<CountryFeature>((feature) =>
    handleClick(feature.properties.name)
  );

  const capColor = useMemo(
    () => (d: object) => {
      const { name } = (d as CountryFeature).properties;
      if (result?.solved && name === result.answer) return theme.found;
      const km = guessed.get(name);
      return km === undefined ? theme.unfound : heatColor(km);
    },
    [guessed, result]
  );

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

  const guesses = result?.guesses ?? [];
  const nearest = guesses.length
    ? guesses.reduce((best, g) => (g.km < best.km ? g : best))
    : null;
  const answerCentre = answer ? centres.get(answer) : undefined;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[#07111c]"
      onPointerDown={globeClick.onPointerDown}
      onPointerUp={globeClick.onPointerUp}
    >
      <Globe
        ref={globeRef}
        rendererConfig={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
        backgroundColor={theme.page}
        globeMaterial={globeMaterial}
        atmosphereColor={theme.atmosphere}
        atmosphereAltitude={0.14}
        polygonsData={features}
        polygonCapColor={capColor}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => theme.stroke}
        polygonAltitude={(d) =>
          guessed.has((d as CountryFeature).properties.name) ? 0.03 : 0.012
        }
        polygonsTransitionDuration={250}
        onPolygonHover={(polygon) =>
          globeClick.setHovered(polygon as CountryFeature | null)
        }
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <Link
          to="/"
          className="pointer-events-auto rounded-lg border border-white/10 bg-[#141b23]/90 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>
        <div className="rounded-lg border border-white/10 bg-[#141b23]/90 px-3 py-1.5 text-right text-sm backdrop-blur">
          <p className="font-medium text-zinc-100">
            Mystery #{result?.number ?? "…"}
          </p>
          <p className="text-xs tabular-nums text-zinc-500">
            {guesses.length} {guesses.length === 1 ? "guess" : "guesses"}
          </p>
        </div>
      </div>

      {/* The prompt sits over the globe but never eats a click meant for it. */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-[#141b23]/90 px-5 py-3 text-center backdrop-blur">
        {result?.solved ? (
          <>
            <p className="text-xs uppercase tracking-wider text-emerald-400/70">
              Found it
            </p>
            <p className="text-xl font-medium text-zinc-50 sm:text-2xl">
              {getCountryMeta(result.answer).displayName}
            </p>
            <p className="text-sm text-zinc-400">
              {guesses.length} {guesses.length === 1 ? "guess" : "guesses"} ·{" "}
              {scoreFor(result).toLocaleString()} points
            </p>
            <p className="mt-1 text-lg leading-none tracking-widest">
              {[...guesses]
                .reverse()
                .map((g) => heatSquare(g.km))
                .join("")}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Find the mystery country
            </p>
            <p className="max-w-xs text-sm text-zinc-300">
              Click anywhere. The closer you are, the warmer it goes.
            </p>
            {flash && <p className="text-xs text-amber-300/80">{flash}</p>}
          </>
        )}
      </div>

      {/* Guesses, newest first, so the last thing you tried is at the top. */}
      {guesses.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-72 max-w-[calc(100vw-2rem)]">
          <ul className="max-h-[45vh] overflow-y-auto rounded-xl border border-white/10 bg-[#141b23]/90 backdrop-blur">
            {guesses.map((guess) => {
              const from = centres.get(guess.name);
              return (
                <li
                  key={guess.name}
                  className="flex items-center gap-2.5 border-b border-white/[0.05] px-3 py-2 text-sm last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: heatColor(guess.km) }}
                  />
                  <span className="min-w-0 truncate text-zinc-100">
                    {getCountryMeta(guess.name).displayName}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-2 tabular-nums text-xs text-zinc-400">
                    {guess.km > 0 && (
                      <>
                        <span>{guess.km.toLocaleString()} km</span>
                        {from && answerCentre && (
                          <span aria-label="direction to the answer">
                            {arrowFor(from, answerCentre)}
                          </span>
                        )}
                      </>
                    )}
                    <span className="w-9 text-right text-zinc-500">
                      {closeness(guess.km)}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {nearest && !result?.solved && (
            <p className="mt-2 px-1 text-xs text-zinc-500">
              Warmest so far: {getCountryMeta(nearest.name).displayName},{" "}
              {closeness(nearest.km)}%
            </p>
          )}
        </div>
      )}

      {result?.solved && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 z-10 text-center text-sm text-zinc-500">
          {formatDay(day)} · a new mystery at midnight UTC
        </p>
      )}
    </div>
  );
}
