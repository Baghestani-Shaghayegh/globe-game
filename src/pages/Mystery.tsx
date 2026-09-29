import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useViewport } from "../lib/useViewport";
import { Link, useNavigate } from "react-router-dom";
import ExitConfirm from "../features/globe-guess/ExitConfirm";
import { useLeaveGuard } from "../features/globe-guess/useLeaveGuard";
import { useGlobeClick } from "../features/globe-guess/useGlobeClick";
import { useGlobeTheme } from "../features/globe-guess/useGlobeTheme";
import { GLOBE_SURFACE, useGlobeLook } from "../features/globe-guess/useGlobeLook";
import { getCountryMeta } from "../data/countries";
import { nearestNames, resolveName } from "../lib/answerMatch";
import { useSuggestions } from "../features/globe-guess/useSuggestions";
import { landShade, theme } from "../lib/globeTheme";
import { landMaterial } from "../lib/globeTerrain";
import { featureCentre, type Geometry, worldAltitude } from "../lib/geo";
import { dayKey, formatDay } from "../lib/daily";
import Celebrate from "../components/Celebrate";
import { playSolved, playWarm, playWrong, playLose } from "../lib/sound";
import {
  borderKm,
  closeness,
  heatColor,
  heatGradient,
  LEGEND_MARKS,
  loadMystery,
  MAX_SCALE_KM,
  mysteryFor,
  mysteryNumber,
  postMysteryScore,
  saveMystery,
  scoreFor,
  shapeOf,
  type MysteryResult,
  type Point,
  type Shape,
} from "../lib/mystery";


/** How many squares of the trail are worth showing on the result card. */
const MAX_TRAIL = 24;

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

/** The whole-world view, sized to this window. Shared by every game. */
const worldView = () => worldAltitude(window.innerWidth, window.innerHeight);

export default function Mystery() {
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

  // Each outline as points on the sphere, once, so a guess measures edge to
  // edge in a few milliseconds rather than retracing the geometry each time.
  const shapes = useMemo(() => {
    const map = new Map<string, Shape>();
    for (const feature of features) {
      map.set(feature.properties.name, shapeOf(feature.geometry));
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
    // Only a finished mystery comes back. One left part-way starts again from
    // nothing — Sara's rule for all three dailies: leaving without finishing
    // or giving up doesn't use up the day, and doesn't carry over either.
    const loaded = loadMystery(day);
    const saved = loaded && (loaded.solved || loaded.gaveUp) ? loaded : null;
    setResult(
      saved ?? {
        day,
        number: mysteryNumber(day),
        answer,
        guesses: [],
        solved: false,
        startedAt: Date.now(),
      }
    );
  }, [day, answer]);

  const guessed = useMemo(
    () => new Map((result?.guesses ?? []).map((g) => [g.name, g.km])),
    [result]
  );

  // The opening view. Mystery never set one, so it took react-globe.gl's
  // default and came out a different size from every other game — and wide
  // enough to run off both edges of a phone.
  useEffect(() => {
    if (!ready) return;
    globeRef.current?.pointOfView({ lat: 12, lng: 20, altitude: worldView() }, 0);
  }, [ready]);

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


  const [burst, setBurst] = useState(0);

  const guess = useCallback(
    (name: string) => {
      if (!result || result.solved || !answer) return;
      if (guessed.has(name)) {
        setFlash(`${getCountryMeta(name).displayName} — already guessed`);
        playWrong();
        return;
      }
      const from = centres.get(name);
      const fromShape = shapes.get(name);
      const toShape = shapes.get(answer);
      if (!from || !fromShape || !toShape) return;

      // Nearest border to nearest border: 0 for a neighbour. The centre is
      // still where the camera goes, since that is where the country is.
      const km = Math.round(borderKm(fromShape, toShape));
      const next: MysteryResult = {
        ...result,
        guesses: [{ name, km }, ...result.guesses],
        solved: name === answer,
      };
      saveMystery(next);
      setResult(next);
      setFlash(null);

      // Turn the globe to whatever was just named. Without this a guess on the
      // far side changed a colour nobody could see — you typed China, Africa
      // stayed on screen, and the answer to "how warm was that?" was behind
      // the planet. Closer in once it is the right one.
      globeRef.current?.pointOfView(
        { ...from, altitude: name === answer ? 1.6 : worldView() },
        name === answer ? 900 : 700
      );

      if (name === answer) {
        // Not awaited: the summary should never wait on the network, and the
        // result is already saved locally either way.
        void postMysteryScore(next);
        playSolved();
        setBurst((n) => n + 1);
      } else {
        // The same information the colour carries: warmer is higher. Reuses
        // the page's own closeness scale so the pitch and the heat agree.
        playWarm(closeness(km) / 100);
      }
    },
    [result, answer, guessed, centres, shapes]
  );

  /**
   * Every guess, closest first, for the list in the panel. It used to stop at
   * five; it now scrolls inside the panel instead, so the whole hunt is there
   * to look back over without the panel growing down the screen.
   */
  const closest = useMemo(
    () => [...(result?.guesses ?? [])].sort((a, b) => a.km - b.km),
    [result]
  );

  const [typed, setTyped] = useState("");

  /** Every country this round will accept as a guess. */
  const playable = useMemo(
    () => features.map((f) => f.properties.name),
    [features]
  );

  /**
   * Gives up: shows the answer, turns the globe to it, and closes the round.
   * Scores nothing — `postMysteryScore` only files a solved one — and is
   * saved, so it stays given up rather than reopening on a reload.
   */
  const giveUp = () => {
    if (!result || result.solved || result.gaveUp || !answer) return;
    const next: MysteryResult = { ...result, gaveUp: true };
    saveMystery(next);
    setResult(next);
    setFlash(null);
    playLose();
    const to = centres.get(answer);
    if (to) globeRef.current?.pointOfView({ ...to, altitude: 1.6 }, 900);
  };

  // Every playable country with its aliases, for the list under the box.
  const suggestable = useMemo(() => playable.map(getCountryMeta), [playable]);
  const { matches, highlighted, setHighlighted, onKeyDown } = useSuggestions(
    suggestable,
    typed,
    5
  );
  /** What a missed guess was probably reaching for, offered as buttons. */
  const [didYouMean, setDidYouMean] = useState<string[]>([]);

  const tryGuess = (text: string) => {
    if (!result || result.solved) return;
    // An empty box is not a wrong guess — it is no guess. Submitting one used
    // to answer "No country called """, which is a sentence about nothing.
    if (!text.trim()) return;
    const name = resolveName(text, playable);
    if (!name) {
      // Says what it could not find, and — where there is one — what you
      // probably meant. "No country called" on its own left a player to work
      // out their own typo against a globe that could not help them.
      setFlash(`No country called "${text.trim()}"`);
      setDidYouMean(nearestNames(text, playable));
      playWrong();
      return;
    }
    setTyped("");
    setDidYouMean([]);
    setHighlighted(-1);
    guess(name);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    tryGuess(typed);
  };

  // Hovering still names a country, which is worth keeping: it is how someone
  // finds out what they are looking at in order to type it.
  const globeClick = useGlobeClick<CountryFeature>(() => {});

  const capColor = useMemo(
    () => (d: object) => {
      const { name } = (d as CountryFeature).properties;
      const over = result?.solved || result?.gaveUp;
      if (over && name === result?.answer)
        // Green when it was found. Handed over, it is the hottest colour on
        // the scale, because it is the place every guess was measured from.
        // It used to be amber like a revealed answer elsewhere in the game,
        // but here amber is a point on the heat scale: Ukraine given up read
        // as lukewarm next to a red Turkey.
        return landMaterial(
          result?.solved ? theme.found : heatColor(0),
          "answer"
        );
      const km = guessed.get(name);
      // A guess reads as a temperature, so it must not also read as a time of
      // day — the heat ramp is flat, like every other answer.
      return km === undefined
        ? landMaterial(landShade(name))
        : landMaterial(heatColor(km), "answer");
    },
    [guessed, result]
  );

  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const goingSomewhere = useRef(false);
  const inProgress = !!result && !result.solved && !result.gaveUp && result.guesses.length > 0;
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

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page px-6">
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

  /**
   * Leaving mid-game asks first, by the link or by the browser's Back — which
   * on a trackpad is a two-finger swipe, easy to trigger while dragging a
   * globe around.
   *
   * A mystery is one attempt a day, so walking out of a half-solved one is
   * not a small thing. Asked only once a guess has been made — opening it
   * and turning straight round has cost nothing.
   */
  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-page"
      onPointerDown={globeClick.onPointerDown}
      onPointerUp={globeClick.onPointerUp}
    >
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
        // The answer, once shown, stands clear of the guesses around it —
        // a near guess is nearly its colour.
        polygonAltitude={(d) => {
          const { name } = (d as CountryFeature).properties;
          if ((result?.solved || result?.gaveUp) && name === result.answer)
            return 0.055;
          return guessed.has(name) ? 0.03 : 0.012;
        }}
        polygonsTransitionDuration={250}
        onPolygonHover={(polygon) =>
          globeClick.setHovered(polygon as CountryFeature | null)
        }
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <button
          onClick={handleBack}
          className="pointer-events-auto rounded-lg border border-white/10 bg-raised/90 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur transition-colors hover:text-zinc-100"
        >
          ← Modes
        </button>
      </div>

      {/* The prompt never eats a click meant for the globe, and stays out of
          its way: beside the globe on a wide screen, the
          bottom edge on a phone, where the globe fills the width. It sat top
          and centre, over the very part of the map the hunt was about. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto flex w-[min(20rem,calc(100vw-1.5rem))] flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-raised/90 px-5 py-3 text-center backdrop-blur lg:inset-x-auto lg:bottom-auto beside-globe lg:mx-0">
        {result?.solved || result?.gaveUp ? (
          <>
            <p
              className={`text-xs uppercase tracking-wider ${
                result?.solved ? "text-emerald-400/70" : "text-red-400/80"
              }`}
            >
              {result?.solved ? "Found it" : "It was"}
            </p>
            <p className="text-xl font-medium text-zinc-50 sm:text-2xl">
              {getCountryMeta(result.answer).displayName}
            </p>
            <p className="text-sm text-zinc-400">
              {guesses.length} {guesses.length === 1 ? "guess" : "guesses"} ·{" "}
              {scoreFor(result).toLocaleString()} points
            </p>
            {/*
              The trail, oldest first, so it reads as the hunt did.

              Drawn rather than written: as a run of text with letter-spacing
              it escaped the panel once a hard puzzle got past about thirty
              guesses, spilling squares out of the rounded box. Wrapped tiles
              stay inside it at any count. Capped as well, since forty guesses
              is a trail nobody reads to the end of — the tail is the part that
              closes in on the answer.
            */}
            <div className="mt-1.5 flex max-w-[15rem] flex-wrap justify-center gap-1">
              {guesses.length > MAX_TRAIL && (
                <span className="self-center text-xs tabular-nums text-zinc-500">
                  +{guesses.length - MAX_TRAIL}
                </span>
              )}
              {[...guesses]
                .reverse()
                .slice(-MAX_TRAIL)
                .map((g, i) => (
                  <span
                    key={`${g.name}-${i}`}
                    aria-hidden="true"
                    className="h-3 w-3 rounded-[2px]"
                    style={{ backgroundColor: heatColor(g.km) }}
                  />
                ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Find the mystery country
            </p>
            <p className="max-w-xs text-sm text-zinc-300">
              Name a country. The closer it is, the warmer it goes.
            </p>
            <form onSubmit={submit} className="pointer-events-auto mt-0.5 flex gap-2">
              <label htmlFor="guess" className="sr-only">
                Country name
              </label>
              {/* Filters as you type, the way the Name it box does. A bare
                  box made the spelling of "Central African Republic" part of
                  the puzzle. */}
              <div className="relative">
                <input
                  id="guess"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setHighlighted(-1);
                    setDidYouMean([]);
                  }}
                  onKeyDown={(e) =>
                    onKeyDown(e, tryGuess, () => tryGuess(typed))
                  }
                  placeholder="Country name"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  role="combobox"
                  aria-expanded={matches.length > 0}
                  aria-controls="guess-suggestions"
                  className="w-44 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
                />
                {matches.length > 0 && (
                  <ul
                    id="guess-suggestions"
                    role="listbox"
                    // Upwards on a phone, where the panel sits on the bottom
                    // edge and a list opening down would leave the screen.
                    className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-md border border-white/10 bg-raised text-left shadow-xl lg:bottom-auto lg:top-full lg:mb-0 lg:mt-1"
                  >
                    {matches.map((name, index) => (
                      <li
                        key={name}
                        role="option"
                        aria-selected={index === highlighted}
                        onMouseDown={(e) => {
                          // Before the input loses focus, so the click lands.
                          e.preventDefault();
                          tryGuess(name);
                        }}
                        onMouseEnter={() => setHighlighted(index)}
                        className={`cursor-pointer truncate px-2.5 py-1.5 text-sm text-zinc-200 ${
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
                className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
              >
                Guess
              </button>
            </form>
            {flash && <p className="text-xs text-amber-300/80">{flash}</p>}
            {didYouMean.length > 0 && (
              <p className="pointer-events-auto text-xs text-zinc-400">
                Did you mean{" "}
                {didYouMean.map((name, i) => (
                  <span key={name}>
                    {i > 0 && " or "}
                    <button
                      type="button"
                      onClick={() => tryGuess(name)}
                      className="text-teal-300 underline underline-offset-2 hover:text-teal-200"
                    >
                      {getCountryMeta(name).displayName}
                    </button>
                  </span>
                ))}
                ?
              </p>
            )}

            {/* The closest guesses so far, with the distance printed. The
                colour on the globe says warmer or colder; only a number says
                how much, and "0 km" is the one that tells you you're right
                next to it. Closest first, because the far ones stop mattering
                the moment you have a near one. */}
            {closest.length > 0 && (
              <div className="pointer-events-auto mt-1 w-full text-left">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {closest.length} {closest.length === 1 ? "guess" : "guesses"}
              </p>
              <ol className="mt-1 max-h-28 space-y-0.5 overflow-y-auto pr-1 text-xs lg:max-h-56">
                {closest.map((g) => (
                  <li key={g.name} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: heatColor(g.km) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-zinc-300">
                      {getCountryMeta(g.name).displayName}
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-500">
                      {g.km === 0 ? "touching" : `${g.km.toLocaleString()} km`}
                    </span>
                  </li>
                ))}
              </ol>
              </div>
            )}

            {/* Played down, and last: a way out of a puzzle you cannot get,
                not a button to reach for. */}
            <button
              onClick={giveUp}
              className="pointer-events-auto mt-0.5 text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
            >
              Give up and show me
            </button>
          </>
        )}
      </div>

      {/* What the colours mean. Without it a player had to work out for
          themselves that yellow is warmer than pale blue — Jou asked for a
          key. Built from the same stops the globe is painted with. */}
      {/* At the top on a phone, where the panel has the bottom edge. */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex flex-col items-center gap-2 px-4 lg:bottom-5 lg:top-auto">
        <div className="w-full max-w-xs rounded-lg border border-white/10 bg-raised/90 px-3 pb-1.5 pt-2 backdrop-blur">
          <div className="flex justify-between text-[11px] font-medium uppercase tracking-wider">
            <span className="text-red-400">Hot</span>
            <span className="text-blue-400">Cold</span>
          </div>
          <div
            aria-hidden="true"
            className="mt-1 h-2 rounded-full"
            style={{ background: heatGradient() }}
          />
          <div className="relative mt-1 h-4 text-[10px] tabular-nums text-zinc-500">
            {LEGEND_MARKS.map(({ km, at }, i) => (
              <span
                key={km}
                className="absolute top-0 whitespace-nowrap"
                style={{
                  left: `${at * 100}%`,
                  // The ends sit inside the bar rather than hanging off it.
                  transform:
                    i === 0
                      ? "none"
                      : i === LEGEND_MARKS.length - 1
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
              >
                {km === 0
                  ? "0 km"
                  : km >= MAX_SCALE_KM
                    ? `${km.toLocaleString()}+ km`
                    : km.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
        {result?.solved && (
          <p className="text-center text-sm text-zinc-500">
            {formatDay(day)} · a new mystery at midnight UTC
          </p>
        )}
      </div>

      {/* Only on the guess that solves it: a burst on every reload of a
          finished puzzle would be confetti for opening a page. */}
      <Celebrate burst={burst} count={90} />
      {leaving && (
        <ExitConfirm
          note="Your guesses won't be kept. You can start again from the menu."
          onFinish={leave}
          onKeepPlaying={() => setLeaving(false)}
        />
      )}

    </div>
  );
}
