import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { Link, useNavigate } from "react-router-dom";
import { useViewport } from "../lib/useViewport";
import ExitConfirm from "../features/globe-guess/ExitConfirm";
import { useLeaveGuard } from "../features/globe-guess/useLeaveGuard";
import { useGlobeClick } from "../features/globe-guess/useGlobeClick";
import { useGlobeTheme } from "../features/globe-guess/useGlobeTheme";
import { GLOBE_SURFACE, useGlobeLook } from "../features/globe-guess/useGlobeLook";
import { useSuggestions } from "../features/globe-guess/useSuggestions";
import { useReplayCamera } from "../features/globe-guess/useReplayCamera";
import { CARD_FOUND, CARD_MISSED } from "../features/globe-guess/RoundShare";
import RecordSwitch from "../features/replay/RecordSwitch";
import ReplayActions from "../features/replay/ReplayActions";
import Celebrate from "../components/Celebrate";
import ShareResult from "../components/ShareResult";
import SignInNudge from "../components/SignInNudge";
import { cluesGrid } from "../lib/shareGrid";
import { getCountryMeta } from "../data/countries";
import { nearestNames, resolveName } from "../lib/answerMatch";
import { landShade, theme } from "../lib/globeTheme";
import { landMaterial } from "../lib/globeTerrain";
import { featureCentre, type Geometry, worldAltitude } from "../lib/geo";
import { dayKey, dayNumber, formatDay } from "../lib/daily";
import { keepReplay, recordingOn, ReplayRecorder, todaysReplay, type Replay } from "../lib/replay";
import { END_HOLD_MS } from "../lib/replayFrame";
import { playLose, playSolved, playStep, playWrong } from "../lib/sound";
import {
  CLUE_COUNT,
  CLUES_BUCKET,
  clueMarks,
  cluePuzzleFor,
  cluesShown,
  dailyClues,
  foundOn,
  loadClues,
  play,
  postCluesScore,
  saveClues,
  scoreFor,
  type CluesResult,
} from "../lib/fiveClues";
import { siteHost } from "../lib/site";
import ClearButton from "../components/ClearButton";

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

const display = (name: string) => getCountryMeta(name).displayName;

/** The whole-world view, sized to this window. Shared by every game. */
const worldView = () => worldAltitude(window.innerWidth, window.innerHeight);

/** The share image's square for a clue nobody needed. */
const CARD_UNUSED = "#3f3f46";
const CARD_SKIPPED = "#71717a";

export default function FiveClues() {
  useGlobeTheme();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const viewport = useViewport();
  const [ready, setReady] = useState(false);
  const ocean = useGlobeLook(globeRef, ready);
  const day = useMemo(dayKey, []);
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<CluesResult | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

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

  // Sovereign countries only, so the answer is never a territory.
  const pool = useMemo(
    () =>
      features
        .map((f) => f.properties.name)
        .filter((name) => getCountryMeta(name).tier === "country"),
    [features]
  );
  const answer = useMemo(() => cluePuzzleFor(day, pool), [day, pool]);
  const clues = useMemo(() => (answer ? dailyClues(answer) : []), [answer]);

  const centres = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    for (const f of features) map.set(f.properties.name, featureCentre(f.geometry));
    return map;
  }, [features]);

  // The round as it's played, to watch back and post.
  const recorder = useRef<ReplayRecorder | null>(null);
  const [recorded, setRecorded] = useState<{
    replay: Replay;
    /** Only a find goes on the board. */
    postedId?: () => Promise<number | null>;
  } | null>(null);

  // Only a finished round comes back. One left part-way starts again from
  // nothing, as all the dailies do: leaving doesn't use up the day.
  useEffect(() => {
    if (!answer) return;
    const loaded = loadClues(day);
    const saved = loaded && (loaded.solved || loaded.lost) ? loaded : null;
    recorder.current = saved ? null : new ReplayRecorder();
    if (saved) {
      const kept = todaysReplay(day, (game) => game.type === "clues");
      if (kept) setRecorded({ replay: kept });
    }
    setResult(
      saved ?? {
        day,
        number: dayNumber(day),
        answer,
        guesses: [],
        solved: false,
        startedAt: Date.now(),
      }
    );
  }, [day, answer]);

  useEffect(() => {
    if (!ready) return;
    globeRef.current?.pointOfView({ lat: 15, lng: 10, altitude: worldView() }, 0);
  }, [ready]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !ready) return;
    const at = globe.pointOfView();
    globe.pointOfView({ lat: at.lat, lng: at.lng, altitude: worldView() }, 0);
  }, [viewport.width, viewport.height, ready]);

  const over = !!result && (result.solved || !!result.lost);
  const playing = !!result && !over;

  const look = useCallback(
    (lat: number, lng: number, altitude: number, force?: boolean) =>
      recorder.current?.look(lat, lng, altitude, force),
    []
  );
  const [filming, setFilming] = useState(false);
  useEffect(() => {
    if (playing) setFilming(true);
  }, [playing]);
  useReplayCamera(globeRef, ready && filming, look);

  /** Closes the recording a beat after the end, once the globe has turned. */
  const finishRecording = useCallback((next: CluesResult, posted: Promise<number | null>) => {
    const rec = recorder.current;
    if (!rec) return;
    const ms = next.ms ?? 0;
    window.setTimeout(() => {
      if (recorder.current === rec) recorder.current = null;
      setFilming(false);
      if (!recordingOn()) return;
      const replay = rec.finish(
        {
          type: "clues",
          mode: "daily",
          label: `Five clues #${next.number}`,
          bucket: CLUES_BUCKET,
          answer: next.answer,
        },
        { ms, points: scoreFor(next), found: next.solved ? 1 : 0, total: 1 }
      );
      keepReplay(replay);
      setRecorded({ replay, postedId: next.solved ? () => posted : undefined });
    }, END_HOLD_MS);
  }, []);

  /** A guess, or with null, the next clue turned over without one. */
  const take = useCallback(
    (guess: string | null) => {
      if (!result || !playing) return;
      if (guess && result.guesses.includes(guess)) {
        setFlash(`Already guessed ${display(guess)}.`);
        playWrong();
        return;
      }
      const next = play(result, guess);
      saveClues(next);
      setResult(next);
      setFlash(null);
      const rec = recorder.current;

      if (next.solved) {
        rec?.mark(["ok", next.answer, scoreFor(next)]);
        finishRecording(next, postCluesScore(next));
        playSolved();
        setBurst((n) => n + 1);
      } else {
        rec?.mark(["x", guess]);
        if (next.lost) {
          rec?.mark(["p", next.answer]);
          finishRecording(next, Promise.resolve(null));
          playLose();
        } else {
          rec?.mark(["h", "clue"]);
          if (guess) playWrong();
          else playStep(next.guesses.length * 2);
        }
      }

      // Turn to what was named, so a miss is seen; to the answer at the end.
      const to = next.solved || next.lost ? centres.get(next.answer) : guess ? centres.get(guess) : null;
      if (to) {
        globeRef.current?.pointOfView(
          { ...to, altitude: next.solved || next.lost ? 1.6 : worldView() },
          next.solved || next.lost ? 900 : 700
        );
      }
    },
    [result, playing, centres, finishRecording]
  );

  // ---- Typing a guess, with the list under the box ------------------------
  const [typed, setTyped] = useState("");
  const playable = useMemo(() => features.map((f) => f.properties.name), [features]);
  const suggestable = useMemo(() => playable.map(getCountryMeta), [playable]);
  const { matches, highlighted, setHighlighted, onKeyDown } = useSuggestions(suggestable, typed, 5);
  const [didYouMean, setDidYouMean] = useState<string[]>([]);

  const tryGuess = (text: string) => {
    if (!playing || !text.trim()) return;
    const name = resolveName(text, playable);
    if (!name) {
      setFlash(`No country called "${text.trim()}"`);
      setDidYouMean(nearestNames(text, playable));
      playWrong();
      return;
    }
    setTyped("");
    setDidYouMean([]);
    setHighlighted(-1);
    take(name);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    tryGuess(typed);
  };

  const globeClick = useGlobeClick<CountryFeature>(() => {});

  const capColor = useMemo(
    () => (d: object) => {
      const { name } = (d as CountryFeature).properties;
      if (result && over && name === result.answer) {
        return landMaterial(result.solved ? theme.found : theme.selected, "answer");
      }
      if (result?.guesses.includes(name)) return landMaterial(theme.missed, "answer");
      return landMaterial(landShade(name));
    },
    [result, over]
  );

  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const goingSomewhere = useRef(false);
  const inProgress = playing && (result?.guesses.length ?? 0) > 0;
  useLeaveGuard(inProgress && !goingSomewhere.current, () => setLeaving(true));
  const leave = () => {
    goingSomewhere.current = true;
    navigate("/");
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page px-6">
        <p className="text-zinc-100">Couldn't load the map data.</p>
        <Link to="/" className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100">
          Back to modes
        </Link>
      </div>
    );
  }

  const shown = result ? cluesShown(result) : 1;
  const on = result ? foundOn(result) : null;
  const misses = (result?.guesses ?? []).filter((g): g is string => !!g && g !== result?.answer);

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
        polygonAltitude={(d) => {
          const { name } = (d as CountryFeature).properties;
          if (over && name === result?.answer) return 0.055;
          return result?.guesses.includes(name) ? 0.03 : 0.012;
        }}
        polygonsTransitionDuration={250}
        onPolygonHover={(polygon) => globeClick.setHovered(polygon as CountryFeature | null)}
      />


      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <button
          onClick={() => (inProgress ? setLeaving(true) : leave())}
          className="pointer-events-auto rounded-lg border border-white/10 bg-raised/90 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur transition-colors hover:text-zinc-100"
        >
          ← Modes
        </button>
        {playing && <RecordSwitch />}
      </div>

      {/* The clues, the box and the result: on the bottom edge on a phone,
          beside the globe on a wide screen, as in the other dailies. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto flex max-h-[62vh] w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-raised/90 px-4 py-3 backdrop-blur lg:inset-x-auto lg:bottom-auto lg:left-4 lg:top-16 lg:mx-0 lg:max-h-[calc(100vh-5rem)]">
        <p className="text-center text-xs uppercase tracking-wider text-zinc-500">
          Five clues · #{result?.number ?? dayNumber(day)}
        </p>

        {over && result && (
          <div className="text-center">
            <p className={`text-xs uppercase tracking-wider ${result.solved ? "text-emerald-400/80" : "text-amber-300/80"}`}>
              {result.solved ? `Found it on clue ${on}` : "It was"}
            </p>
            <p className="text-xl font-medium text-zinc-50 sm:text-2xl">{display(result.answer)}</p>
            <p className="text-sm text-zinc-400">{scoreFor(result).toLocaleString()} points</p>
          </div>
        )}

        <ol className="space-y-1.5">
          {clues.slice(0, shown).map((clue, i) => {
            const current = playing && i === shown - 1;
            const mark = result?.guesses[i];
            return (
              <li
                key={i}
                className={`flex gap-2.5 rounded-lg px-3 py-2 text-sm ${
                  current
                    ? "bg-amber-300/15 text-zinc-50 ring-1 ring-amber-300/50"
                    : "bg-white/[0.04] text-zinc-300"
                }`}
              >
                <span
                  className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold ${
                    over && mark === result?.answer
                      ? "bg-emerald-400 text-emerald-950"
                      : mark
                        ? "bg-rose-400 text-rose-950"
                        : mark === null
                          ? "bg-zinc-500 text-zinc-950"
                          : current
                            ? "bg-amber-300 text-amber-950"
                            : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {i + 1}
                </span>
                <span>{clue}</span>
              </li>
            );
          })}
        </ol>
        {/* The clues still face down, small: on a phone the panel shares the
            screen with the globe. */}
        {playing && shown < CLUE_COUNT && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
            {Array.from({ length: CLUE_COUNT - shown }, (_, i) => (
              <span
                key={i}
                className="flex h-5 w-5 items-center justify-center rounded bg-white/10 font-bold text-zinc-400"
              >
                {shown + i + 1}
              </span>
            ))}
            <span className="ml-1">to come</span>
          </p>
        )}

        {playing && (
          <>
            <form onSubmit={submit} className="pointer-events-auto mt-1 flex gap-2">
              <label htmlFor="clue-guess" className="sr-only">
                Country name
              </label>
              <div className="relative min-w-0 flex-1">
                <input
                  id="clue-guess"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setHighlighted(-1);
                    setDidYouMean([]);
                  }}
                  onKeyDown={(e) => onKeyDown(e, tryGuess, () => tryGuess(typed))}
                  placeholder="Country name"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  role="combobox"
                  aria-expanded={matches.length > 0}
                  aria-controls="clue-suggestions"
                  className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 pr-8 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
                />
                <ClearButton
                  show={typed !== ""}
                  inputId="clue-guess"
                  onClear={() => {
                    setTyped("");
                    setHighlighted(-1);
                    setDidYouMean([]);
                  }}
                />
                {matches.length > 0 && (
                  <ul
                    id="clue-suggestions"
                    role="listbox"
                    className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-md border border-white/10 bg-raised text-left shadow-xl lg:bottom-auto lg:top-full lg:mb-0 lg:mt-1"
                  >
                    {matches.map((name, index) => (
                      <li
                        key={name}
                        role="option"
                        aria-selected={index === highlighted}
                        onMouseDown={(e) => {
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
            {flash && <p className="text-center text-xs text-amber-300/80">{flash}</p>}
            {didYouMean.length > 0 && (
              <p className="pointer-events-auto text-center text-xs text-zinc-400">
                Did you mean{" "}
                {didYouMean.map((name, i) => (
                  <span key={name}>
                    {i > 0 && " or "}
                    <button
                      type="button"
                      onClick={() => tryGuess(name)}
                      className="text-teal-300 underline underline-offset-2 hover:text-teal-200"
                    >
                      {display(name)}
                    </button>
                  </span>
                ))}
                ?
              </p>
            )}
            {misses.length > 0 && (
              <p className="flex flex-wrap justify-center gap-1.5">
                {misses.map((name) => (
                  <span key={name} className="rounded-full bg-rose-400/15 px-2 py-0.5 text-xs text-rose-300">
                    ✗ {display(name)}
                  </span>
                ))}
              </p>
            )}
            {/* A guess spent to see more: played down, like the give-up in
                the mystery. On the last clue it gives the answer instead. */}
            <button
              onClick={() => take(null)}
              className="pointer-events-auto self-center text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
            >
              {shown < CLUE_COUNT ? `Skip to clue ${shown + 1}` : "Give up and show me"}
            </button>
          </>
        )}

        {over && result && result.day === day && (
          <div className="pointer-events-auto mt-1 border-t border-white/[0.07] pt-3">
            <ShareResult
              replay={recorded?.replay}
              text={
                on
                  ? `I got today's GuessGlobe Five clues on clue ${on}.`
                  : "Today's GuessGlobe Five clues beat me."
              }
              filename={`guessglobe-clues-${result.day}.png`}
              path={`/clues?d=${result.number}`}
              grid={cluesGrid(clueMarks(result))}
              card={(features) => ({
                eyebrow: `Five clues #${result.number}`,
                title: on ? `Clue ${on} of ${CLUE_COUNT}` : "Not found",
                subtitle: formatDay(result.day),
                // How each clue went, and nothing that names the answer: the
                // card goes to people who haven't played.
                tiles: clueMarks(result).map((m) =>
                  m === "found" ? CARD_FOUND : m === "missed" ? CARD_MISSED : m === "skipped" ? CARD_SKIPPED : CARD_UNUSED
                ),
                globe: features ? { features, colors: {} } : undefined,
                site: siteHost(),
              })}
            />
          </div>
        )}
        {over && <SignInNudge />}
        {recorded && (
          <div className="pointer-events-auto border-t border-white/[0.07] pt-3">
            <ReplayActions replay={recorded.replay} postedId={recorded.postedId} />
          </div>
        )}
        {over && (
          <p className="text-center text-xs text-zinc-600">{formatDay(day)} · new clues at midnight UTC</p>
        )}
      </div>

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
