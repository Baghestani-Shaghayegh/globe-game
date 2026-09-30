import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Celebrate from "../components/Celebrate";
import { getCountryMeta } from "../data/countries";
import { flagUrl } from "../data/flags";
import { capitalOf } from "../data/capitals";
import { cluesFor } from "../data/clues";
import { resolveName } from "../lib/answerMatch";
import { answerStroke, landShade, raisedLand, theme } from "../lib/globeTheme";
import { landMaterial } from "../lib/globeTerrain";
import { featureCentre, labelPoint, ROUND_FOV } from "../lib/geo";
import { distanceKm, type Point } from "../lib/mystery";
import {
  directionFrom,
  landBordersOf,
  LESSON_CONTINENTS,
  markLearned,
  type Lesson,
} from "../lib/lessons";
import { playCorrect, playHint, playRoundEnd, playTap, playWrong } from "../lib/sound";
import { useGlobeClick } from "../features/globe-guess/useGlobeClick";
import { useGlobeTheme } from "../features/globe-guess/useGlobeTheme";
import { GLOBE_SURFACE, useGlobeLook } from "../features/globe-guess/useGlobeLook";
import { useSuggestions } from "../features/globe-guess/useSuggestions";
import { markLat, markLng, namePill, pulseMark } from "../features/globe-guess/globeMarks";
import {
  useLessons,
  type CountryFeature,
} from "../features/learn/useLessons";

/**
 * One lesson: five neighbouring countries, in three steps.
 *
 *   Meet — each one in turn, lit on the globe, with its flag, capital,
 *          neighbours and one thing about it.
 *   Find — "click Spain": the five are raised out of the map, so it is a
 *          choice among the ones just met, and a miss says which way to go.
 *   Name — one lights up, you type its name: the harder way round, last.
 *
 * No clock and no score: someone learning is not racing anyone. A miss costs
 * nothing but a hint, and two show the answer, so nobody is ever stuck.
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

/** "five", or "Five" to start a sentence. Most lessons are five; a few aren't. */
function countWord(n: number, capital = false): string {
  const word = WORDS[n] ?? String(n);
  return capital ? word[0].toUpperCase() + word.slice(1) : word;
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

export default function LessonPage() {
  const { id } = useParams();
  const map = useLessons();

  if (map === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page px-6">
        <p className="text-zinc-100">Couldn't load the map data.</p>
        <Link to="/learn" className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100">
          All lessons
        </Link>
      </div>
    );
  }
  if (!map) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-zinc-500">
        Loading the lesson…
      </div>
    );
  }
  const at = map.lessons.findIndex((lesson) => lesson.id === id);
  if (at < 0) return <Navigate to="/learn" replace />;
  return (
    // Keyed, so going on to the next lesson starts it from the top.
    <LessonRun
      key={id}
      lesson={map.lessons[at]}
      next={map.lessons[at + 1] ?? null}
      features={map.features}
    />
  );
}

function LessonRun({
  lesson,
  next,
  features,
}: {
  lesson: Lesson;
  next: Lesson | null;
  features: CountryFeature[];
}) {
  const themeId = useGlobeTheme();
  const navigate = useNavigate();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const ocean = useGlobeLook(globeRef, ready);
  const { box, size } = useBoxSize();

  const byName = useMemo(
    () => new Map(features.map((f) => [f.properties.name, f])),
    [features]
  );
  const inLesson = useMemo(() => new Set(lesson.countries), [lesson]);
  const continentName =
    LESSON_CONTINENTS.find((c) => c.id === lesson.continent)?.name ?? "";

  // Meet in teaching order, each next to the one before. Find in A to Z, so
  // it is not the same walk again; Name the other way round.
  const order = useMemo(() => {
    const alphabetical = [...lesson.countries].sort((a, b) =>
      display(a).localeCompare(display(b))
    );
    return {
      meet: lesson.countries,
      find: alphabetical,
      name: [...alphabetical].reverse(),
      done: lesson.countries,
    };
  }, [lesson]);

  const [phase, setPhase] = useState<Phase>("meet");
  const [step, setStep] = useState(0);
  const [misses, setMisses] = useState(0);
  /** Found, in Find; named, in Name. */
  const [solved, setSolved] = useState<string[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  /** A country just clicked or named wrongly, lit red for a moment. */
  const [wrong, setWrong] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [burst, setBurst] = useState(0);

  const current = order[phase][step];
  const revealed = misses >= MISSES_TO_REVEAL;

  useEffect(() => {
    if (!wrong) return;
    const timer = window.setTimeout(() => setWrong(null), 1800);
    return () => window.clearTimeout(timer);
  }, [wrong]);

  // The whole lesson in view, framed to the box the globe has.
  const frame = useMemo(() => {
    const places = lesson.countries.flatMap((name) => {
      const feature = byName.get(name);
      return feature ? [featureCentre(feature.geometry)] : [];
    });
    const middle = middleOf(places);
    const reach = Math.max(
      4,
      ...places.map((p) => distanceKm(middle, p) / 111 + p.span / 2)
    );
    return { middle, reach };
  }, [lesson, byName]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe || !size.width) return;
    globe.pointOfView(
      { ...frame.middle, altitude: frameAltitude(frame.reach, size.width, size.height) },
      0
    );
  }, [ready, frame, size]);

  const advance = (then: Note | null) => {
    setMisses(0);
    setNote(then);
    if (step + 1 < lesson.countries.length) {
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
        text: `All ${countWord(lesson.countries.length)} found. Now the other way round.`,
      });
    } else {
      setPhase("done");
      markLearned(lesson.countries);
      playRoundEnd(true);
      setBurst((n) => n + 1);
    }
  };

  const miss = (name: string | null, hint: (misses: number) => string) => {
    const count = misses + 1;
    setMisses(count);
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
        clicked && inLesson.has(clicked) ? clicked : nearestTo(lesson.countries);
      const index = name ? lesson.countries.indexOf(name) : -1;
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
      advance({ tone: "good", text: `Yes, that's ${display(name)}.` });
      return;
    }
    if (solved.includes(name)) {
      setNote({ tone: "hint", text: `You've found ${display(name)} already.` });
      return;
    }
    const from = centreOf(name);
    const to = centreOf(current);
    miss(name, (count) =>
      count >= MISSES_TO_REVEAL
        ? `That's ${display(name)}. ${display(current)} is the one pulsing — click it to go on.`
        : from && to
          ? `That's ${display(name)}. ${display(current)} is ${directionFrom(from, to)} of there.`
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
      advance({ tone: "good", text: `Yes, ${display(name)}.` });
      return;
    }
    miss(inLesson.has(name) ? name : null, (count) =>
      count >= MISSES_TO_REVEAL
        ? `It's ${display(current)}.`
        : `Not ${display(name)}. This one starts with "${display(current)[0]}".`
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    tryName(typed);
  };

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
      if (!inLesson.has(name)) return { color: landShade(name), answer: false };
      if (phase === "done" || solved.includes(name))
        return { color: theme.found, answer: true };
      const lit =
        name === current && (phase !== "find" || revealed);
      if (lit) return { color: theme.selected, answer: true };
      return { color: landShade(name, raisedLand()), answer: false };
    },
    // themeId: the palette is a live object — see GlobeGame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wrong, inLesson, phase, solved, current, revealed, themeId]
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
      return inLesson.has(name) ? 0.03 : 0.008;
    },
    [inLesson, wrong]
  );

  // Names on the ones already met, found or named; a pulse on the one to
  // look at. In Find the pulse would be the answer, so it waits for two misses.
  const marks = useMemo<Mark[]>(() => {
    const named =
      phase === "meet"
        ? order.meet.slice(0, step + 1)
        : phase === "done"
          ? lesson.countries
          : phase === "name" && revealed
            ? [...solved, current]
            : solved;
    const pulsing =
      phase === "meet" || phase === "name" || (phase === "find" && revealed)
        ? current
        : null;
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
    const feature = pulsing ? byName.get(pulsing) : undefined;
    if (pulsing && feature) {
      out.push({
        ...labelPoint(feature.geometry),
        key: `pulse:${pulsing}`,
        kind: "pulse",
        text: "",
        lift: 0,
      });
    }
    return out;
  }, [phase, step, order, lesson, solved, current, revealed, wrong, byName]);

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
          <Link
            to="/learn"
            onClick={playTap}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:text-zinc-100"
          >
            ← Lessons
          </Link>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {continentName} · Lesson {lesson.number}
          </span>
        </div>

        {/* Where you are in the lesson: three steps, the five in each. */}
        <ol className="mt-4 grid grid-cols-3 gap-1.5" aria-label="Lesson steps">
          {PHASES.map(({ id, label }, i) => {
            const at = PHASES.findIndex((p) => p.id === phase);
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
                      {step + 1}/{lesson.countries.length}
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
              total={lesson.countries.length}
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
              <p className="text-sm text-zinc-400">Click on the globe</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50">
                {display(current)}
              </p>
            </>
          )}

          {phase === "name" && (
            <>
              <p className="text-sm text-zinc-400">
                What's the country lit up on the globe?
              </p>
              {revealed ? (
                <button
                  onClick={carryOn}
                  autoFocus
                  className="mt-3 w-full rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
                >
                  Got it — next
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
                      placeholder="Country name"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      autoFocus
                      role="combobox"
                      aria-expanded={matches.length > 0}
                      aria-controls="lesson-suggestions"
                      className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
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
                    Answer
                  </button>
                </form>
              )}
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

          {phase === "done" && (
            <Done
              lesson={lesson}
              next={next}
              onNext={(to) => {
                playTap();
                navigate(`/learn/${to.id}`);
              }}
            />
          )}
        </div>
      </aside>

      <Celebrate burst={burst} count={70} />
    </div>
  );
}

function Flag({ name, className }: { name: string; className: string }) {
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
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
        {display(name)}
      </h1>
      <dl className="mt-4 space-y-2.5 text-sm">
        {capital && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-zinc-500">Capital</dt>
            <dd className="text-zinc-200">{capital}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-wider text-zinc-500">Borders</dt>
          <dd className="text-zinc-200">
            {neighbours.length ? neighbours.join(", ") : "None, it's surrounded by sea"}
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
          {last ? "Now find them →" : "Next →"}
        </button>
      </div>
    </div>
  );
}

function Done({
  lesson,
  next,
  onNext,
}: {
  lesson: Lesson;
  next: Lesson | null;
  onNext: (lesson: Lesson) => void;
}) {
  const nextContinent = next
    ? LESSON_CONTINENTS.find((c) => c.id === next.continent)?.name
    : null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-300">
        Lesson learned
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
        {countWord(lesson.countries.length, true)} more on your map
      </h1>
      <ul className="mt-4 space-y-2">
        {lesson.countries.map((name) => (
          <li key={name} className="flex items-center gap-3">
            <Flag name={name} className="h-5 w-7 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
              {display(name)}
            </span>
            <span className="shrink-0 truncate text-xs text-zinc-500">
              {capitalOf(name) ?? ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-2">
        {next && (
          <button
            onClick={() => onNext(next)}
            autoFocus
            className="rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
          >
            Next lesson · {nextContinent} {next.number} →
          </button>
        )}
        <Link
          to="/learn"
          onClick={playTap}
          className="rounded-lg border border-white/15 px-4 py-2.5 text-center text-sm text-zinc-300 transition-colors hover:text-zinc-100"
        >
          All lessons
        </Link>
      </div>
    </div>
  );
}
