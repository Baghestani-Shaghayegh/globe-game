import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useViewport } from "../lib/useViewport";
import { Link, useNavigate } from "react-router-dom";
import ExitConfirm from "../features/globe-guess/ExitConfirm";
import { useLeaveGuard } from "../features/globe-guess/useLeaveGuard";
import { useGlobeTheme } from "../features/globe-guess/useGlobeTheme";
import { GLOBE_SURFACE, useGlobeLook } from "../features/globe-guess/useGlobeLook";
import { getCountryMeta } from "../data/countries";
import {
  answerStroke,
  backdropColor,
  beaconTone,
  landShade,
  theme,
} from "../lib/globeTheme";
import { landMaterial } from "../lib/globeTerrain";
import { featureCentre, type Geometry, worldAltitude } from "../lib/geo";
import { dayKey, formatDay } from "../lib/daily";
import Celebrate from "../components/Celebrate";
import { playSolved, playStep, playWrong } from "../lib/sound";
import {
  connectable,
  gradeFor,
  hopsFrom,
  loadConnect,
  placedOf,
  puzzleFor,
  postConnectScore,
  routeThrough,
  saveConnect,
  scoreFor,
  shortestPath,
  touchesChain,
  type ConnectResult,
  type Grade,
} from "../lib/connect";
import { resolveName } from "../lib/answerMatch";

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

const display = (name: string) => getCountryMeta(name).displayName;

/**
 * Travle's colours, read live so a palette swap follows: green on a shortest
 * route, amber a short detour off one, red the wrong way.
 */
function gradeColor(grade: Grade): string {
  if (grade === "best") return theme.found;
  if (grade === "near") return theme.selected;
  return theme.missed;
}

const GRADE_LABEL: Record<Grade, string> = {
  best: "Shortest route",
  near: "Detour",
  far: "Off course",
};

/** The whole-world view, sized to this window. Shared by every game. */
const worldView = () => worldAltitude(window.innerWidth, window.innerHeight);

export default function Connect() {
  useGlobeTheme();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  // Handed to the globe explicitly: left to itself it measures the window
  // once and keeps that canvas forever, so a window grown from half the
  // screen to all of it leaves the globe stranded off to one side.
  const viewport = useViewport();
  // The scene does not exist until the globe says so, and the look is
  // installed into the scene.
  const [ready, setReady] = useState(false);
  const ocean = useGlobeLook(globeRef, ready);
  const framed = useRef(false);
  const day = useMemo(dayKey, []);
  const puzzle = useMemo(() => puzzleFor(day), [day]);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<string | null>(null);

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

  useEffect(() => {
    if (!puzzle) return;
    const saved = loadConnect(day);
    // Saved under the old rule, a chain could join up and still be marked
    // unsolved — one detour failed the check for good. Settled here exactly
    // as a new placement would settle it, so anyone stuck today finds it
    // finished on a reload rather than asked for a country it no longer needs.
    const route =
      saved && !saved.solved ? routeThrough(saved.from, saved.to, saved.chain) : null;
    if (saved && route) {
      const spare = saved.chain.filter((placed) => !route.includes(placed)).length;
      const settled: ConnectResult = {
        ...saved,
        placed: placedOf(saved),
        chain: route,
        solved: true,
        wrong: saved.wrong + spare,
      };
      saveConnect(settled);
      setResult(settled);
      void postConnectScore(settled);
      return;
    }
    setResult(
      saved ?? {
        day,
        number: puzzle.number,
        from: puzzle.from,
        to: puzzle.to,
        par: puzzle.par,
        chain: [],
        solved: false,
        wrong: 0,
        startedAt: Date.now(),
      }
    );
  }, [day, puzzle]);

  const centres = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    for (const feature of features) {
      const { lat, lng } = featureCentre(feature.geometry);
      map.set(feature.properties.name, { lat, lng });
    }
    return map;
  }, [features]);

  // Open on the two ends, so the shape of the problem is visible at a glance.
  useEffect(() => {
    if (framed.current || !result || !centres.size || !globeRef.current) return;
    const a = centres.get(result.from);
    const b = centres.get(result.to);
    if (!a || !b) return;
    framed.current = true;
    globeRef.current.pointOfView(
      {
        lat: (a.lat + b.lat) / 2,
        lng: (a.lng + b.lng) / 2,
        altitude: worldView(),
      },
      900
    );
  }, [result, centres]);

  /**
   * Keep the globe the same share of the window when the window changes.
   *
   * `worldAltitude` works out how far back the camera sits for the sphere to
   * fill a given viewport, and it was only ever asked once. Grow the window
   * and the globe stays framed for the old one. The view is kept, only the
   * distance is redone.
   */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !ready) return;
    const at = globe.pointOfView();
    globe.pointOfView({ lat: at.lat, lng: at.lng, altitude: worldView() }, 0);
    // The point of view is read, not tracked: this runs on a resize.
  }, [viewport.width, viewport.height, ready]);


  /** Everything put on the board, the detours included. */
  const placedSet = useMemo(
    () => new Set(result ? placedOf(result) : []),
    [result]
  );

  /** Steps from each end to everywhere, for grading what gets placed. */
  const hops = useMemo(
    () =>
      puzzle ? { from: hopsFrom(puzzle.from), to: hopsFrom(puzzle.to) } : null,
    [puzzle]
  );
  const gradeOf = useCallback(
    (name: string): Grade =>
      hops && puzzle ? gradeFor(name, hops.from, hops.to, puzzle.par) : "far",
    [hops, puzzle]
  );

  /**
   * One of the shortest ways through, shown at the end to a player who went
   * the long way round — the other half of what Jou asked for. Only offered
   * once the puzzle is over; before that it would be the answer.
   */
  const shortest = useMemo(() => {
    if (!puzzle || !result?.solved || result.chain.length <= puzzle.par)
      return null;
    const path = shortestPath(puzzle.from, puzzle.to);
    return path ? path.slice(1, -1) : null;
  }, [puzzle, result]);

  const [burst, setBurst] = useState(0);

  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!result || result.solved) return;

      const name = resolveName(typed, connectable());
      if (!name) {
        setNote("No country by that name.");
        playWrong();
        return;
      }
      if (name === result.from || name === result.to) {
        setNote(`${display(name)} is already one of the ends.`);
        playWrong();
        return;
      }
      if (placedSet.has(name)) {
        setNote(`${display(name)} is already in the chain.`);
        playWrong();
        return;
      }
      const placed = placedOf(result);
      if (!touchesChain(result.from, result.to, placed, name)) {
        // Counted, but not placed: it has to touch something to be a step.
        const next = { ...result, wrong: result.wrong + 1 };
        saveConnect(next);
        setResult(next);
        setNote(`${display(name)} doesn't border anything you've placed.`);
        setTyped("");
        playWrong();
        return;
      }

      const chain = [...placed, name];
      // Any order in, and the chain counts as soon as some of it walks the
      // whole way. Names left off the route were still guesses: they cost the
      // same as a wrong turn rather than holding the puzzle open forever.
      const route = routeThrough(result.from, result.to, chain);
      const spare = route
        ? chain.filter((step) => !route.includes(step)).length
        : 0;
      const next: ConnectResult = {
        ...result,
        placed: chain,
        chain: route ?? chain,
        solved: route !== null,
        wrong: result.wrong + spare,
      };
      saveConnect(next);
      setResult(next);
      setTyped("");
      setNote(route ? null : `${display(name)} added.`);

      if (route) {
        // Not awaited, for the same reason the mystery isn't.
        void postConnectScore(next);
        playSolved();
        setBurst((n) => n + 1);
      } else {
        // Each country placed steps the note up, so a chain being built is
        // audibly going somewhere.
        playStep(chain.length * 2);
      }
    },
    [result, typed, placedSet]
  );

  /**
   * Whether a country is on the board at all.
   *
   * The map used to be drawn in full, which gave the puzzle away: the answer
   * to "what lies between the Emirates and Slovenia" was legible by looking,
   * so the mode tested reading a map rather than knowing one. Only the two
   * ends start visible, and each country named correctly appears — the route
   * draws itself as it is recalled.
   */
  const onBoard = useCallback(
    (name: string) =>
      Boolean(
        result &&
          (name === result.from ||
            name === result.to ||
            placedSet.has(name))
      ),
    [result, placedSet]
  );

  /**
   * The colour of a country on the board, or null for one that isn't.
   *
   * The ends are pale rather than amber: amber is a detour now. Placed
   * countries take Travle's colours, so a player who went the long way can
   * see which of their picks cost them.
   */
  const boardColor = useCallback(
    (name: string): string | null => {
      if (!result) return null;
      if (name === result.from || name === result.to) return beaconTone();
      if (placedSet.has(name)) return gradeColor(gradeOf(name));
      return null;
    },
    [result, placedSet, gradeOf]
  );

  const solved = result?.solved ?? false;

  const capColor = useMemo(
    () => (d: object) => {
      const { name } = (d as CountryFeature).properties;
      const color = boardColor(name);
      if (color) return landMaterial(color, "answer");
      // Once it's over, the map comes back: Jou found the route hard to make
      // out at the end, drawn on a featureless mass with no borders round it.
      if (solved) return landMaterial(landShade(name));
      // Everything else: land you can see the shape of and nothing more. Its
      // border is hidden too, so a continent reads as one mass rather than a
      // set of countries to count along.
      return landMaterial(backdropColor());
    },
    [boardColor, solved]
  );

  const strokeColor = useCallback(
    (d: object) => {
      const { name } = (d as CountryFeature).properties;
      const color = boardColor(name);
      // A border in the country's own colour, darkened until it reads — the
      // one pale stroke disappears on a filled-in country.
      if (color) return answerStroke(color);
      // No line at all off the board while it's in play, rather than one
      // painted the same as the land under it: the fill is lit and the stroke
      // is not, so on the sunlit side the outlines came back as darker lines
      // — handing over the borders this puzzle exists to hide. `null` means
      // three-globe builds no stroke object.
      return solved ? theme.stroke : null;
    },
    [boardColor, solved]
  );

  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const goingSomewhere = useRef(false);
  const inProgress = !!result && !result.solved && result.chain.length > 0;
  useLeaveGuard(inProgress && !goingSomewhere.current, () => setLeaving(true));

  const leave = () => {
    goingSomewhere.current = true;
    navigate("/");
  };

  const handleBack = () => {
    if (!inProgress) {
      leave();
      return;
    }
    setLeaving(true);
  };

  if (loadError || !puzzle) {
    return (
      <div className="night flex min-h-screen flex-col items-center justify-center gap-3 bg-page px-6 text-center">
        <p className="text-zinc-100">
          {loadError ? "Couldn't load the map data." : "No puzzle for today."}
        </p>
        <Link
          to="/"
          className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100"
        >
          Back to modes
        </Link>
      </div>
    );
  }


  /**
   * Leaving mid-game asks first, by the link or by the browser's Back — which
   * on a trackpad is a two-finger swipe, easy to trigger while dragging a
   * globe around.
   *
   * One attempt a day, and a half-built chain is work. Asked only once a
   * link is in it — opening it and turning straight round has cost nothing.
   */
  return (
    <div className="night relative h-screen w-screen overflow-hidden bg-page">
      <Globe
        ref={globeRef}
        width={viewport.width}
        height={viewport.height}
        rendererConfig={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
        backgroundColor={theme.page}
        globeMaterial={ocean}
        onGlobeReady={() => setReady(true)}
        {...GLOBE_SURFACE}
        polygonsData={features}
        polygonCapMaterial={capColor}
        polygonStrokeColor={strokeColor}
        polygonAltitude={(d) =>
          onBoard((d as CountryFeature).properties.name) ? 0.05 : 0.012
        }
        polygonsTransitionDuration={250}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <button
          onClick={handleBack}
          className="pointer-events-auto rounded-lg border border-white/10 bg-raised/90 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur transition-colors hover:text-zinc-100"
        >
          ← Modes
        </button>
        <div className="rounded-lg border border-white/10 bg-raised/90 px-3 py-1.5 text-right text-sm backdrop-blur">
          <p className="font-medium text-zinc-100">Connect</p>
          <p className="text-xs tabular-nums text-zinc-500">
            par {puzzle.par} · {result ? placedOf(result).length : 0} placed
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] flex-col items-center gap-2 rounded-xl border border-white/10 bg-raised/90 px-5 py-3 text-center backdrop-blur">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Walk from
        </p>
        <p className="text-lg font-medium text-zinc-50 sm:text-xl">
          {display(puzzle.from)}{" "}
          <span className="text-zinc-600">→</span> {display(puzzle.to)}
        </p>

        {result?.solved ? (
          <>
            <p className="text-sm text-emerald-300">
              Connected in {result.chain.length}{" "}
              {result.chain.length === 1 ? "step" : "steps"} · par {result.par} ·{" "}
              {scoreFor(result).toLocaleString()} points
            </p>
            <p className="text-sm text-zinc-400">
              {[puzzle.from, ...result.chain, puzzle.to].map(display).join(" → ")}
            </p>
            {shortest && (
              <p className="max-w-sm text-xs text-zinc-500">
                Shortest:{" "}
                {[puzzle.from, ...shortest, puzzle.to].map(display).join(" → ")}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="max-w-xs text-sm text-zinc-400">
              Name countries that link them up.
            </p>
            <form onSubmit={submit} className="pointer-events-auto flex gap-2 pt-1">
              <label htmlFor="link" className="sr-only">
                A country in the chain
              </label>
              <input
                id="link"
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Country name"
                autoComplete="off"
                className="w-48 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
              />
              <button
                type="submit"
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
              >
                Add
              </button>
            </form>
            {note && <p className="text-xs text-amber-300/80">{note}</p>}
          </>
        )}

        {/* The key, once there is something on the board to read it by. */}
        {result && placedOf(result).length > 0 && (
          <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            {(["best", "near", "far"] as const).map((grade) => (
              <span key={grade} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: gradeColor(grade) }}
                />
                {GRADE_LABEL[grade]}
              </span>
            ))}
          </p>
        )}
      </div>

      {result?.solved && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 z-10 text-center text-sm text-zinc-500">
          {formatDay(day)} · a new pair at midnight UTC
        </p>
      )}

      {/* Only on the move that joins the chain, not on every visit after. */}
      <Celebrate burst={burst} count={90} />
      {leaving && (
        <ExitConfirm onFinish={leave} onKeepPlaying={() => setLeaving(false)} />
      )}

    </div>
  );
}
