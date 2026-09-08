import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { Link, useNavigate } from "react-router-dom";
import GuessModal from "./GuessModal";
import RoundSummary from "./RoundSummary";
import GameHud from "./GameHud";
import ExitConfirm from "./ExitConfirm";
import { useRound } from "./useRound";
import { recordRound } from "../../lib/countryStats";
import { useGlobeClick } from "./useGlobeClick";
import type { RoundOutcome } from "./FindGame";
import { getCountryMeta } from "../../data/countries";
import {
  BLITZ_SECONDS,
  recordKey,
  type Mode,
  type Ruleset,
} from "../../data/modes";
import { isCorrectGuess } from "../../lib/answerMatch";
import { theme } from "../../lib/globeTheme";
import { hintsEnabled } from "../../lib/prefs";
import { altitudeFor, featureCentre, type Geometry } from "../../lib/geo";


type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

const globeMaterial = new THREE.MeshPhongMaterial({
  color: theme.sphere,
  shininess: 0,
});

type Props = {
  mode: Mode;
  limitMs: number | null;
  ruleset: Ruleset;
  /** Told how the round went, for callers that report on it. */
  onRoundEnd?: (outcome: RoundOutcome) => void;
};

export default function GlobeGame({
  mode,
  limitMs,
  ruleset,
  onRoundEnd,
}: Props) {
  const navigate = useNavigate();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrongTimer = useRef<number | undefined>(undefined);
  const framed = useRef(false);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [guess, setGuess] = useState("");
  const [isWrong, setIsWrong] = useState(false);
  const [foundNames, setFoundNames] = useState<Set<string>>(new Set());
  /** Countries the player has answered for at least once. */
  const [attempted, setAttempted] = useState<Set<string>>(new Set());
  /** Countries they got wrong before getting them right. */
  const [fumbled, setFumbled] = useState<Set<string>>(new Set());
  /** Countries whose blitz clock ran out — they can't be answered again. */
  const [expired, setExpired] = useState<Set<string>>(new Set());
  /** Seconds left on the country being guessed, under blitz rules. */
  const [secondsLeft, setSecondsLeft] = useState(BLITZ_SECONDS);
  /** Where the keyboard cursor sits, for players who can't click the globe. */
  const [cursor, setCursor] = useState<number | null>(null);
  /** The first letter, once bought for the country currently being guessed. */
  const [hintLetter, setHintLetter] = useState<string | null>(null);

  // Read once: a preference changed mid-round shouldn't move the goalposts.
  const [hintsOn] = useState(hintsEnabled);
  const round = useRound(recordKey("name", mode.id, limitMs, ruleset), limitMs);
  const { begin, reset, tick, end, summary, correct, wrong, spendHint } =
    round;

  const resetRun = useCallback(() => {
    reset();
    setFoundNames(new Set());
    setExpired(new Set());
    setAttempted(new Set());
    setFumbled(new Set());
    setSelected(null);
    setGuess("");
    setIsWrong(false);
    setHintLetter(null);
    setExpired(new Set());
    setSecondsLeft(BLITZ_SECONDS);
  }, [reset]);

  useEffect(() => {
    // Switching modes starts a fresh round, and with it a fresh clock.
    resetRun();

    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load map data (${res.status})`);
        return res.json();
      })
      .then((data: { features: CountryFeature[] }) => {
        if (cancelled) return;
        setFeatures(
          data.features.filter((f) =>
            mode.includes(getCountryMeta(f.properties.name))
          )
        );
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, resetRun]);

  useEffect(() => () => window.clearTimeout(wrongTimer.current), []);

  // Frame the globe once the map arrives: on the region for a continent round,
  // or the familiar world view for the modes that span it.
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

  const suggestionNames = useMemo(
    () =>
      features
        .map((f) => getCountryMeta(f.properties.name).displayName)
        .sort((a, b) => a.localeCompare(b)),
    [features]
  );

  // Under blitz a country can be lost as well as found, and the round is over
  // once every country has gone one way or the other.
  const allFound =
    features.length > 0 && foundNames.size + expired.size === features.length;

  const endRun = useCallback(() => {
    end({
      found: foundNames.size,
      total: features.length,
      attempted: attempted.size,
      firstTry: [...attempted].filter((name) => !fumbled.has(name)).length,
    });
    setSelected(null);
  }, [end, foundNames.size, features.length, attempted, fumbled]);

  // The countdown reaching zero ends the round wherever the player is.
  useEffect(() => {
    if (round.timeUp) endRun();
  }, [round.timeUp, endRun]);

  // Finding the last country ends the round on its own.
  useEffect(() => {
    if (allFound) endRun();
  }, [allFound, endRun]);

  /**
   * Countries still to name, ordered west to east rather than alphabetically —
   * an alphabetical walk would hand the player the answers in order.
   */
  const selectable = useMemo(
    () =>
      features
        .filter(
          (f) =>
            !foundNames.has(f.properties.name) && !expired.has(f.properties.name)
        )
        .map((f) => ({ feature: f, centre: featureCentre(f.geometry) }))
        .sort((a, b) => a.centre.lng - b.centre.lng || a.centre.lat - b.centre.lat),
    [features, foundNames, expired]
  );

  /**
   * Keyboard play. The globe answers to the mouse only, so without this a
   * keyboard user could look at the map but never pick anything on it.
   */
  useEffect(() => {
    if (cursor === null || summary || selected) return;

    const onKey = (event: KeyboardEvent) => {
      const step =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;
      if (step !== 0) {
        event.preventDefault();
        setCursor((at) => {
          const count = selectable.length;
          return count ? ((at ?? 0) + step + count) % count : null;
        });
      } else if (event.key === "Enter" && selectable[cursor]) {
        event.preventDefault();
        setSelected(selectable[cursor].feature);
      } else if (event.key === "Escape") {
        setCursor(null);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, selectable, summary, selected]);

  // Turn the globe to whatever the cursor is on, so it can actually be seen.
  useEffect(() => {
    const at = cursor === null ? null : selectable[cursor];
    if (!at) return;
    globeRef.current?.pointOfView(
      { ...at.centre, altitude: altitudeFor(at.centre.span) },
      500
    );
  }, [cursor, selectable]);

  const cursorName =
    cursor !== null ? selectable[cursor]?.feature.properties.name : null;

  const reported = useRef(false);
  useEffect(() => {
    if (!summary || reported.current) return;
    reported.current = true;
    const got = [...fumbled].filter((name) => foundNames.has(name));
    // Only countries actually put to the player count towards their stats —
    // the rest of the map was never asked about.
    recordRound({
      seen: [...new Set([...attempted, ...expired])],
      found: [...foundNames],
      fumbled: got,
    });
    onRoundEnd?.({
      points: summary.points,
      ms: summary.ms,
      found: [...foundNames],
      fumbled: got,
      missed: features
        .map((f) => f.properties.name)
        .filter((name) => !foundNames.has(name)),
    });
  }, [summary, onRoundEnd, foundNames, fumbled, attempted, expired, features]);

  const closeModal = () => {
    setSelected(null);
    setGuess("");
    setIsWrong(false);
    setHintLetter(null);
    setSecondsLeft(BLITZ_SECONDS);
  };

  /** Blitz: the clock on the country currently open, which gives up on it. */
  useEffect(() => {
    if (ruleset !== "blitz" || !selected || summary) return;
    setSecondsLeft(BLITZ_SECONDS);
    const name = selected.properties.name;
    const id = window.setInterval(() => {
      setSecondsLeft((left) => {
        if (left > 1) return left - 1;
        window.clearInterval(id);
        setExpired((prev) => new Set(prev).add(name));
        closeModal();
        return BLITZ_SECONDS;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [ruleset, selected, summary]);

  /**
   * Buys the first letter of the country on screen. The continent is not on
   * offer here — the player is looking straight at it on the globe.
   */
  const handleHint = () => {
    if (!selected || hintLetter) return;
    spendHint("letter");
    setHintLetter(
      getCountryMeta(selected.properties.name).displayName.charAt(0).toUpperCase()
    );
  };

  const handleSubmit = (value: string) => {
    if (!selected || !value.trim()) return;

    const name = selected.properties.name;
    setAttempted((prev) => new Set(prev).add(name));

    const country = getCountryMeta(name);
    if (isCorrectGuess(value, country)) {
      setFoundNames((prev) => new Set(prev).add(country.geoName));
      correct();
      closeModal();
    } else {
      setFumbled((prev) => new Set(prev).add(name));
      wrong();
      if (ruleset === "sudden") {
        // The round is over; let the shake land before the summary appears.
        setIsWrong(true);
        window.clearTimeout(wrongTimer.current);
        wrongTimer.current = window.setTimeout(endRun, 700);
        return;
      }
      setIsWrong(true);
      window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setIsWrong(false), 600);
    }
  };

  /** The back arrow only interrupts when there is progress worth keeping. */
  const selectCountry = useCallback(
    (feature: CountryFeature) => {
      const { name } = feature.properties;
      if (summary || foundNames.has(name) || expired.has(name)) return;
      setSelected(feature);
    },
    [summary, foundNames, expired]
  );
  const globeClick = useGlobeClick<CountryFeature>(selectCountry);

  const handleBack = () => {
    if (summary || foundNames.size === 0) {
      navigate("/");
      return;
    }
    round.setConfirmingExit(true);
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
        polygonCapColor={(d) => {
          const { name } = (d as CountryFeature).properties;
          if (foundNames.has(name)) return theme.found;
          if (expired.has(name)) return theme.missed;
          if (name === cursorName) return theme.selected;
          // Once the run is over, everything left is shown as missed.
          if (summary) return theme.missed;
          if (selected && selected.properties.name === name)
            return theme.selected;
          return theme.unfound;
        }}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => theme.stroke}
        polygonAltitude={() => 0.012}
        polygonsTransitionDuration={0}
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
        onFinish={summary ? null : endRun}
      />

      {/* Hidden until focused: a mouse player never sees it, a keyboard player
          meets it as a tab stop. */}
      {!summary && features.length > 0 && (
        <div className="absolute inset-x-0 top-20 z-10 mx-auto w-fit">
          {cursor === null ? (
            <button
              onClick={() => setCursor(0)}
              className="sr-only rounded-md border border-white/20 bg-[#141b23] px-3 py-1.5 text-sm text-zinc-100 focus:not-sr-only focus:relative"
            >
              Pick a country with the keyboard
            </button>
          ) : (
            <p className="rounded-lg border border-white/10 bg-[#141b23]/90 px-4 py-2 text-center text-sm text-zinc-300 backdrop-blur">
              <b className="font-medium text-zinc-100">
                {cursorName ? getCountryMeta(cursorName).displayName : ""}
              </b>
              <span className="mx-2 text-zinc-600">·</span>
              arrows to move, enter to name it, esc to stop
            </p>
          )}
        </div>
      )}

      {round.confirmingExit && (
        <ExitConfirm
          found={foundNames.size}
          total={features.length}
          onFinish={endRun}
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
          onPlayAgain={resetRun}
          onReviewMap={() => round.setReviewingMap(true)}
        />
      )}

      <GuessModal
        open={selected !== null}
        hintLetter={hintLetter}
        secondsLeft={ruleset === "blitz" ? secondsLeft : null}
        onHint={hintsOn ? handleHint : null}
        names={suggestionNames}
        value={guess}
        isWrong={isWrong}
        onChange={setGuess}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />
    </div>
  );
}
