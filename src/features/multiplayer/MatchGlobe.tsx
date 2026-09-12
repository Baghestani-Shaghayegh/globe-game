import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useGlobeClick } from "../globe-guess/useGlobeClick";
import { getCountryMeta } from "../../data/countries";
import { flagUrl } from "../../data/flags";
import { cluesFor } from "../../data/clues";
import { globeMaterial, landShade, theme } from "../../lib/globeTheme";
import { useGlobeTheme } from "../globe-guess/useGlobeTheme";
import { altitudeFor, featureCentre, type Geometry } from "../../lib/geo";
import type { GameType } from "../../data/modes";

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

/** Long enough to read the result before the next question opens. */
const FLASH_MS = 900;

type Props = {
  features: CountryFeature[];
  /** The country to find, from the server. */
  target: string;
  /** Which prompt to show for it. */
  type: GameType;
  /** Changes every question, so the view resets between them. */
  questionIndex: number;
  /** Already answered this question — the globe stops taking clicks. */
  locked: boolean;
  onAnswer: (correct: boolean) => void;
};

/**
 * The globe half of a match. Deliberately thinner than the solo game: there
 * are no hints, no passing and no per-player pacing, because the whole point
 * is that both players are looking at the same question at the same second.
 */
export default function MatchGlobe({
  features,
  target,
  type,
  questionIndex,
  locked,
  onAnswer,
}: Props) {
  // Repaint when the player changes the globe palette.
  useGlobeTheme();

  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const flashTimer = useRef<number | undefined>(undefined);
  const [wrongName, setWrongName] = useState<string | null>(null);
  const [rightName, setRightName] = useState<string | null>(null);

  // A new question wipes the last one's colours.
  useEffect(() => {
    setWrongName(null);
    setRightName(null);
  }, [questionIndex]);

  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    []
  );

  const handleClick = useCallback(
    (name: string) => {
      if (locked) return;
      const correct = name === target;
      if (correct) setRightName(name);
      else {
        setWrongName(name);
        flashTimer.current = window.setTimeout(
          () => setWrongName(null),
          FLASH_MS
        );
      }
      onAnswer(correct);
    },
    [locked, target, onAnswer]
  );

  const globeClick = useGlobeClick<CountryFeature>((feature) =>
    handleClick(feature.properties.name)
  );

  // Once the question is over, show where it was — the learning moment is the
  // reason to play, and in a match it is the only feedback there is time for.
  useEffect(() => {
    if (!locked || !globeRef.current) return;
    const feature = features.find((f) => f.properties.name === target);
    if (!feature) return;
    const centre = featureCentre(feature.geometry);
    globeRef.current.pointOfView(
      { ...centre, altitude: altitudeFor(centre.span) },
      700
    );
  }, [locked, target, features]);

  const capColor = useMemo(
    () => (d: object) => {
      const { name } = (d as CountryFeature).properties;
      if (name === wrongName) return theme.missed;
      if (name === rightName) return theme.found;
      // Revealed once the question closes, however it went.
      if (locked && name === target) return theme.found;
      return landShade(name);
    },
    [wrongName, rightName, locked, target]
  );

  const meta = getCountryMeta(target);
  const clue = type === "famous" ? cluesFor(target)[0] : null;

  return (
    <div
      className="absolute inset-0"
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
          (d as CountryFeature).properties.name === target && locked
            ? 0.06
            : 0.012
        }
        polygonsTransitionDuration={200}
        onPolygonHover={(polygon) =>
          globeClick.setHovered(polygon as CountryFeature | null)
        }
      />

      <div
        className={`pointer-events-none absolute inset-x-0 top-20 z-10 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#141b23]/90 px-5 py-3 text-center backdrop-blur ${
          wrongName ? "animate-shake" : ""
        }`}
      >
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          {locked ? "It was here" : "Find"}
        </p>
        {type === "flag" && !locked ? (
          <img
            src={flagUrl(target) ?? ""}
            alt="Flag of the country to find"
            width={112}
            height={84}
            className="w-28 rounded border border-white/15 shadow-lg"
          />
        ) : clue && !locked ? (
          <p className="max-w-sm text-base font-medium text-zinc-50 sm:text-lg">
            {clue}
          </p>
        ) : (
          <p className="text-xl font-medium text-zinc-50 sm:text-2xl">
            {meta.displayName}
          </p>
        )}
      </div>
    </div>
  );
}
