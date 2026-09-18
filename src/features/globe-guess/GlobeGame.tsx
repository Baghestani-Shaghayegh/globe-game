import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useViewport } from "../../lib/useViewport";
import { Link, useNavigate } from "react-router-dom";
import GuessModal from "./GuessModal";
import RoundSummary from "./RoundSummary";
import GameHud from "./GameHud";
import ExitConfirm from "./ExitConfirm";
import ConfirmDialog from "./ConfirmDialog";
import { useRound } from "./useRound";
import { recordRound } from "../../lib/countryStats";
import { useGlobeClick } from "./useGlobeClick";
import { useLeaveGuard } from "./useLeaveGuard";
import type { RoundOutcome } from "./FindGame";
import { getCountryMeta } from "../../data/countries";
import {
  BLITZ_SECONDS,
  recordKey,
  type Mode,
  type Ruleset,
} from "../../data/modes";
import { isCorrectGuess } from "../../lib/answerMatch";
import { canAfford } from "../../lib/scoring";
import {
  answerStroke,
  backdropColor,
  landShade,
  theme,
} from "../../lib/globeTheme";
import { landMaterial } from "../../lib/globeTerrain";
import { useGlobeTheme } from "./useGlobeTheme";
import { GLOBE_SURFACE, useGlobeLook } from "./useGlobeLook";
import { hintsEnabled } from "../../lib/prefs";
import { altitudeFor, featureCentre, type Geometry, worldAltitude } from "../../lib/geo";


type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

type Props = {
  mode: Mode;
  limitMs: number | null;
  ruleset: Ruleset;
  /**
   * How many countries to name before the round ends, or null to go for the
   * whole map. Unlike the other game types this one lets the player choose
   * what to name, so a short round is a target to reach rather than a fixed
   * set of questions — the entire map stays on screen and in play.
   */
  count?: number | null;
  /** Multiplies the round's score once it ends. The daily doubles. */
  pointsMultiplier?: number;
  /** Told how the round went, for callers that report on it. */
  onRoundEnd?: (outcome: RoundOutcome) => void;
  /** False for practice: a drill shouldn't land in records or on a board. */
  record?: boolean;
  /**
   * Draw the rest of the world behind the countries in play, as scenery.
   *
   * The daily's ten are scattered at random across the globe, so drawn alone
   * they are ten specks on an empty sphere with nothing to place them by. The
   * backdrop is not playable — it is there to be navigated by.
   */
  backdrop?: boolean;
  /**
   * Under `backdrop`, mark the countries in play: normal land, lifted off the
   * sphere, with the rest of the world dropped back a shade.
   *
   * In this game it is not optional the way it is in Find it. Here the player
   * chooses what to answer, so on a full globe with nothing marked they would
   * be hunting for ten countries among two hundred with no way to tell which
   * are which. And it gives nothing away: the ten are the *questions*, not the
   * answers — knowing a country is in play does not tell you its name.
   */
  showInPlay?: boolean;
};

/** The whole-world view, sized to this window. Shared by every game. */
const worldView = () => worldAltitude(window.innerWidth, window.innerHeight);

export default function GlobeGame({
  mode,
  limitMs,
  ruleset,
  onRoundEnd,
  record = true,
  count = null,
  pointsMultiplier = 1,
  backdrop = false,
  showInPlay = false,
}: Props) {
  // Repaint when the player changes the globe palette.
  useGlobeTheme();

  const navigate = useNavigate();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  // Handed to the globe explicitly: left to itself it measures the window
  // once and keeps that canvas forever, so a window grown from half the
  // screen to all of it leaves the globe stranded off to one side.
  const viewport = useViewport();
  // The scene does not exist until the globe says so, and the look is
  // installed into the scene.
  // Finishing early ends the round for good, so it asks first — the same
  // question the back button has always asked.
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [ready, setReady] = useState(false);
  const ocean = useGlobeLook(globeRef, ready);
  const wrongTimer = useRef<number | undefined>(undefined);
  const framed = useRef(false);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
  /**
   * Every country on the map, for the backdrop. Kept apart from `features` on
   * purpose: `features` is what the round is *about* — its size is the round's
   * size, its members are what can be clicked, what is left counts as missed —
   * and folding the scenery into it would quietly make the daily a 200-country
   * round that can never be finished.
   */
  const [world, setWorld] = useState<CountryFeature[]>([]);
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
  const limitSeconds = limitMs === null ? null : Math.round(limitMs / 1000);
  // Seconds, not milliseconds, and with the round length — see FindGame.
  const round = useRound(
    recordKey("name", mode.id, limitSeconds, ruleset, count),
    limitMs,
    { record, pointsMultiplier }
  );
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
        setWorld(data.features);
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
      mode.view ?? { lat: 12, lng: 20, altitude: worldView() },
      0
    );
    framed.current = true;
  }, [features, mode]);


  /**
   * Keep the globe the same share of the window when the window changes.
   *
   * `worldAltitude` works out how far back the camera has to sit for the
   * sphere to fill a given viewport, and it was only ever asked once. Grow the
   * window and the globe stays framed for the old one — too small, with the
   * sphere adrift in the middle of nothing. The view is kept, only the
   * distance is redone.
   */
  useEffect(() => {
    if (!framed.current) return;
    const globe = globeRef.current;
    if (!globe) return;
    const at = globe.pointOfView();
    globe.pointOfView({ lat: at.lat, lng: at.lng, altitude: worldView() }, 0);
    // The point of view is read, not tracked: this runs on a resize.
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    if (features.length) begin();
  }, [features, begin]);

  useEffect(() => {
    if (!features.length || summary) return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [features.length, summary, tick]);

  // The whole meta, not just the printed name: the suggestion list searches
  // aliases too, so that "usa" finds the United States.
  const suggestionNames = useMemo(
    () =>
      features
        .map((f) => getCountryMeta(f.properties.name))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [features]
  );

  /** The countries the round is actually about, by name. */
  const inPlaySet = useMemo(
    () => new Set(features.map((f) => f.properties.name)),
    [features]
  );

  /** The round's size: the target on a short round, the map on a full one. */
  const target =
    count === null ? features.length : Math.min(count, features.length);

  // Under blitz a country can be lost as well as found, and the round is over
  // once every country has gone one way or the other. A short round ends the
  // moment the target is reached, however much map is left.
  const allFound =
    features.length > 0 &&
    (foundNames.size >= target ||
      foundNames.size + expired.size === features.length);

  const endRun = useCallback(() => {
    end({
      found: foundNames.size,
      total: target,
      attempted: attempted.size,
      firstTry: [...attempted].filter((name) => !fumbled.has(name)).length,
    });
    setSelected(null);
  }, [end, foundNames.size, target, attempted, fumbled]);

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
  /**
   * "Yes, I'm leaving" has to actually leave. It used to end the round and
   * drop the player on the summary, which was honest enough when the button
   * said "Finish & save" and a third button did the leaving — but that third
   * button is gone, so this one carries the whole promise.
   *
   * The run is ended first, so it is still saved and still reported: the
   * effect that does the reporting is declared above this one, and effects
   * run in the order they are declared, so it has already fired by the time
   * the navigation happens.
   */
  const leaving = useRef(false);
  useEffect(() => {
    if (summary && leaving.current) navigate("/");
  }, [summary, navigate]);


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
    if (!canAfford(round.score, "letter")) return;
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
      // The backdrop is scenery. Clicking it opens nothing rather than opening
      // a country that cannot be scored — a modal you can type into but never
      // get credit for would read as the game being broken.
      if (backdrop && !inPlaySet.has(name)) return;
      setSelected(feature);
    },
    [summary, foundNames, expired, backdrop, inPlaySet]
  );
  const globeClick = useGlobeClick<CountryFeature>(selectCountry);

  // The browser's Back, and the trackpad swipe that is the same thing, now
  // ask what the arrow in the corner asks.
  useLeaveGuard(!summary, () => round.setConfirmingExit(true));

  /**
   * Leaving mid-round asks, however the player goes about it.
   *
   * It used to ask only once something had been found, on the grounds that a
   * round with nothing in it had nothing to lose. That reads wrong from the
   * other side: the clock has been running, the countries have been drawn,
   * and pressing the arrow by mistake thirty seconds into a daily you get one
   * shot at should not simply obey. A round that is over asks nothing —
   * there is no run left to abandon.
   */
  const handleBack = () => {
    if (summary) {
      navigate("/");
      return;
    }
    round.setConfirmingExit(true);
  };

  /**
   * What colour a country is, and whether that colour is an answer.
   *
   * One function because the cap and the border both need it and must agree:
   * the border is derived from the fill, so a second copy of these rules
   * would eventually outline a country in a shade of a colour it is not.
   */
  const fillFor = (name: string): { color: string; answer: boolean } => {
    // Scenery first, ahead of every other rule — including the one that paints
    // the whole board "missed" once the round is over, which would otherwise
    // turn the entire world red at the end of a daily.
    if (backdrop && !inPlaySet.has(name))
      return { color: backdropColor(), answer: false };
    if (foundNames.has(name)) return { color: theme.found, answer: true };
    if (expired.has(name)) return { color: theme.missed, answer: true };
    if (name === cursorName) return { color: theme.selected, answer: true };
    if (summary) return { color: theme.missed, answer: true };
    if (selected && selected.properties.name === name)
      return { color: theme.selected, answer: true };
    return { color: landShade(name), answer: false };
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
        width={viewport.width}
        height={viewport.height}
        rendererConfig={{
          antialias: true,
          alpha: true,
          logarithmicDepthBuffer: true,
        }}
        backgroundColor={theme.page}
        globeMaterial={ocean}
        onGlobeReady={() => setReady(true)}
        {...GLOBE_SURFACE}
        polygonsData={backdrop ? world : features}
        polygonCapMaterial={(d) => {
          const { name } = (d as CountryFeature).properties;
          const fill = fillFor(name);
          return fill.answer
            ? landMaterial(fill.color, "answer")
            : landMaterial(fill.color);
        }}
        polygonLabel={(d) => {
          const { name } = (d as CountryFeature).properties;
          const fill = fillFor(name);
          // Naming a country you have already answered gives nothing away and
          // turns a finished board into something you can read back. Naming an
          // unanswered one would simply be the answer.
          if (!fill.answer) return "";
          return `<span style="color:${answerStroke(fill.color)};font-weight:600">${
            getCountryMeta(name).displayName
          }</span>`;
        }}
        polygonStrokeColor={(d) => {
          const { name } = (d as CountryFeature).properties;
          const fill = fillFor(name);
          // A border drawn in the one pale stroke vanishes the moment a
          // country is filled in: measured against the palettes it lands at
          // 1.06 on Emerald and 1.10 on Mono, which is not a faint line but no
          // line. An answer gets a border derived from its own colour instead.
          return fill.answer ? answerStroke(fill.color) : theme.stroke;
        }}
        polygonAltitude={(d) => {
          const { name } = (d as CountryFeature).properties;
          // Lifted, so the ones in play stand off the sphere and read as
          // raised even where the colour alone would not carry.
          if (showInPlay && inPlaySet.has(name)) return 0.035;
          if (backdrop && !inPlaySet.has(name)) return 0.008;
          return 0.012;
        }}
        polygonsTransitionDuration={0}
        onPolygonHover={(polygon) => {
          const feature = polygon as CountryFeature | null;
          const name = feature?.properties.name;
          // No pointer over the scenery. The cursor is the only thing that
          // says "this one isn't yours to click" before you try it.
          const playable =
            !feature || !backdrop || (name !== undefined && inPlaySet.has(name));
          globeClick.setHovered(playable ? feature : null);
        }}
      />


      <GameHud
        onBack={handleBack}
        found={foundNames.size}
        total={target}
        ms={round.displayMs}
        countdown={round.countdown}
        points={round.score.points}
        streak={round.score.streak}
        gain={round.gain}
        onFinish={summary ? null : () => setConfirmingFinish(true)}
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

      {confirmingFinish && (
        <ConfirmDialog
          title="Finish already?"
          confirmLabel="Finish"
          onConfirm={() => {
            setConfirmingFinish(false);
            endRun();
          }}
          cancelLabel="Keep playing"
          onCancel={() => setConfirmingFinish(false)}
        />
      )}

      {round.confirmingExit && (
        <ExitConfirm
          onFinish={() => {
            leaving.current = true;
            endRun();
          }}
          onKeepPlaying={() => round.setConfirmingExit(false)}
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
        // Offered but not payable: shown greyed rather than hidden, so the
        // price stays visible and the reason it cannot be taken is obvious.
        canAffordHint={canAfford(round.score, "letter")}
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
