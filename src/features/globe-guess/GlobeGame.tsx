import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useViewport } from "../../lib/useViewport";
import { Link, useNavigate } from "react-router-dom";
import GuessModal from "./GuessModal";
import RoundSummary from "./RoundSummary";
import RoundShare from "./RoundShare";
import GameHud from "./GameHud";
import ExitConfirm from "./ExitConfirm";
import ConfirmDialog from "./ConfirmDialog";
import { useRound } from "./useRound";
import { useReplayCamera } from "./useReplayCamera";
import { keepReplay, type Replay } from "../../lib/replay";
import { recordRound } from "../../lib/countryStats";
import { useGlobeClick } from "./useGlobeClick";
import { useLeaveGuard } from "./useLeaveGuard";
import type { RoundOutcome } from "./FindGame";
import { getCountryMeta } from "../../data/countries";
import {
  BLITZ_SECONDS,
  GAME_TYPES,
  recordKey,
  type Mode,
  type Ruleset,
} from "../../data/modes";
import { isCorrectGuess } from "../../lib/answerMatch";
import {
  answerStroke,
  backdropColor,
  landShade,
  raisedLand,
  theme,
} from "../../lib/globeTheme";
import { landMaterial } from "../../lib/globeTerrain";
import { useGlobeTheme } from "./useGlobeTheme";
import { pulseMark } from "./globeMarks";
import { GLOBE_SURFACE, useGlobeLook } from "./useGlobeLook";
import { hintsEnabled } from "../../lib/prefs";
import {
  altitudeFor,
  featureCentre,
  type Geometry,
  labelPoint,
  worldAltitude,
} from "../../lib/geo";


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
  /**
   * Leaving mid-round throws the round away instead of filing it: nothing is
   * saved, and coming back starts it again from the top. Sara's rule for the
   * daily Country hunt — it is only done once it is finished, the clock runs
   * out, or the player presses Quit.
   */
  leaveDiscards?: boolean;
};

/**
 * A country's name, placed on the country.
 *
 * The name used to ride the pointer as a tooltip, which meant it was near the
 * country rather than on it and moved whenever the hand did. This sits at the
 * country's own centre and turns with the globe, because that is where the
 * name of a place belongs.
 *
 */
type NameTag = {
  lat: number;
  lng: number;
  text: string;
  /** Grown to be clickable, so its name has to sit above rather than on it. */
  tiny: boolean;
};

function tagFor(feature: {
  properties: { name: string; tiny?: boolean };
  geometry: Geometry;
}): NameTag {
  const { lat, lng } = labelPoint(feature.geometry);
  return {
    lat,
    lng,
    text: getCountryMeta(feature.properties.name).displayName,
    tiny: feature.properties.tiny === true,
  };
}

/**
 * The label itself: thin black text and nothing else.
 *
 * Plain DOM rather than the globe library's own label layer, which builds text
 * out of 3D geometry from a typeface it fetches at runtime — a font over the
 * network, to write one country's name. This is a span; it costs nothing, it
 * takes the same CSS as the rest of the game, and it cannot fail to load.
 *
 * Black, because it is only ever drawn on a country that has been answered,
 * and those colours — the found green, the missed red, the selected amber —
 * are all light enough to read black against. A faint light halo keeps it off
 * the land's mottled texture without turning it into a badge.
 */
function nameLabel(tag: NameTag): HTMLElement {
  // The globe centres the outer element on the point by writing its transform
  // every frame, so the nudge for a tiny country has to go on the inner one.
  const holder = document.createElement("div");
  holder.style.pointerEvents = "none";
  const el = holder.appendChild(document.createElement("span"));
  el.textContent = tag.text;
  el.style.cssText = [
    "color: #05140c",
    "font: 300 13px ui-sans-serif, system-ui, sans-serif",
    "letter-spacing: 0.01em",
    "white-space: nowrap",
    "pointer-events: none",
    "text-shadow: 0 0 3px rgb(255 255 255 / 0.45)",
    // A country grown to stay clickable is smaller than its own name, so the
    // name sits above it rather than across it.
    tag.tiny ? "display: inline-block; transform: translateY(-14px)" : "",
  ].join(";");
  return holder;
}

/**
 * The label layer's accessors, made once. Written inline they were new on
 * every render, and the globe takes a new `htmlElement` as an order to throw
 * the label away and build it again — which the round's clock asked for four
 * times a second.
 */
const tagLat = (d: object) => (d as NameTag).lat;
const tagLng = (d: object) => (d as NameTag).lng;
const tagElement = (d: object) =>
  "beacon" in d ? pulseMark() : nameLabel(d as NameTag);

/**
 * A pulse on a country still to be named, under `showInPlay`.
 *
 * Colour and height alone did not carry it: at the whole-world view a small
 * island is a few pixels whatever colour it is, and two players reported
 * hunting the globe for the daily's last country. The globe's own ring layer
 * was tried first and drew one-pixel lines that were lost among the
 * coastlines. This is DOM, like the name tags, so it is the same size on
 * screen however far out the camera is, and the globe already hides it when
 * it is round the back.
 */
type Beacon = { beacon: true; lat: number; lng: number };


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
  leaveDiscards = false,
}: Props) {
  // Repaint when the player changes the globe palette.
  const themeId = useGlobeTheme();

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
  /** The name shown on the country under the pointer, if it is answered. */
  const [nameTag, setNameTag] = useState<NameTag | null>(null);
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
  const bucket = recordKey("name", mode.id, limitSeconds, ruleset, count);
  const round = useRound(bucket, limitMs, { record, pointsMultiplier });
  const { begin, reset, tick, end, summary, correct, wrong, spendHint } =
    round;
  const { mark, look, finishReplay } = round;
  /** This round as recorded, once it's over. */
  const [replay, setReplay] = useState<Replay | null>(null);
  useReplayCamera(globeRef, ready && !summary, look);

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
    setReplay(null);
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
  //
  // Drawn from the whole map, not the round. Offered only the round's own
  // countries, the daily's list held ten names, and typing an L showed the
  // one L that was an answer. Territories only when the round has some, so a
  // countries-only round is not padded with names that can never be right.
  const suggestionNames = useMemo(() => {
    const withTerritories = features.some(
      (f) => getCountryMeta(f.properties.name).tier === "territory"
    );
    return world
      .map((f) => getCountryMeta(f.properties.name))
      .filter((meta) => withTerritories || meta.tier === "country")
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [world, features]);

  /**
   * Land in the round's part of the world that the round doesn't ask about,
   * drawn as scenery so the map has no holes in it.
   *
   * A countries-only round used to draw only the countries, and every
   * territory went with the rest: Kosovo, Somaliland, Western Sahara and
   * Greenland were not grey, they were gone — sea where land should be. A
   * player reported Kosovo and Somaliland "not showing up altogether".
   * Anything the mode would take if it were a country is its ground to
   * draw; the backdrop, when there is one, already draws the whole world.
   */
  const scenery = useMemo(() => {
    if (backdrop) return [];
    const asked = new Set(features.map((f) => f.properties.name));
    return world.filter((f) => {
      if (asked.has(f.properties.name)) return false;
      const meta = getCountryMeta(f.properties.name);
      return mode.includes({ ...meta, tier: "country" });
    });
  }, [backdrop, world, features, mode]);

  const drawn = useMemo(
    () => (backdrop ? world : [...features, ...scenery]),
    [backdrop, world, features, scenery]
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

  /**
   * A pulse on each country still to name, while the round runs. On the
   * point furthest inside the land rather than the middle of its box, which
   * for a crescent or a scatter of islands can be open sea.
   */
  const beacons = useMemo<Beacon[]>(
    () =>
      showInPlay && !summary
        ? selectable.map(({ feature }) => ({
            beacon: true,
            ...labelPoint(feature.geometry),
          }))
        : [],
    [showInPlay, summary, selectable]
  );

  /**
   * "Next one": turns the globe to a country still to name, one after
   * another, without opening it. For the round's last country, which is the
   * one people lost — the ring only helps once it is on your side of the
   * world. Close enough that an island fills a thumb's width, held back far
   * enough that the neighbours are there to place it by.
   */
  const [spotlight, setSpotlight] = useState(-1);
  const showNext = () => {
    if (!selectable.length) return;
    const next = (spotlight + 1) % selectable.length;
    setSpotlight(next);
    const { centre } = selectable[next];
    globeRef.current?.pointOfView(
      {
        lat: centre.lat,
        lng: centre.lng,
        altitude: Math.max(0.7, altitudeFor(centre.span)),
      },
      700
    );
  };

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
    const recording = finishReplay({
      type: "name",
      mode: mode.id,
      label: `${GAME_TYPES.find((t) => t.id === "name")?.label ?? ""} · ${mode.name}`,
      bucket,
      ...(backdrop ? { inPlay: features.map((f) => f.properties.name) } : {}),
    });
    if (recording && record) keepReplay(recording);
    setReplay(recording);
    onRoundEnd?.({
      points: summary.points,
      ms: summary.ms,
      found: [...foundNames],
      fumbled: got,
      missed: features
        .map((f) => f.properties.name)
        .filter((name) => !foundNames.has(name)),
      replay: recording,
      postedId: round.postedId(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, at the end
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
    spendHint("letter", selected.properties.name);
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
      correct(name);
      closeModal();
    } else {
      setFumbled((prev) => new Set(prev).add(name));
      wrong(name);
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
      if (!inPlaySet.has(name)) return;
      setSelected(feature);
      mark(["s", name]);
    },
    [summary, foundNames, expired, backdrop, inPlaySet, mark]
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
  const fillFor = useCallback(
    (name: string): { color: string; answer: boolean } => {
      // Scenery first, ahead of every other rule — including the one that paints
      // the whole board "missed" once the round is over, which would otherwise
      // turn the entire world red at the end of a daily.
      if (!inPlaySet.has(name))
        return { color: backdropColor(), answer: false };
      if (foundNames.has(name)) return { color: theme.found, answer: true };
      if (expired.has(name)) return { color: theme.missed, answer: true };
      if (name === cursorName) return { color: theme.selected, answer: true };
      if (summary) return { color: theme.missed, answer: true };
      if (selected && selected.properties.name === name)
        return { color: theme.selected, answer: true };
      // Marked in play: brighter than the backdrop by a clear step, not the
      // one-shade difference that left players unsure what they were after.
      return {
        color: landShade(name, showInPlay ? raisedLand() : theme.unfound),
        answer: false,
      };
    },
    // themeId: the palette is a live object, so a swap changes these colours
    // without changing anything else listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backdrop, showInPlay, inPlaySet, foundNames, expired, cursorName, summary, selected, themeId]
  );

  /*
   * The polygon accessors, kept stable between renders. The globe takes a new
   * accessor as a sign the colours may have changed and walks every piece of
   * land in the world to find out — so written inline, hovering onto a new
   * country or a tick of the round's clock repainted the whole map.
   */
  const capMaterial = useCallback(
    (d: object) => {
      const fill = fillFor((d as CountryFeature).properties.name);
      return fill.answer
        ? landMaterial(fill.color, "answer")
        : landMaterial(fill.color);
    },
    [fillFor]
  );

  const strokeColor = useCallback(
    (d: object) => {
      const fill = fillFor((d as CountryFeature).properties.name);
      // A border drawn in the one pale stroke vanishes the moment a
      // country is filled in: measured against the palettes it lands at
      // 1.06 on Emerald and 1.10 on Mono, which is not a faint line but no
      // line. An answer gets a border derived from its own colour instead.
      return fill.answer ? answerStroke(fill.color) : theme.stroke;
    },
    [fillFor]
  );

  const altitude = useCallback(
    (d: object) => {
      const { name } = (d as CountryFeature).properties;
      // Lifted, so the ones in play stand off the sphere and read as
      // raised even where the colour alone would not carry.
      if (showInPlay && inPlaySet.has(name)) return 0.035;
      if (!inPlaySet.has(name)) return 0.008;
      return 0.012;
    },
    [showInPlay, inPlaySet, backdrop]
  );

  // One html layer for both: the name under the pointer and the beacons.
  const tags = useMemo<object[]>(
    () => (nameTag ? [nameTag, ...beacons] : beacons),
    [nameTag, beacons]
  );

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
        rendererConfig={{
          antialias: true,
          alpha: true,
          logarithmicDepthBuffer: true,
        }}
        backgroundColor={theme.page}
        globeMaterial={ocean}
        onGlobeReady={() => setReady(true)}
        {...GLOBE_SURFACE}
        polygonsData={drawn}
        polygonCapMaterial={capMaterial}
        htmlElementsData={tags}
        htmlLat={tagLat}
        htmlLng={tagLng}
        htmlAltitude={0.02}
        htmlElement={tagElement}
        htmlTransitionDuration={0}
        polygonStrokeColor={strokeColor}
        polygonAltitude={altitude}
        polygonsTransitionDuration={0}
        onPolygonHover={(polygon) => {
          const feature = polygon as CountryFeature | null;
          const name = feature?.properties.name;
          // Naming a country you have already answered gives nothing away and
          // turns a finished board into something you can read back. Naming an
          // unanswered one would simply be the answer.
          setNameTag(
            feature && name && (foundNames.has(name) || expired.has(name) || summary)
              ? tagFor(feature)
              : null
          );
          // No pointer over the scenery. The cursor is the only thing that
          // says "this one isn't yours to click" before you try it.
          const playable =
            !feature || (name !== undefined && inPlaySet.has(name));
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
              className="sr-only rounded-md border border-white/20 bg-raised px-3 py-1.5 text-sm text-zinc-100 focus:not-sr-only focus:relative"
            >
              Pick a country with the keyboard
            </button>
          ) : (
            <p className="rounded-lg border border-white/10 bg-raised/90 px-4 py-2 text-center text-sm text-zinc-300 backdrop-blur">
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
          title="Quit this round?"
          body={
            leaveDiscards
              ? "This ends today's hunt, and you can't play it again today."
              : undefined
          }
          confirmLabel="Quit"
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
          note={
            leaveDiscards
              ? "This round won't be saved. You can start again from the menu."
              : undefined
          }
          onFinish={() => {
            // Nothing answered yet, or a round that isn't kept when left: just
            // go. Ending the round here filed it, and on the daily that meant
            // a day marked done — for somebody who had only looked.
            if (leaveDiscards || (attempted.size === 0 && expired.size === 0)) {
              navigate("/");
              return;
            }
            leaving.current = true;
            endRun();
          }}
          onKeepPlaying={() => round.setConfirmingExit(false)}
        />
      )}

      {showInPlay && !summary && selectable.length > 0 && (
        <div className="absolute inset-x-0 bottom-6 z-20 mx-auto flex w-fit items-center gap-3 rounded-full border border-white/10 bg-raised/90 py-2 pl-4 pr-2 text-sm backdrop-blur">
          <span className="flex items-center gap-2 text-zinc-400">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: raisedLand() }}
            />
            {selectable.length} left
          </span>
          <button
            onClick={showNext}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            Next one
          </button>
        </div>
      )}

      {summary && round.reviewingMap && (
        <div className="absolute inset-x-0 bottom-6 z-20 mx-auto flex w-fit items-center gap-3 rounded-full border border-white/10 bg-raised/90 py-2 pl-4 pr-2 text-sm backdrop-blur">
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
          replay={replay}
          postedId={round.postedId}
          share={
            // Free play only: practice isn't a result, and the daily has its
            // own result page to share from.
            record && pointsMultiplier === 1 ? (
              <RoundShare
                type={"name"}
                mode={mode}
                ruleset={ruleset}
                limitMs={limitMs}
                found={[...foundNames]}
                missed={features.map((f) => f.properties.name).filter((name) => !foundNames.has(name))}
                ms={summary.ms}
                points={summary.points}
              />
            ) : undefined
          }
        />
      )}

      <GuessModal
        open={selected !== null}
        hintLetter={hintLetter}
        secondsLeft={ruleset === "blitz" ? secondsLeft : null}
        onHint={hintsOn ? handleHint : null}
        // Offered but not payable: shown greyed rather than hidden, so the
        // price stays visible and the reason it cannot be taken is obvious.
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
