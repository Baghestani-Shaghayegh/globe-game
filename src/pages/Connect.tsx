import ShareResult from "../components/ShareResult";
import SignInNudge from "../components/SignInNudge";
import { connectGrid } from "../lib/shareGrid";
import RecordSwitch from "../features/replay/RecordSwitch";
import ReplayActions from "../features/replay/ReplayActions";
import { useReplayCamera } from "../features/globe-guess/useReplayCamera";
import { keepReplay, recordingOn, ReplayRecorder, todaysReplay, type Replay } from "../lib/replay";
import { END_HOLD_MS } from "../lib/replayFrame";
import { CARD_FOUND, CARD_MISSED } from "../features/globe-guess/RoundShare";
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
import { dayKey, elapsedMs, formatDay } from "../lib/daily";
import { formatDuration } from "../lib/records";
import ConfirmDialog from "../features/globe-guess/ConfirmDialog";
import Celebrate from "../components/Celebrate";
import { playSolved, playStep, playWrong } from "../lib/sound";
import {
  CONNECT_BUCKET,
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
import { nearestNames, resolveName } from "../lib/answerMatch";
import { useSuggestions } from "../features/globe-guess/useSuggestions";
import { siteHost } from "../lib/site";
import ClearButton from "../components/ClearButton";

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
  /**
   * Whether the note is a miss: said in red, with a shake of the panel, the
   * way a wrong answer lands in the other games. A pick that didn't join the
   * chain used to be announced as "added" in the same tone as one that did.
   */
  const [miss, setMiss] = useState(false);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(shakeTimer.current), []);
  const flagMiss = useCallback((text: string) => {
    setNote(text);
    setMiss(true);
    setShaking(true);
    window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShaking(false), 400);
    playWrong();
  }, []);

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
        ms: elapsedMs(saved.startedAt),
      };
      saveConnect(settled);
      setResult(settled);
      void postConnectScore(settled);
      return;
    }
    // Otherwise only a solved puzzle comes back. One left part-way starts
    // again from nothing — Sara's rule for all three dailies: leaving without
    // finishing doesn't use up the day, and doesn't carry over either.
    recorder.current = saved?.solved ? null : new ReplayRecorder();
    if (saved?.solved) {
      const kept = todaysReplay(day, (game) => game.type === "connect");
      if (kept) setRecorded({ replay: kept });
    }
    setResult(
      (saved?.solved ? saved : null) ?? {
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

  // The walk as it's played, to watch back and post: each country put down
  // and how good a step it was, and where the globe looked.
  const recorder = useRef<ReplayRecorder | null>(null);
  const [recorded, setRecorded] = useState<{
    replay: Replay;
    postedId?: () => Promise<number | null>;
  } | null>(null);
  const look = useCallback(
    (lat: number, lng: number, altitude: number, force?: boolean) =>
      recorder.current?.look(lat, lng, altitude, force),
    []
  );
  const [filming, setFilming] = useState(false);
  const playing = !!result && !result.solved;
  useEffect(() => {
    if (playing) setFilming(true);
  }, [playing]);
  useReplayCamera(globeRef, ready && filming, look);

  /** Closes the recording a beat after the chain joins up. */
  const finishRecording = useCallback(
    (next: ConnectResult, posted: Promise<number | null>) => {
      const rec = recorder.current;
      if (!rec) return;
      const ms = next.ms ?? elapsedMs(next.startedAt);
      // Still taking the camera through the hold, so the turn to the end is in it.
      window.setTimeout(() => {
        if (recorder.current === rec) recorder.current = null;
        setFilming(false);
        if (!recordingOn()) return;
        const replay = rec.finish(
          {
            type: "connect",
            mode: "daily",
            label: `Connect #${next.number}`,
            bucket: CONNECT_BUCKET,
            from: next.from,
            to: next.to,
            par: next.par,
          },
          {
            ms,
            points: scoreFor(next),
            found: next.chain.length,
            total: next.par,
          }
        );
        keepReplay(replay);
        setRecorded({ replay, postedId: () => posted });
      }, END_HOLD_MS);
    },
    []
  );

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

  /**
   * The clock, counting up from when this attempt began. Shown, and filed with
   * the score as before; the points themselves still come from the route.
   */
  const [now, setNow] = useState(() => Date.now());
  const running = !!result && !result.solved;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  const shownMs = result
    ? result.solved
      ? (result.ms ?? elapsedMs(result.startedAt))
      : Math.max(0, now - (result.startedAt ?? now))
    : 0;

  /**
   * Starting over: an empty chain and a fresh clock. Under the rule that
   * leaving part-way starts the puzzle again, this is the same thing without
   * the trip to the menu — so it gives nothing away that leaving doesn't.
   */
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const startOver = () => {
    if (!result || result.solved) return;
    const fresh: ConnectResult = {
      ...result,
      chain: [],
      placed: [],
      solved: false,
      wrong: 0,
      startedAt: Date.now(),
      ms: undefined,
    };
    saveConnect(fresh);
    setResult(fresh);
    // A new attempt, a new recording: the cleared chain isn't part of it.
    recorder.current = new ReplayRecorder();
    setNow(Date.now());
    setTyped("");
    setNote(null);
    setDidYouMean([]);
    setConfirmingRestart(false);
  };

  /**
   * The list under the box, as in the mystery country. Without it the
   * spelling of "Democratic Republic of the Congo" was part of the puzzle,
   * and the box had no way to say what it would take.
   */
  const pool = useMemo(() => connectable(), []);
  const suggestable = useMemo(() => pool.map(getCountryMeta), [pool]);
  const { matches, highlighted, setHighlighted, onKeyDown } = useSuggestions(
    suggestable,
    typed,
    5
  );
  /** What a name that matched nothing was probably reaching for. */
  const [didYouMean, setDidYouMean] = useState<string[]>([]);

  const tryAdd = useCallback(
    (text: string) => {
      if (!result || result.solved) return;
      // An empty box is no guess, not a wrong one.
      if (!text.trim()) return;
      setDidYouMean([]);
      setHighlighted(-1);

      const name = resolveName(text, pool);
      if (!name) {
        flagMiss(`No country called "${text.trim()}".`);
        setDidYouMean(nearestNames(text, pool));
        return;
      }
      if (name === result.from || name === result.to) {
        flagMiss(`${display(name)} is already one of the ends.`);
        return;
      }
      if (placedSet.has(name)) {
        flagMiss(`${display(name)} is already in the chain.`);
        return;
      }
      const placed = placedOf(result);
      // Any country goes on the board, touching the chain or not, and takes
      // its colour: the way Travle plays. It used to be refused unless it
      // bordered something already placed, which left "Off course" in the key
      // with almost nothing ever painted in it — the far-off guesses it was
      // for were the very ones turned away. A pick that never joins the route
      // still costs a wrong turn when the chain is done, as a detour does.
      const connected = touchesChain(result.from, result.to, placed, name);
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
        ...(route ? { ms: elapsedMs(result.startedAt) } : {}),
      };
      saveConnect(next);
      setResult(next);
      setTyped("");
      recorder.current?.mark(["c", name, gradeOf(name)]);
      // Said the way it is painted. Only a pick well off the way is a miss:
      // red, with the shake. "Brazil isn't connected yet" suggested it might
      // be, on a walk from China to Qatar — it never could.
      const offCourse = gradeOf(name) === "far";
      if (route) {
        setNote(null);
        setMiss(false);
      } else if (offCourse) {
        flagMiss(`${display(name)} is off course.`);
      } else if (connected) {
        setNote(`${display(name)} added.`);
        setMiss(false);
      } else {
        // On the way, just not joined up to anything yet — this one can be.
        setNote(`${display(name)} added, not joined to your chain yet.`);
        setMiss(false);
      }
      // A pick that doesn't join up is usually somewhere else entirely —
      // Brazil, on a walk from China to Qatar — and round the back of the
      // globe its colour tells nobody anything. Turn to it.
      if (!connected && !route) {
        const at = centres.get(name);
        if (at) {
          globeRef.current?.pointOfView(
            { ...at, altitude: globeRef.current.pointOfView().altitude },
            900
          );
        }
      }

      if (route) {
        // Not awaited, for the same reason the mystery isn't.
        finishRecording(next, postConnectScore(next));
        playSolved();
        setBurst((n) => n + 1);
      } else if (!offCourse) {
        // Each country placed steps the note up, so a chain being built is
        // audibly going somewhere. A miss has already made its own sound.
        playStep(chain.length * 2);
      }
    },
    [result, placedSet, pool, setHighlighted, centres, flagMiss, gradeOf, finishRecording]
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    tryAdd(typed);
  };

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page px-6 text-center">
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
    <div className="relative h-screen w-screen overflow-hidden bg-page">
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
        {playing && <RecordSwitch />}
      </div>

      {/* Out of the globe's way, as in the other games: under the back button on a
          wide screen, the bottom edge on a phone. The par
          and the count live in here too — they had a box of their own in the
          same corner, which said "Connect" on a page that already says it. */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto flex w-[min(22rem,calc(100vw-1.5rem))] flex-col items-center gap-2 rounded-xl border border-white/10 bg-raised/90 px-5 py-3 text-center backdrop-blur lg:inset-x-auto lg:bottom-auto lg:left-4 lg:top-16 lg:mx-0 ${shaking ? "animate-shake" : ""}`}>
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Walk from
        </p>
        <p className="text-lg font-medium text-zinc-50 sm:text-xl">
          {display(puzzle.from)}{" "}
          <span className="text-zinc-600">→</span> {display(puzzle.to)}
        </p>
        {!result?.solved && (
          <p className="text-xs tabular-nums text-zinc-500">
            Par {puzzle.par} · {result ? placedOf(result).length : 0} added ·{" "}
            {formatDuration(shownMs)}
          </p>
        )}

        {result?.solved ? (
          <>
            <p className="text-sm text-emerald-300">
              Connected in {result.chain.length}{" "}
              {result.chain.length === 1 ? "step" : "steps"} ·{" "}
              {formatDuration(shownMs)} · par {result.par} ·{" "}
              {scoreFor(result).toLocaleString()} points
            </p>
            <p className="text-sm text-zinc-400">
              {[puzzle.from, ...result.chain, puzzle.to].map(display).join(" → ")}
            </p>
            {shortest && (
              <p className="text-xs text-zinc-500">
                Shortest:{" "}
                {[puzzle.from, ...shortest, puzzle.to].map(display).join(" → ")}
              </p>
            )}
            <p className="text-xs text-zinc-600">
              {formatDay(day)} · a new pair at midnight UTC
            </p>
            {result.day === day && (
              <div className="pointer-events-auto mt-1 w-full border-t border-white/[0.07] pt-3">
                <ShareResult
                  replay={recorded?.replay}
                  text={`I linked ${display(puzzle.from)} to ${display(puzzle.to)} in ${result.chain.length} on today's GuessGlobe Connect.`}
                  filename={`guessglobe-connect-${result.day}.png`}
                  path={`/connect?d=${result.number}`}
                  grid={connectGrid(
                    result.chain.length,
                    Math.max(0, placedOf(result).length - result.chain.length)
                  )}
                  card={(features) => {
                    const wrongTurns = Math.max(0, placedOf(result).length - result.chain.length);
                    return {
                      eyebrow: `Connect · ${formatDay(result.day)}`,
                      title: `${display(puzzle.from)} → ${display(puzzle.to)}`,
                      subtitle: `${result.chain.length} ${result.chain.length === 1 ? "step" : "steps"} · par ${result.par} · ${formatDuration(shownMs)}`,
                      // A square per step and one per wrong turn, but not
                      // the route itself: the card goes to people who
                      // haven't played. The two ends are public already.
                      tiles: [
                        ...result.chain.map(() => CARD_FOUND),
                        ...Array.from({ length: wrongTurns }, () => CARD_MISSED),
                      ],
                      note: wrongTurns
                        ? `${wrongTurns} wrong ${wrongTurns === 1 ? "turn" : "turns"}`
                        : undefined,
                      globe: features
                        ? { features, colors: { [puzzle.from]: "#a78bfa", [puzzle.to]: "#a78bfa" } }
                        : undefined,
                      site: siteHost(),
                    };
                  }}
                />
              </div>
            )}
            <SignInNudge />
            {recorded && (
              <div className="pointer-events-auto mt-1 w-full border-t border-white/[0.07] pt-3">
                <ReplayActions replay={recorded.replay} postedId={recorded.postedId} />
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-400">
              Name countries that link them up.
            </p>
            <form onSubmit={submit} className="pointer-events-auto flex gap-2 pt-1">
              <label htmlFor="link" className="sr-only">
                A country in the chain
              </label>
              <div className="relative">
                <input
                  id="link"
                  autoFocus
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setHighlighted(-1);
                    setDidYouMean([]);
                  }}
                  onKeyDown={(e) => onKeyDown(e, tryAdd, () => tryAdd(typed))}
                  placeholder="Country name"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  role="combobox"
                  aria-expanded={matches.length > 0}
                  aria-controls="link-suggestions"
                  className="w-48 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 pr-8 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
                />
                <ClearButton
                  show={typed !== ""}
                  inputId="link"
                  onClear={() => {
                    setTyped("");
                    setHighlighted(-1);
                    setDidYouMean([]);
                  }}
                />
                {matches.length > 0 && (
                  <ul
                    id="link-suggestions"
                    role="listbox"
                    // Upwards on a phone, where the panel sits on the bottom
                    // edge and a list opening down would leave the screen.
                    className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-md border border-white/10 bg-raised text-left shadow-xl lg:bottom-auto lg:top-full lg:mb-0 lg:mt-1"
                  >
                    {matches.map((match, index) => (
                      <li
                        key={match}
                        role="option"
                        aria-selected={index === highlighted}
                        onMouseDown={(e) => {
                          // Before the input loses focus, so the click lands.
                          e.preventDefault();
                          tryAdd(match);
                        }}
                        onMouseEnter={() => setHighlighted(index)}
                        className={`cursor-pointer truncate px-2.5 py-1.5 text-sm text-zinc-200 ${
                          index === highlighted ? "bg-white/10" : ""
                        }`}
                      >
                        {match}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="submit"
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
              >
                Add
              </button>
            </form>
            {note && (
              <p
                className={`text-xs ${miss ? "font-medium text-rose-400" : "text-zinc-400"}`}
              >
                {note}
              </p>
            )}
            {didYouMean.length > 0 && (
              <p className="pointer-events-auto text-xs text-zinc-400">
                Did you mean{" "}
                {didYouMean.map((name, i) => (
                  <span key={name}>
                    {i > 0 && " or "}
                    <button
                      type="button"
                      onClick={() => tryAdd(name)}
                      className="text-teal-300 underline underline-offset-2 hover:text-teal-200"
                    >
                      {display(name)}
                    </button>
                  </span>
                ))}
                ?
              </p>
            )}
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

        {/* Played down, like the mystery's give-up: a way to clear a chain
            that went wrong, not a button to reach for. */}
        {result && !result.solved && placedOf(result).length > 0 && (
          <button
            onClick={() => setConfirmingRestart(true)}
            className="pointer-events-auto text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
          >
            Start over
          </button>
        )}
      </div>


      {/* Only on the move that joins the chain, not on every visit after. */}
      <Celebrate burst={burst} count={90} />
      {confirmingRestart && (
        <ConfirmDialog
          title="Start over?"
          body="Your chain and the clock go back to zero."
          confirmLabel="Start over"
          onConfirm={startOver}
          cancelLabel="Keep going"
          onCancel={() => setConfirmingRestart(false)}
        />
      )}
      {leaving && (
        <ExitConfirm
          note="Your chain won't be kept. You can start again from the menu."
          onFinish={leave}
          onKeepPlaying={() => setLeaving(false)}
        />
      )}

    </div>
  );
}
