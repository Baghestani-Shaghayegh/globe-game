import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { Link, useNavigate } from "react-router-dom";
import RoundSummary from "./RoundSummary";
import GameHud from "./GameHud";
import ExitConfirm from "./ExitConfirm";
import { useRound } from "./useRound";
import { useGlobeClick } from "./useGlobeClick";
import { getCountryMeta } from "../../data/countries";
import {
  BLITZ_SECONDS,
  recordKey,
  type GameType,
  type Mode,
  type Ruleset,
} from "../../data/modes";
import { flagUrl } from "../../data/flags";
import { cluesFor } from "../../data/clues";
import { HINT_COST } from "../../lib/scoring";
import { hintsEnabled } from "../../lib/prefs";
import { theme } from "../../lib/globeTheme";
import type { Continent } from "../../data/continents";
import { altitudeFor, featureCentre, type Geometry } from "../../lib/geo";

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

const globeMaterial = new THREE.MeshPhongMaterial({
  color: theme.sphere,
  shininess: 0,
});

/** Long enough to fly the camera to the answer and let it register. */
const FLIGHT_MS = 800;
const REVEAL_HOLD_MS = 1300;
/** Flying back is quicker — it happens while the next country is being read. */
const RETURN_MS = 700;

/** Fisher-Yates, so each round asks for the countries in a different order. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Props = {
  mode: Mode;
  limitMs: number | null;
  ruleset: Ruleset;
  /** What the prompt shows: a name, a flag, or a clue. */
  type: GameType;
};

/**
 * The globe round. The game poses a country — by name, by its flag, or by
 * something it is famous for — and the player clicks it on the globe. Only the
 * prompt differs between the three; everything else is one game.
 */
export default function FindGame({ mode, limitMs, ruleset, type }: Props) {
  const navigate = useNavigate();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrongTimer = useRef<number | undefined>(undefined);
  const framed = useRef(false);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  /** Names still to ask for, in the order they'll be asked. */
  const [queue, setQueue] = useState<string[]>([]);
  const [foundNames, setFoundNames] = useState<Set<string>>(new Set());
  const [passedNames, setPassedNames] = useState<Set<string>>(new Set());
  const [guesses, setGuesses] = useState(0);
  /** The country just clicked in error, flashed red for a moment. */
  const [wrongName, setWrongName] = useState<string | null>(null);
  /** The answer, revealed after a pass. */
  const [revealed, setRevealed] = useState<string | null>(null);
  /** Seconds left on this country under blitz rules. */
  const [secondsLeft, setSecondsLeft] = useState(BLITZ_SECONDS);
  /** Narrowed to the target's continent, once that hint is bought. */
  const [narrowedTo, setNarrowedTo] = useState<Continent | null>(null);
  /** How many of this country's clues have been shown, in a famous-for round. */
  const [cluesShown, setCluesShown] = useState(1);

  // Read once: a preference changed mid-round shouldn't move the goalposts.
  const [hintsOn] = useState(hintsEnabled);
  const round = useRound(recordKey(type, mode.id, limitMs, ruleset), limitMs);
  const { begin, reset, tick, end, summary, correct, wrong, spendHint } =
    round;

  useEffect(() => {
    reset();
    setFoundNames(new Set());
    setPassedNames(new Set());
    setQueue([]);
    setGuesses(0);
    setWrongName(null);
    setRevealed(null);
    setNarrowedTo(null);
    setCluesShown(1);

    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load map data (${res.status})`);
        return res.json();
      })
      .then((data: { features: CountryFeature[] }) => {
        if (cancelled) return;
        // A flag round can only ask for countries that have a flag, and a
        // famous-for round only for those someone has written a clue about.
        const playable = data.features.filter((f) => {
          const meta = getCountryMeta(f.properties.name);
          if (!mode.includes(meta)) return false;
          if (type === "flag") return flagUrl(meta.geoName) !== null;
          if (type === "famous") return cluesFor(meta.geoName).length > 0;
          return true;
        });
        setFeatures(playable);
        setQueue(shuffled(playable.map((f) => f.properties.name)));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, reset, type]);

  useEffect(() => () => window.clearTimeout(wrongTimer.current), []);

  useEffect(() => {
    if (!features.length || framed.current) return;
    globeRef.current?.pointOfView(
      mode.view ?? { lat: 12, lng: 20, altitude: 2.1 },
      0
    );
    framed.current = true;
  }, [features, mode]);

  useEffect(() => {
    if (features.length) begin();
  }, [features, begin]);

  useEffect(() => {
    if (!features.length || summary) return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [features.length, summary, tick]);

  const target = queue[0] ?? null;
  const targetLabel = target ? getCountryMeta(target).displayName : "";

  const endRound = useCallback(() => {
    end({ found: foundNames.size, total: features.length, guesses });
  }, [end, foundNames.size, features.length, guesses]);

  // The countdown reaching zero ends the round wherever the player is.
  useEffect(() => {
    if (round.timeUp) endRound();
  }, [round.timeUp, endRound]);

  // Nothing left to ask means the round is over.
  useEffect(() => {
    if (features.length > 0 && queue.length === 0) endRound();
  }, [features.length, queue.length, endRound]);

  const advance = () => {
    setQueue((prev) => prev.slice(1));
    setWrongName(null);
    setNarrowedTo(null);
    setCluesShown(1);
    setSecondsLeft(BLITZ_SECONDS);
  };

  /** Blitz: the clock on a single country, which passes it when it runs out. */
  useEffect(() => {
    if (ruleset !== "blitz" || !target || summary || revealed) return;
    const id = window.setInterval(() => {
      setSecondsLeft((left) => {
        if (left > 1) return left - 1;
        window.clearInterval(id);
        setPassedNames((prev) => new Set(prev).add(target));
        advance();
        return BLITZ_SECONDS;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [ruleset, target, summary, revealed]);

  /** Buys the next clue for this country, while there is one left. */
  const handleAnotherClue = () => {
    if (!target || revealed) return;
    if (cluesShown >= cluesFor(target).length) return;
    spendHint("letter");
    setCluesShown((shown) => shown + 1);
  };

  /** Narrows the search to the target's continent, for a price. */
  const handleNarrow = () => {
    if (!target || narrowedTo || revealed) return;
    spendHint("region");
    setNarrowedTo(getCountryMeta(target).continents[0]);
  };

  const handleClick = (name: string) => {
    if (summary || !target || revealed) return;
    setGuesses((n) => n + 1);

    if (name === target) {
      setFoundNames((prev) => new Set(prev).add(name));
      correct();
      advance();
      return;
    }

    // Wrong country — flash it, and leave the same target in place to retry.
    wrong();
    setWrongName(name);
    window.clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(
      ruleset === "sudden" ? endRound : () => setWrongName(null),
      ruleset === "sudden" ? 700 : 600
    );
  };

  /**
   * Gives up on the current country: turns the globe to it and lights it up,
   * then moves on. Without the camera move the answer is often on the far side
   * of the globe, so the player never sees it.
   */
  const handlePass = () => {
    if (!target || revealed) return;

    // Remember where the player was looking, so they get their view back
    // rather than being left zoomed in on the country they just missed.
    const origin = globeRef.current?.pointOfView();
    const feature = features.find((f) => f.properties.name === target);
    if (feature) {
      const { lat, lng, span } = featureCentre(feature.geometry);
      globeRef.current?.pointOfView(
        { lat, lng, altitude: altitudeFor(span) },
        FLIGHT_MS
      );
    }

    spendHint("answer");
    setPassedNames((prev) => new Set(prev).add(target));
    setRevealed(target);
    window.clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => {
      setRevealed(null);
      advance();
      // Pulls back while the next country is being read, so it costs no time.
      if (origin) globeRef.current?.pointOfView(origin, RETURN_MS);
    }, FLIGHT_MS + REVEAL_HOLD_MS);
  };

  const globeClick = useGlobeClick<CountryFeature>((feature) =>
    handleClick(feature.properties.name)
  );

  const handleBack = () => {
    if (summary || foundNames.size === 0) {
      navigate("/");
      return;
    }
    round.setConfirmingExit(true);
  };

  const playAgain = () => {
    reset();
    setFoundNames(new Set());
    setPassedNames(new Set());
    setGuesses(0);
    setWrongName(null);
    setRevealed(null);
    setNarrowedTo(null);
    setCluesShown(1);
    setQueue(shuffled(features.map((f) => f.properties.name)));
  };

  const capColor = useMemo(
    () => (d: object) => {
      const { name } = (d as CountryFeature).properties;
      if (name === wrongName) return theme.missed;
      if (name === revealed) return theme.selected;
      if (foundNames.has(name)) return theme.found;
      if (summary) return passedNames.has(name) ? theme.missed : theme.unfound;
      if (narrowedTo && !getCountryMeta(name).continents.includes(narrowedTo))
        return theme.sphere;
      return theme.unfound;
    },
    [wrongName, revealed, foundNames, passedNames, summary, narrowedTo]
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

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[#07111c]"
      onPointerDown={globeClick.onPointerDown}
      onPointerUp={globeClick.onPointerUp}
    >
      <Globe
        ref={globeRef}
        rendererConfig={{
          antialias: true,
          alpha: true,
          logarithmicDepthBuffer: true,
        }}
        backgroundColor={theme.page}
        globeMaterial={globeMaterial}
        atmosphereColor={theme.atmosphere}
        atmosphereAltitude={0.14}
        polygonsData={features}
        polygonCapColor={capColor}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => theme.stroke}
        polygonAltitude={(d) =>
          (d as CountryFeature).properties.name === revealed ? 0.06 : 0.012
        }
        polygonsTransitionDuration={200}
        onPolygonHover={(polygon) =>
          globeClick.setHovered(polygon as CountryFeature | null)
        }
      />

      <GameHud
        onBack={handleBack}
        found={foundNames.size}
        total={features.length}
        ms={round.displayMs}
        countdown={round.countdown}
        modeLabel={mode.label}
        modeLevel={mode.level}
        points={round.score.points}
        streak={round.score.streak}
        onFinish={summary ? null : endRound}
      />

      {!summary && target && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-20 z-10 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-[#141b23]/90 px-5 py-2.5 text-center backdrop-blur ${
            wrongName ? "animate-shake" : ""
          }`}
        >
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {revealed
              ? "It was here"
              : type === "flag"
                ? "Whose flag?"
                : type === "famous"
                  ? "Famous for"
                  : "Find"}
          </p>
          {ruleset === "blitz" && !revealed && (
            <p
              className={`text-xs font-medium tabular-nums ${
                secondsLeft <= 5 ? "text-rose-400" : "text-zinc-400"
              }`}
              aria-label="Seconds left on this country"
            >
              {secondsLeft}s
            </p>
          )}

          {/* The prompt itself — the only part that differs between the three. */}
          {type === "flag" && !revealed && target && (
            <img
              src={flagUrl(target) ?? ""}
              alt="Flag of the country to find"
              width={112}
              height={84}
              className="w-28 rounded border border-white/15 shadow-lg"
            />
          )}

          {type === "famous" && !revealed && target ? (
            <ul className="flex max-w-sm flex-col gap-1.5">
              {cluesFor(target)
                .slice(0, cluesShown)
                .map((clue) => (
                  <li
                    key={clue}
                    className="text-base font-medium text-zinc-50 sm:text-lg"
                  >
                    {clue}
                  </li>
                ))}
            </ul>
          ) : (
            (type !== "flag" || revealed !== null) && (
              <p className="text-xl font-medium text-zinc-50 sm:text-2xl">
                {targetLabel}
              </p>
            )
          )}

          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 text-xs">
            {hintsOn &&
              type === "famous" &&
              target &&
              cluesShown < cluesFor(target).length && (
                <button
                  onClick={handleAnotherClue}
                  disabled={revealed !== null}
                  className="text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300 disabled:no-underline disabled:opacity-40"
                  >
                  Another clue{" "}
                  <span className="text-zinc-600">−{HINT_COST.letter}</span>
                </button>
              )}
            {hintsOn && !narrowedTo && (
              <button
                onClick={handleNarrow}
                disabled={revealed !== null}
                className="text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300 disabled:no-underline disabled:opacity-40"
              >
                Narrow it down{" "}
                <span className="text-zinc-600">−{HINT_COST.region}</span>
              </button>
            )}
            {/* Always offered, even with hints off: it is the way past a
                country you cannot find, not a tip. */}
            <button
              onClick={handlePass}
              disabled={revealed !== null}
              className="text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300 disabled:no-underline disabled:opacity-40"
            >
              Show me <span className="text-zinc-600">−{HINT_COST.answer}</span>
            </button>
          </div>
        </div>
      )}

      {round.confirmingExit && (
        <ExitConfirm
          found={foundNames.size}
          total={features.length}
          onFinish={endRound}
          onKeepPlaying={() => round.setConfirmingExit(false)}
          onDiscard={() => navigate("/")}
        />
      )}

      {summary && round.reviewingMap && (
        <div className="absolute inset-x-0 bottom-6 z-20 mx-auto flex w-fit items-center gap-3 rounded-full border border-white/10 bg-[#141b23]/90 py-2 pl-4 pr-2 text-sm backdrop-blur">
          <span className="flex items-center gap-2 text-zinc-400">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: theme.missed }}
            />
            {summary.total - summary.found} missed
          </span>
          <button
            onClick={() => round.setReviewingMap(false)}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            Show summary
          </button>
        </div>
      )}

      {summary && !round.reviewingMap && (
        <RoundSummary
          completed={summary.completed}
          outOfTime={round.countdown && !summary.completed}
          endedOnMistake={ruleset === "sudden" && !summary.completed}
          ms={summary.ms}
          points={summary.points}
          bestStreak={summary.bestStreak}
          found={summary.found}
          total={summary.total}
          accuracy={summary.accuracy}
          isBest={summary.isBest}
          previousBest={summary.previousBest}
          missedCount={summary.total - summary.found}
          onPlayAgain={playAgain}
          onReviewMap={() => round.setReviewingMap(true)}
        />
      )}
    </div>
  );
}
