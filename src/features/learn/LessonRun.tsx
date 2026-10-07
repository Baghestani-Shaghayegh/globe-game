import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import Celebrate from "../../components/Celebrate";
import { getCountryMeta } from "../../data/countries";
import { flagUrl } from "../../data/flags";
import { capitalOf } from "../../data/capitals";
import { cluesFor } from "../../data/clues";
import { resolveName } from "../../lib/answerMatch";
import { answerStroke, landShade, raisedLand, theme } from "../../lib/globeTheme";
import { landMaterial } from "../../lib/globeTerrain";
import { altitudeFor, featureCentre, labelPoint, ROUND_FOV } from "../../lib/geo";
import { distanceKm, type Point } from "../../lib/mystery";
import { directionFrom, landBordersOf } from "../../lib/lessons";
import type { Recall } from "../../lib/practice";
import { canSpeak, speak, stopSpeaking } from "../../lib/speech";
import { loadVoiceManifest } from "../../lib/voices";
import { playCorrect, playHint, playRoundEnd, playTap, playWrong } from "../../lib/sound";
import { useGlobeClick } from "../globe-guess/useGlobeClick";
import { useGlobeTheme } from "../globe-guess/useGlobeTheme";
import { GLOBE_SURFACE, useGlobeLook } from "../globe-guess/useGlobeLook";
import { useSuggestions } from "../globe-guess/useSuggestions";
import { markLat, markLng, namePill, pulseMark } from "../globe-guess/globeMarks";
import type { CountryFeature } from "./useLessons";
import ClearButton from "../../components/ClearButton";

/**
 * The engine under a lesson and a practice round: a few countries, in up to
 * three steps.
 *
 *   Meet — each one in turn, lit on the globe, with its flag, capital,
 *          neighbours and one thing about it.
 *   Find — "click Spain": the five are raised out of the map, so it is a
 *          choice among the ones just met, and a miss says which way to go.
 *   Name — one lights up, you type its name: the harder way round, last.
 *
 * No clock and no score: someone learning is not racing anyone. A miss costs
 * nothing but a hint, and two show the answer, so nobody is ever stuck.
 *
 * A lesson is five neighbours, met first. Practice is the countries due for
 * review, wherever they are, straight into Find: a lesson teaches them, and
 * practice asks again just as they'd start to fade.
 */

type Phase = "meet" | "find" | "name" | "done";

const PHASES: { id: Exclude<Phase, "done">; label: string }[] = [
  { id: "meet", label: "Meet" },
  { id: "find", label: "Find" },
  { id: "name", label: "Name" },
];

/** How near a press has to land to one of the five to count as it. */
const SNAP_PX = 20;

/** Misses before the answer is shown rather than hinted at. */
const MISSES_TO_REVEAL = 2;

type Note = { tone: "good" | "bad" | "hint"; text: string };

type Mark = Point & { key: string; kind: "pill" | "pulse"; text: string; lift: number };

const markElement = (d: object) => {
  const mark = d as Mark;
  return mark.kind === "pulse" ? pulseMark() : namePill(mark.text, mark.lift);
};

const display = (name: string) => getCountryMeta(name).displayName;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];

/** "five". Most lessons are five; a few aren't. */
function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

/**
 * How far back to sit so everything within `reach` degrees of the point
 * looked at fits the shorter side of the view, with a margin.
 *
 * Worked out from the lens rather than guessed, because the box the globe
 * sits in is a different shape on a phone and a desktop: a point `reach`
 * degrees round the sphere from the middle is at angle θ off the camera's
 * axis, tan θ = sin r / (d − cos r) on a unit sphere, and d is solved for
 * the θ that just fits.
 */
function frameAltitude(reach: number, width: number, height: number): number {
  const r = (Math.min(reach, 80) * Math.PI) / 180;
  const fit = Math.tan((ROUND_FOV / 2) * (Math.PI / 180)) * (Math.min(width, height) / height) * 0.82;
  return Math.min(2.4, Math.max(0.3, Math.cos(r) + Math.sin(r) / fit - 1));
}

/** The middle of some points, on the sphere. */
function middleOf(points: Point[]): Point {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const { lat, lng } of points) {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lng * Math.PI) / 180;
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  return {
    lat: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI,
    lng: (Math.atan2(y, x) * 180) / Math.PI,
  };
}

function useBoxSize() {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () =>
      setSize((old) =>
        old.width === el.clientWidth && old.height === el.clientHeight
          ? old
          : { width: el.clientWidth, height: el.clientHeight }
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { box, size };
}

export default function LessonRun({
  countries,
  features,
  meet = true,
  heading,
  back,
  onFinish,
  done,
}: {
  /** In teaching order: each one next to the one before, for a lesson. */
  countries: string[];
  features: CountryFeature[];
  /** Start with Meet. A review skips it: remembering is the exercise. */
  meet?: boolean;
  /** Top right of the panel: "Europe · Lesson 3", "Practice". */
  heading: string;
  back: { label: string; onClick: () => void };
  /** Once, when the last country is named, with how each one went. */
  onFinish: (recalls: Record<string, Recall>) => void;
  /** The panel once it's over. */
  done: (recalls: Record<string, Recall>) => ReactNode;
}) {
  const themeId = useGlobeTheme();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const ocean = useGlobeLook(globeRef, ready);
  const { box, size } = useBoxSize();

  const byName = useMemo(
    () => new Map(features.map((f) => [f.properties.name, f])),
    [features]
  );
  const inPlay = useMemo(() => new Set(countries), [countries]);
  const phases = meet ? PHASES : PHASES.filter((p) => p.id !== "meet");

  // Meet in teaching order, each next to the one before. Find in A to Z, so
  // it is not the same walk again; Name the other way round.
  const order = useMemo(() => {
    const alphabetical = [...countries].sort((a, b) =>
      display(a).localeCompare(display(b))
    );
    return {
      meet: countries,
      find: alphabetical,
      name: [...alphabetical].reverse(),
      done: countries,
    };
  }, [countries]);

  const [phase, setPhase] = useState<Phase>(meet ? "meet" : "find");
  // Which names have a recorded clip, fetched now so it's there by the time
  // a speaker is pressed.
  useEffect(() => {
    void loadVoiceManifest();
  }, []);
  const [step, setStep] = useState(0);
  const [misses, setMisses] = useState(0);
  /** Found, in Find; named, in Name. */
  const [solved, setSolved] = useState<string[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  /** A country just clicked or named wrongly, lit red for a moment. */
  const [wrong, setWrong] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [burst, setBurst] = useState(0);
  /** The end card over the globe; closed to look at the map. */
  const [endCard, setEndCard] = useState(false);
  /**
   * How each country went, the worse of Find and Name: missed once and got
   * it is "slow", shown the answer is "missed". What the practice deck files.
   */
  const [slips, setSlips] = useState<Record<string, Recall>>({});
  const [recalls, setRecalls] = useState<Record<string, Recall> | null>(null);

  const current = order[phase][step];
  const revealed = misses >= MISSES_TO_REVEAL;

  useEffect(() => {
    if (!wrong) return;
    const timer = window.setTimeout(() => setWrong(null), 1800);
    return () => window.clearTimeout(timer);
  }, [wrong]);

  // The whole lesson in view, framed to the box the globe has.
  const frame = useMemo(() => {
    const places = countries.flatMap((name) => {
      const feature = byName.get(name);
      return feature ? [featureCentre(feature.geometry)] : [];
    });
    const middle = middleOf(places);
    const reach = Math.max(
      4,
      ...places.map((p) => distanceKm(middle, p) / 111 + p.span / 2)
    );
    return { middle, reach };
  }, [countries, byName]);

  /**
   * Scattered over the world, as a review is, rather than a patch of
   * neighbours: the whole set can't be in view at once, so the camera goes
   * to each country in turn wherever the question is "what's this?".
   */
  const wide = frame.reach > 30;

  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe || !size.width) return;
    globe.pointOfView(
      { ...frame.middle, altitude: frameAltitude(frame.reach, size.width, size.height) },
      0
    );
  }, [ready, frame, size]);

  // The end: back out to the whole set, all green now, so the last thing on
  // the globe is what was learned rather than a close-up of the last answer.
  // The card follows once the camera has settled.
  useEffect(() => {
    if (phase !== "done") return;
    const globe = globeRef.current;
    if (globe && size.width) {
      globe.pointOfView(
        { ...frame.middle, altitude: frameAltitude(frame.reach, size.width, size.height) },
        1200
      );
    }
    const id = window.setTimeout(() => setEndCard(true), 1300);
    return () => window.clearTimeout(id);
    // Once, when it ends: not again on a resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const globe = globeRef.current;
    const feature = current ? byName.get(current) : undefined;
    if (!wide || !ready || !globe || !feature) return;
    if (phase !== "meet" && phase !== "name") return;
    const { lat, lng, span } = featureCentre(feature.geometry);
    globe.pointOfView({ lat, lng, altitude: Math.max(1.1, altitudeFor(span)) }, 900);
  }, [wide, ready, phase, current, byName]);

  const advance = (then: Note | null) => {
    setMisses(0);
    setNote(then);
    if (step + 1 < countries.length) {
      setStep(step + 1);
      return;
    }
    setStep(0);
    setSolved([]);
    if (phase === "meet") setPhase("find");
    else if (phase === "find") {
      setPhase("name");
      setNote({
        tone: "good",
        text: `All ${countWord(countries.length)} found. Now name them.`,
      });
    } else {
      const outcome = Object.fromEntries(
        countries.map((name) => [name, slips[name] ?? "clean"])
      ) as Record<string, Recall>;
      setRecalls(outcome);
      setPhase("done");
      onFinish(outcome);
      playRoundEnd(true);
      setBurst((n) => n + 1);
    }
  };

  const miss = (name: string | null, hint: (misses: number) => string) => {
    const count = misses + 1;
    setMisses(count);
    const slip: Recall = count >= MISSES_TO_REVEAL ? "missed" : "slow";
    setSlips((old) =>
      old[current] === "missed" ? old : { ...old, [current]: slip }
    );
    if (name) setWrong(name);
    setShake((n) => n + 1);
    if (count >= MISSES_TO_REVEAL) playHint();
    else playWrong();
    setNote({ tone: count >= MISSES_TO_REVEAL ? "hint" : "bad", text: hint(count) });
  };

  const centreOf = (name: string): Point | null => {
    const feature = byName.get(name);
    return feature ? featureCentre(feature.geometry) : null;
  };

  /**
   * Where the last press let go, and whether a country took it. Andorra is a
   * few pixels across at a lesson's zoom and Malta is ringed by sea, so
   * aiming at them landed on Spain or on nothing; a press this close to one
   * of the five counts as that one.
   */
  const press = useRef<{ x: number; y: number; at: number } | null>(null);
  const released = useRef<{ x: number; y: number } | null>(null);
  const handled = useRef(false);

  /** Which of `names` the last press was within reach of, nearest first. */
  const nearestTo = (names: string[]): string | null => {
    const globe = globeRef.current;
    const el = box.current;
    const up = released.current;
    if (!globe || !el || !up) return null;
    const rect = el.getBoundingClientRect();
    let best: string | null = null;
    let bestPx = SNAP_PX;
    for (const name of names) {
      const feature = byName.get(name);
      if (!feature) continue;
      const { lat, lng } = labelPoint(feature.geometry);
      const at = globe.getScreenCoords(lat, lng, 0.03);
      const px = Math.hypot(rect.left + at.x - up.x, rect.top + at.y - up.y);
      if (px < bestPx) {
        bestPx = px;
        best = name;
      }
    }
    return best;
  };

  const pickOnGlobe = (clicked: string | null) => {
    handled.current = true;
    if (phase === "meet") {
      // Clicking one of the five goes to it; anything else is scenery.
      const name =
        clicked && inPlay.has(clicked) ? clicked : nearestTo(countries);
      const index = name ? countries.indexOf(name) : -1;
      if (index >= 0) {
        playTap();
        setStep(index);
      }
      return;
    }
    if (phase !== "find") return;
    const name = clicked !== current && nearestTo([current]) ? current : clicked;
    if (!name) return;
    if (name === current) {
      playCorrect(solved.length);
      setSolved([...solved, name]);
      advance({ tone: "good", text: `✓ ${display(name)}` });
      return;
    }
    if (solved.includes(name)) {
      setNote({ tone: "hint", text: `Already found ${display(name)}.` });
      return;
    }
    const from = centreOf(name);
    const to = centreOf(current);
    miss(name, (count) =>
      count >= MISSES_TO_REVEAL
        ? `That's ${display(name)}. ${display(current)}'s the flashing one.`
        : from && to
          ? `That's ${display(name)}. Head ${directionFrom(from, to)}.`
          : `That's ${display(name)}.`
    );
  };

  const globeClick = useGlobeClick<CountryFeature>((feature) =>
    pickOnGlobe(feature.properties.name)
  );

  const onPointerDown = (event: ReactPointerEvent) => {
    press.current =
      (event.target as HTMLElement).tagName === "CANVAS"
        ? { x: event.clientX, y: event.clientY, at: performance.now() }
        : null;
    globeClick.onPointerDown(event);
  };

  const onPointerUp = (event: ReactPointerEvent) => {
    const from = press.current;
    press.current = null;
    released.current = { x: event.clientX, y: event.clientY };
    handled.current = false;
    globeClick.onPointerUp(event);
    // A click on the sea beside one of the five: no country took it, but it
    // was meant for one. The same allowance for drift a country click gets.
    if (
      !handled.current &&
      from &&
      Math.hypot(event.clientX - from.x, event.clientY - from.y) <= 9 &&
      performance.now() - from.at <= 700
    ) {
      pickOnGlobe(null);
    }
  };

  // Naming.
  const allNames = useMemo(() => features.map((f) => f.properties.name), [features]);
  const suggestable = useMemo(() => allNames.map(getCountryMeta), [allNames]);
  const [typed, setTyped] = useState("");
  const { matches, highlighted, setHighlighted, onKeyDown } = useSuggestions(
    suggestable,
    typed,
    5
  );

  const tryName = (text: string) => {
    if (phase !== "name" || revealed || !text.trim()) return;
    const name = resolveName(text, allNames);
    if (!name) {
      setNote({ tone: "bad", text: `No country called "${text.trim()}".` });
      playWrong();
      return;
    }
    setTyped("");
    setHighlighted(-1);
    if (name === current) {
      playCorrect(solved.length);
      setSolved([...solved, name]);
      advance({ tone: "good", text: `✓ ${display(name)}` });
      return;
    }
    miss(inPlay.has(name) ? name : null, (count) =>
      count >= MISSES_TO_REVEAL
        ? `It's ${display(current)}.`
        : `Not ${display(name)}. Starts with ${display(current)[0]}.`
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    tryName(typed);
  };

  /**
   * "Show me": for a country the player doesn't know, rather than guessing
   * until the answer comes on its own. The same as missing it twice: filed
   * as missed, so the practice deck brings it back.
   */
  const showMe = () => {
    if (revealed || (phase !== "find" && phase !== "name")) return;
    playHint();
    setMisses(MISSES_TO_REVEAL);
    setSlips((old) => ({ ...old, [current]: "missed" }));
    setNote({
      tone: "hint",
      text:
        phase === "find"
          ? `${display(current)}'s the flashing one.`
          : `It's ${display(current)}.`,
    });
  };

  const showMeButton = (
    <button
      type="button"
      onClick={showMe}
      className="mt-2 rounded-md py-1 text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-100 hover:underline"
    >
      Show me
    </button>
  );

  /** After the answer was shown: counted as met, and on to the next. */
  const carryOn = () => {
    playTap();
    setSolved([...solved, current]);
    advance(null);
  };

  // What colour each country is. The five stand raised out of the map
  // throughout; the one being asked about or looked at is lit.
  const fillFor = useCallback(
    (name: string): { color: string; answer: boolean } => {
      if (name === wrong) return { color: theme.missed, answer: true };
      if (!inPlay.has(name)) return { color: landShade(name), answer: false };
      if (phase === "done" || solved.includes(name))
        return { color: theme.found, answer: true };
      const lit =
        name === current && (phase !== "find" || revealed);
      if (lit) return { color: theme.selected, answer: true };
      return { color: landShade(name, raisedLand()), answer: false };
    },
    // themeId: the palette is a live object — see GlobeGame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wrong, inPlay, phase, solved, current, revealed, themeId]
  );

  const capMaterial = useCallback(
    (d: object) => {
      const fill = fillFor((d as CountryFeature).properties.name);
      return fill.answer ? landMaterial(fill.color, "answer") : landMaterial(fill.color);
    },
    [fillFor]
  );
  const strokeColor = useCallback(
    (d: object) => {
      const fill = fillFor((d as CountryFeature).properties.name);
      return fill.answer ? answerStroke(fill.color) : theme.stroke;
    },
    [fillFor]
  );
  const altitude = useCallback(
    (d: object) => {
      const { name } = (d as CountryFeature).properties;
      if (name === wrong) return 0.035;
      return inPlay.has(name) ? 0.03 : 0.008;
    },
    [inPlay, wrong]
  );

  // Names on the ones already met, found or named. A pulse on the one to
  // look at — and in Find, on every one still to find: the Country hunt's
  // glow, so the few in play stand out from the whole map, islands too.
  const marks = useMemo<Mark[]>(() => {
    const named =
      phase === "meet"
        ? order.meet.slice(0, step + 1)
        : phase === "done"
          ? countries
          : phase === "name" && revealed
            ? [...solved, current]
            : solved;
    const pulses =
      phase === "find"
        ? countries.filter((name) => !solved.includes(name))
        : phase === "meet" || phase === "name"
          ? [current]
          : [];
    const pulsing = phase === "find" ? null : pulses[0] ?? null;
    const out: Mark[] = [];
    // The wrong one says what it was, on the map, for as long as it's red:
    // "that's Portugal" is worth seeing where Portugal is.
    for (const name of new Set(wrong ? [...named, wrong] : named)) {
      const feature = byName.get(name);
      if (!feature) continue;
      out.push({
        ...labelPoint(feature.geometry),
        key: `pill:${name}`,
        kind: "pill",
        text: display(name),
        lift: name === pulsing ? 30 : 18,
      });
    }
    for (const name of pulses) {
      const feature = byName.get(name);
      if (!feature) continue;
      out.push({
        ...labelPoint(feature.geometry),
        key: `pulse:${name}`,
        kind: "pulse",
        text: "",
        lift: 0,
      });
    }
    return out;
  }, [phase, step, order, countries, solved, current, revealed, wrong, byName]);

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-page lg:flex-row-reverse">
      {/* The globe has its own box and the panel its own, side by side on a
          wide screen and one above the other on a phone: nothing sits over
          the map, which is the thing being learned. */}
      <div
        ref={box}
        className="relative min-h-0 flex-1"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {size.width > 0 && (
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            rendererConfig={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
            backgroundColor={theme.page}
            globeMaterial={ocean}
            onGlobeReady={() => setReady(true)}
            {...GLOBE_SURFACE}
            polygonsData={features}
            polygonCapMaterial={capMaterial}
            polygonStrokeColor={strokeColor}
            polygonAltitude={altitude}
            polygonsTransitionDuration={200}
            onPolygonHover={(polygon) =>
              globeClick.setHovered(polygon as CountryFeature | null)
            }
            htmlElementsData={marks}
            htmlLat={markLat}
            htmlLng={markLng}
            htmlAltitude={0.04}
            htmlElement={markElement}
            htmlTransitionDuration={0}
          />
        )}
      </div>

      <aside className="relative z-10 flex h-[46dvh] shrink-0 flex-col overflow-y-auto border-t border-white/10 bg-surface px-5 pb-5 pt-4 lg:h-auto lg:w-[24rem] lg:border-r lg:border-t-0 lg:px-7 lg:pt-5">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => {
              playTap();
              back.onClick();
            }}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:text-zinc-100"
          >
            ← {back.label}
          </button>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {heading}
          </span>
        </div>

        {/* Where you are in the lesson: three steps, the five in each. */}
        <ol
          className={`mt-4 grid gap-1.5 ${phases.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
          aria-label="Steps"
        >
          {phases.map(({ id, label }, i) => {
            const at = phases.findIndex((p) => p.id === phase);
            const state = phase === "done" || i < at ? "done" : i === at ? "now" : "later";
            return (
              <li key={id} aria-current={state === "now" ? "step" : undefined}>
                <span
                  className={`block h-1 rounded-full ${
                    state === "done"
                      ? "bg-emerald-400"
                      : state === "now"
                        ? "bg-teal-300"
                        : "bg-white/10"
                  }`}
                />
                <span
                  className={`mt-1.5 block text-xs font-medium ${
                    state === "now"
                      ? "text-teal-300"
                      : state === "done"
                        ? "text-emerald-300/80"
                        : "text-zinc-500"
                  }`}
                >
                  {state === "done" ? "✓ " : ""}
                  {label}
                  {state === "now" && (
                    <span className="tabular-nums text-zinc-500">
                      {" "}
                      {step + 1}/{countries.length}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <div key={shake} className={`mt-5 flex-1 ${shake ? "animate-shake" : ""}`}>
          {phase === "meet" && (
            <Meet
              name={current}
              index={step}
              total={countries.length}
              onBack={() => {
                playTap();
                setStep(Math.max(0, step - 1));
              }}
              onNext={() => {
                playTap();
                advance(null);
              }}
            />
          )}

          {phase === "find" && (
            <>
              <p className="text-sm text-zinc-400">Where's</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50">
                {display(current)}?
              </p>
              {!revealed && showMeButton}
            </>
          )}

          {phase === "name" && (
            <>
              <p className="text-sm text-zinc-400">
                Which country is this?
              </p>
              {revealed ? (
                <button
                  onClick={carryOn}
                  autoFocus
                  className="mt-3 w-full rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
                >
                  Next →
                </button>
              ) : (
                <form onSubmit={submit} className="mt-3 flex gap-2">
                  <label htmlFor="lesson-name" className="sr-only">
                    Country name
                  </label>
                  <div className="relative min-w-0 flex-1">
                    <input
                      id="lesson-name"
                      value={typed}
                      onChange={(e) => {
                        setTyped(e.target.value);
                        setHighlighted(-1);
                      }}
                      onKeyDown={(e) => onKeyDown(e, tryName, () => tryName(typed))}
                      placeholder="Type a country"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      autoFocus
                      role="combobox"
                      aria-expanded={matches.length > 0}
                      aria-controls="lesson-suggestions"
                      className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 pr-8 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
                    />
                    <ClearButton
                      show={typed !== ""}
                      inputId="lesson-name"
                      onClear={() => {
                        setTyped("");
                        setHighlighted(-1);
                      }}
                    />
                    {matches.length > 0 && (
                      <ul
                        id="lesson-suggestions"
                        role="listbox"
                        className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-md border border-white/10 bg-raised text-left shadow-xl"
                      >
                        {matches.map((name, index) => (
                          <li
                            key={name}
                            role="option"
                            aria-selected={index === highlighted}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              tryName(name);
                            }}
                            onMouseEnter={() => setHighlighted(index)}
                            className={`cursor-pointer truncate px-3 py-1.5 text-sm text-zinc-200 ${
                              index === highlighted ? "bg-white/10" : ""
                            }`}
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="rounded-md border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
                  >
                    Guess
                  </button>
                </form>
              )}
              {!revealed && showMeButton}
            </>
          )}

          {(phase === "find" || phase === "name") && note && (
            <p
              role="status"
              className={`mt-3 text-sm ${
                note.tone === "good"
                  ? "text-emerald-300"
                  : note.tone === "bad"
                    ? "text-red-400"
                    : "text-amber-300"
              }`}
            >
              {note.text}
            </p>
          )}

          {phase === "done" && recalls && done(recalls)}
        </div>
      </aside>

      {/* The end, said properly: over the globe, not only in the panel. */}
      {phase === "done" && recalls && endCard && (
        <div
          role="dialog"
          aria-label="Finished"
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-page/55 p-4 backdrop-blur-[2px] animate-fade-in"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
            {done(recalls)}
            <button
              onClick={() => {
                playTap();
                setEndCard(false);
              }}
              className="mt-3 w-full text-center text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
            >
              See the map
            </button>
          </div>
        </div>
      )}

      <Celebrate burst={burst} count={70} />
    </div>
  );
}

/**
 * A speaker next to a name: press it to hear the name said. Hidden where the
 * browser can't speak. Lit while it talks.
 */
function SpeakButton({ text, small = false }: { text: string; small?: boolean }) {
  const [talking, setTalking] = useState(false);
  // Moving on to the next country stops the last one mid-word.
  useEffect(() => {
    setTalking(false);
    return () => stopSpeaking();
  }, [text]);
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setTalking(true);
        speak(text, () => setTalking(false));
      }}
      aria-label={`Say ${text}`}
      title={`Say ${text}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors ${
        small ? "h-7 w-7" : "h-9 w-9"
      } ${
        talking
          ? "bg-teal-300 text-teal-950"
          : "text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={small ? "h-4 w-4" : "h-5 w-5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}

export function Flag({ name, className }: { name: string; className: string }) {
  const flag = flagUrl(name);
  return flag ? (
    <img
      src={flag}
      alt={`Flag of ${display(name)}`}
      className={`rounded object-cover ring-1 ring-white/10 ${className}`}
    />
  ) : null;
}

function Meet({
  name,
  index,
  total,
  onBack,
  onNext,
}: {
  name: string;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const capital = capitalOf(name);
  const fact = cluesFor(name)[0];
  const neighbours = landBordersOf(name).map(display).sort();
  const last = index === total - 1;

  return (
    <div>
      <Flag name={name} className="h-16 w-24" />
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-semibold tracking-tight text-zinc-50">
        {display(name)}
        <SpeakButton text={display(name)} />
      </h1>
      <dl className="mt-4 space-y-2.5 text-sm">
        {capital && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-zinc-500">Capital</dt>
            <dd className="flex items-center gap-1.5 text-zinc-200">
              {capital}
              <SpeakButton text={capital} small />
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-wider text-zinc-500">Borders</dt>
          <dd className="text-zinc-200">
            {neighbours.length ? neighbours.join(", ") : "Sea on all sides"}
          </dd>
        </div>
        {fact && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-zinc-500">Known for</dt>
            <dd className="text-zinc-300">{fact}</dd>
          </div>
        )}
      </dl>
      <div className="mt-6 flex gap-2">
        <button
          onClick={onBack}
          disabled={index === 0}
          className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:text-zinc-100 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          autoFocus
          className="flex-1 rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
        >
          {last ? "Find them →" : "Next →"}
        </button>
      </div>
    </div>
  );
}

