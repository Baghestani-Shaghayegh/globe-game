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
import { resolveName } from "../lib/answerMatch";
import { landShade, theme } from "../lib/globeTheme";
import { landMaterial } from "../lib/globeTerrain";
import { featureCentre, type Geometry, worldAltitude } from "../lib/geo";
import { dayKey, formatDay } from "../lib/daily";
import Celebrate from "../components/Celebrate";
import { playSolved, playWarm, playWrong, playLose } from "../lib/sound";
import {
  closeness,
  distanceKm,
  heatColor,
  loadMystery,
  mysteryFor,
  mysteryNumber,
  postMysteryScore,
  saveMystery,
  scoreFor,
  type MysteryResult,
  type Point,
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
    [result, answer, guessed, centres]
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!result || result.solved) return;
    // An empty box is not a wrong guess — it is no guess. Submitting one used
    // to answer "No country called """, which is a sentence about nothing.
    if (!typed.trim()) return;
    const name = resolveName(typed, playable);
    if (!name) {
      setFlash("No country called");
      playWrong();
      return;
    }
    setTyped("");
    guess(name);
  };

  // Hovering still names a country, which is worth keeping: it is how someone
  // finds out what they are looking at in order to type it.
  const globeClick = useGlobeClick<CountryFeature>(() => {});

  const capColor = useMemo(
    () => (d: object) => {
      const { name } = (d as CountryFeature).properties;
      const over = result?.solved || result?.gaveUp;
      if (over && name === result?.answer)
        // Green when it was found, amber when it was handed over — the same
        // colour a revealed answer takes everywhere else in the game.
        return landMaterial(
          result?.solved ? theme.found : theme.selected,
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
      className="relative h-screen w-screen overflow-hidden bg-[#07111c]"
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
        polygonAltitude={(d) =>
          guessed.has((d as CountryFeature).properties.name) ? 0.03 : 0.012
        }
        polygonsTransitionDuration={250}
        onPolygonHover={(polygon) =>
          globeClick.setHovered(polygon as CountryFeature | null)
        }
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <button
          onClick={handleBack}
          className="pointer-events-auto rounded-lg border border-white/10 bg-[#141b23]/90 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur transition-colors hover:text-zinc-100"
        >
          ← Modes
        </button>
        <div className="rounded-lg border border-white/10 bg-[#141b23]/90 px-3 py-1.5 text-right text-sm backdrop-blur">
          <p className="font-medium text-zinc-100">Mystery country</p>
          <p className="text-xs tabular-nums text-zinc-500">
            {guesses.length} {guesses.length === 1 ? "guess" : "guesses"}
          </p>
        </div>
      </div>

      {/* The prompt sits over the globe but never eats a click meant for it. */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-[#141b23]/90 px-5 py-3 text-center backdrop-blur">
        {result?.solved || result?.gaveUp ? (
          <>
            <p
              className={`text-xs uppercase tracking-wider ${
                result?.solved ? "text-emerald-400/70" : "text-amber-400/70"
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
              <input
                id="guess"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Country name"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                className="w-44 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
              />
              <button
                type="submit"
                className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
              >
                Guess
              </button>
            </form>
            {flash && <p className="text-xs text-amber-300/80">{flash}</p>}
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

      {result?.solved && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 z-10 text-center text-sm text-zinc-500">
          {formatDay(day)} · a new mystery at midnight UTC
        </p>
      )}

      {/* Only on the guess that solves it: a burst on every reload of a
          finished puzzle would be confetti for opening a page. */}
      <Celebrate burst={burst} count={90} />
      {leaving && (
        <ExitConfirm onFinish={leave} onKeepPlaying={() => setLeaving(false)} />
      )}

    </div>
  );
}
