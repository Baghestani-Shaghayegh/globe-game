import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { getCountryMeta } from "../../data/countries";
import type { Outcome } from "../../lib/daily";
import { answerStroke, backdropColor, theme } from "../../lib/globeTheme";
import { landMaterial } from "../../lib/globeTerrain";
import {
  altitudeFor,
  featureCentre,
  type Geometry,
  labelPoint,
  worldAltitude,
} from "../../lib/geo";
import { useGlobeTheme } from "./useGlobeTheme";
import { GLOBE_SURFACE, useGlobeLook } from "./useGlobeLook";

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

type Props = {
  /** The day's countries, in the order the outcomes are in. */
  countries: string[];
  outcomes: Outcome[];
};

/** The colour each outcome is painted, read live so a palette swap follows. */
function outcomeColor(outcome: Outcome): string {
  if (outcome === "first") return theme.found;
  // Amber, as the card's square is: right in the end, but not first time.
  if (outcome === "retried") return theme.selected;
  return theme.missed;
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  first: "First try",
  retried: "Retried",
  missed: "Missed",
};

type Tag = { lat: number; lng: number; text: string };

function tagElement(d: object): HTMLElement {
  const el = document.createElement("div");
  el.textContent = (d as Tag).text;
  el.style.cssText = [
    "color: #f4f4f5",
    "font: 500 13px ui-sans-serif, system-ui, sans-serif",
    "white-space: nowrap",
    "pointer-events: none",
    "padding: 2px 8px",
    "border-radius: 9999px",
    "background: rgb(20 27 35 / 0.9)",
    "border: 1px solid rgb(255 255 255 / 0.12)",
    "transform: translateY(-18px)",
  ].join(";");
  return el;
}
const tagLat = (d: object) => (d as Tag).lat;
const tagLng = (d: object) => (d as Tag).lng;

/**
 * The day's round, on the globe, once it is over.
 *
 * The result used to be points and a row of squares. A player who had just
 * spent five minutes on a map was shown no map: not which countries they got,
 * not where the ones they missed were. Here are the ten, each in the colour of
 * how it went, with the list beside it to go to any one of them — the missed
 * ones are the reason to look.
 */
export default function DailyResultGlobe({ countries, outcomes }: Props) {
  const themeId = useGlobeTheme();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const ocean = useGlobeLook(globeRef, ready);

  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () =>
      setSize((old) =>
        old.width === el.clientWidth && old.height === el.clientHeight
          ? old
          : { width: el.clientWidth, height: el.clientHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [world, setWorld] = useState<CountryFeature[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { features: CountryFeature[] }) => {
        if (!cancelled) setWorld(data.features);
      })
      .catch(() => {
        /* no map, no globe: the card above still says how it went */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const outcomeOf = useMemo(
    () => new Map(countries.map((name, at) => [name, outcomes[at]])),
    [countries, outcomes],
  );

  const byName = useMemo(
    () => new Map(world.map((f) => [f.properties.name, f])),
    [world],
  );

  /** The one being looked at, from the list or the pointer. */
  const [focus, setFocus] = useState<string | null>(null);

  // A slow turn until the player takes hold of it, so the ten come round on
  // their own. Scrolling the page must not zoom the globe instead.
  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!ready || !controls) return;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    const stop = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [ready]);

  const framed = useRef(false);
  useEffect(() => {
    if (!ready || !size.width || !globeRef.current) return;
    const altitude = worldAltitude(size.width, size.height);
    const at = framed.current
      ? globeRef.current.pointOfView()
      : { lat: 15, lng: 10 };
    globeRef.current.pointOfView({ lat: at.lat, lng: at.lng, altitude }, 0);
    framed.current = true;
  }, [ready, size]);

  const goTo = (name: string) => {
    const feature = byName.get(name);
    const globe = globeRef.current;
    if (!feature || !globe) return;
    globe.controls().autoRotate = false;
    setFocus(name);
    const centre = featureCentre(feature.geometry);
    globe.pointOfView(
      {
        lat: centre.lat,
        lng: centre.lng,
        altitude: Math.max(0.7, altitudeFor(centre.span)),
      },
      800,
    );
  };

  const fillFor = useCallback(
    (name: string): { color: string; answer: boolean } => {
      const outcome = outcomeOf.get(name);
      return outcome
        ? { color: outcomeColor(outcome), answer: true }
        : { color: backdropColor(), answer: false };
    },
    // themeId: the palette is a live object — see GlobeGame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outcomeOf, themeId],
  );

  const capMaterial = useCallback(
    (d: object) => {
      const fill = fillFor((d as CountryFeature).properties.name);
      return landMaterial(fill.color, fill.answer ? "answer" : "land");
    },
    [fillFor],
  );

  const strokeColor = useCallback(
    (d: object) => {
      const fill = fillFor((d as CountryFeature).properties.name);
      return fill.answer ? answerStroke(fill.color) : theme.stroke;
    },
    [fillFor],
  );

  const altitude = useCallback(
    (d: object) =>
      outcomeOf.has((d as CountryFeature).properties.name) ? 0.035 : 0.008,
    [outcomeOf],
  );

  const tags = useMemo<Tag[]>(() => {
    const feature = focus ? byName.get(focus) : undefined;
    if (!focus || !feature) return [];
    return [
      {
        ...labelPoint(feature.geometry),
        text: getCountryMeta(focus).displayName,
      },
    ];
  }, [focus, byName]);

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div
        ref={box}
        className="relative h-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#07111c] sm:h-[460px]"
      >
        {size.width > 0 && (
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            rendererConfig={{
              antialias: true,
              alpha: true,
              logarithmicDepthBuffer: true,
            }}
            backgroundColor={theme.page}
            globeMaterial={ocean}
            onGlobeReady={() => setReady(true)}
            {...GLOBE_SURFACE}
            polygonsData={world}
            polygonCapMaterial={capMaterial}
            polygonStrokeColor={strokeColor}
            polygonAltitude={altitude}
            polygonsTransitionDuration={0}
            htmlElementsData={tags}
            htmlLat={tagLat}
            htmlLng={tagLng}
            htmlAltitude={0.04}
            htmlElement={tagElement}
            htmlTransitionDuration={0}
            onPolygonHover={(polygon) => {
              const name = (polygon as CountryFeature | null)?.properties.name;
              if (name && outcomeOf.has(name)) setFocus(name);
            }}
          />
        )}
      </div>

      <div>
        <ol className="grid grid-cols-2 gap-1 lg:grid-cols-1">
          {countries.map((name, at) => (
            <li key={name}>
              <button
                onClick={() => goTo(name)}
                aria-pressed={focus === name}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  focus === name
                    ? "bg-white/10 text-zinc-50"
                    : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: outcomeColor(outcomes[at]) }}
                />
                <span className="truncate">
                  {getCountryMeta(name).displayName}
                </span>
                <span className="sr-only">, {OUTCOME_LABEL[outcomes[at]]}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-3 text-xs text-zinc-500">
          {(["first", "retried", "missed"] as const).map((outcome) => (
            <span key={outcome} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: outcomeColor(outcome) }}
              />
              {OUTCOME_LABEL[outcome]}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
