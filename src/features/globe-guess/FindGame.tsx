import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useViewport } from "../../lib/useViewport";
import { Link, useNavigate } from "react-router-dom";
import RoundSummary from "./RoundSummary";
import GameHud from "./GameHud";
import ExitConfirm from "./ExitConfirm";
import ConfirmDialog from "./ConfirmDialog";
import { useRound } from "./useRound";
import { recordRound } from "../../lib/countryStats";
import { useGlobeClick } from "./useGlobeClick";
import { useLeaveGuard } from "./useLeaveGuard";
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
import { capitalOf } from "../../data/capitals";
import { isCorrectGuess } from "../../lib/answerMatch";
import { HINT_COST, canAfford, type HintKind } from "../../lib/scoring";
import { missQuip } from "../../lib/quips";
import { hintsEnabled } from "../../lib/prefs";
import {
  answerStroke,
  backdropColor,
  landShade,
  theme,
} from "../../lib/globeTheme";
import { landMaterial } from "../../lib/globeTerrain";
import { useGlobeTheme } from "./useGlobeTheme";
import { GLOBE_SURFACE, useGlobeLook } from "./useGlobeLook";
import type { Continent } from "../../data/continents";
import {
  altitudeFor,
  featureCentre,
  type Geometry,
  labelPoint,
  worldAltitude,
} from "../../lib/geo";
import { VIEW, outlinePath } from "../../lib/outline";

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

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

export type RoundOutcome = {
  points: number;
  ms: number;
  found: string[];
  /** Got right, but only after a wrong answer. */
  fumbled: string[];
  /** Never got, whether shown, timed out, or the round ended first. */
  missed: string[];
};

type Props = {
  mode: Mode;
  limitMs: number | null;
  ruleset: Ruleset;
  /** What the prompt shows: a name, a flag, or a clue. */
  type: GameType;
  /** Told how the round went, for callers that report on it. */
  onRoundEnd?: (outcome: RoundOutcome) => void;
  /** False for practice: a drill shouldn't land in records or on a board. */
  record?: boolean;
  /**
   * Ask for the countries in this exact order instead of shuffling. The daily
   * challenge needs everyone to meet them in the same sequence.
   */
  fixedOrder?: string[];
  /**
   * How many countries to ask for, or null for the mode's whole list. A short
   * round still renders the full map — the other countries are simply never
   * asked about, which is what makes a ten-question round over Africa still
   * feel like Africa.
   */
  count?: number | null;
  /** Multiplies the round's score once it ends. The daily doubles. */
  pointsMultiplier?: number;
  /**
   * Draw the whole world behind the round, with the countries in play picked
   * out and the rest dimmed.
   *
   * Wanted where the mode is an arbitrary handful rather than a region: the
   * daily's ten countries have no geography between them, so on their own they
   * are specks on an empty sphere with nothing to navigate by. A continent
   * round still has a recognisable shape without this.
   */
  backdrop?: boolean;
  /**
   * Under `backdrop`, mark the countries actually in play: normal land, lifted
   * off the sphere, with the rest of the world dropped back a shade.
   *
   * Only for practice, and deliberately not for the daily. There the ten are
   * the answers — showing which they are would hand the round over. In
   * practice you already know the list, it is printed on the page you came
   * from, and seeing where those eight sit among everything else is the whole
   * point of drilling them on a globe.
   */
  showInPlay?: boolean;
};

/**
 * The globe round. The game poses a country — by name, by its flag, or by
 * something it is famous for — and the player clicks it on the globe. Only the
 * prompt differs between the three; everything else is one game.
 */
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
const tagElement = (d: object) => nameLabel(d as NameTag);

/** The whole-world view, sized to this window. Shared by every game. */
const worldView = () => worldAltitude(window.innerWidth, window.innerHeight);

export default function FindGame({
  mode,
  limitMs,
  ruleset,
  type,
  onRoundEnd,
  record = true,
  count = null,
  pointsMultiplier = 1,
  backdrop = false,
  showInPlay = false,
  fixedOrder,
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
  const [loadError, setLoadError] = useState(false);
  /** Names still to ask for, in the order they'll be asked. */
  const [queue, setQueue] = useState<string[]>([]);
  /** Every country this round asks about, fixed when the queue is built. */
  const [asked, setAsked] = useState<string[]>([]);
  /**
   * The countries this mode asks about. Under `backdrop` the globe draws more
   * than this — the rest of the world, so there is something to navigate by —
   * and only this set is ever drawn from to build a round.
   */
  const [inPlay, setInPlay] = useState<string[]>([]);
  const [foundNames, setFoundNames] = useState<Set<string>>(new Set());
  const [passedNames, setPassedNames] = useState<Set<string>>(new Set());
  /** Countries the player has answered for at least once. */
  const [attempted, setAttempted] = useState<Set<string>>(new Set());
  /** Countries they got wrong before getting them right. */
  const [fumbled, setFumbled] = useState<Set<string>>(new Set());
  /** The country just clicked in error, flashed red for a moment. */
  const [wrongName, setWrongName] = useState<string | null>(null);
  /** What to say about it, chosen from where the miss landed. */
  const [missNote, setMissNote] = useState<string | null>(null);
  /** The answer, revealed after a pass. */
  const [revealed, setRevealed] = useState<string | null>(null);
  /** Seconds left on this country under blitz rules. */
  const [secondsLeft, setSecondsLeft] = useState(BLITZ_SECONDS);
  /** Narrowed to the target's continent, once that hint is bought. */
  const [narrowedTo, setNarrowedTo] = useState<Continent | null>(null);
  /** How many of this country's clues have been shown, in a famous-for round. */
  const [cluesShown, setCluesShown] = useState(1);
  /** The keyboard route to an answer, for players who can't click the globe. */
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  /** The name shown on the country under the pointer, if it is answered. */
  const [nameTag, setNameTag] = useState<NameTag | null>(null);

  // Read once: a preference changed mid-round shouldn't move the goalposts.
  const [hintsOn] = useState(hintsEnabled);
  const limitSeconds = limitMs === null ? null : Math.round(limitMs / 1000);
  // recordKey speaks seconds, like the URL does; this component carries
  // milliseconds. Handing it `limitMs` filed timed rounds under "@180000"
  // while the menu looked them up under "@180", so a timed mode's best time
  // was written somewhere nothing ever read. The round length has to go in
  // too, or a ten-country run shares a bucket with the full list.
  const round = useRound(
    recordKey(type, mode.id, limitSeconds, ruleset, count),
    limitMs,
    { record, pointsMultiplier }
  );
  const { begin, reset, tick, end, summary, correct, wrong, spendHint, pass } =
    round;

  useEffect(() => {
    reset();
    setFoundNames(new Set());
    setPassedNames(new Set());
    setQueue([]);
    setAttempted(new Set());
    setFumbled(new Set());
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
        const names = playable.map((f) => f.properties.name);
        // Under backdrop the globe shows every country there is; without it,
        // only the ones the mode covers, as it always did.
        setFeatures(
          backdrop
            ? data.features.filter(
                (f) => getCountryMeta(f.properties.name).tier === "country"
              )
            : playable
        );
        setInPlay(names);
        const order = fixedOrder
          ? fixedOrder.filter((n) => names.includes(n))
          : shuffled(names).slice(0, count ?? names.length);
        setQueue(order);
        setAsked(order);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, reset, type, fixedOrder, count, backdrop]);

  useEffect(() => () => window.clearTimeout(wrongTimer.current), []);

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

  const target = queue[0] ?? null;
  const targetLabel = target ? getCountryMeta(target).displayName : "";

  /**
   * The outline of the country being asked for. Built here rather than in the
   * render so a re-render for the clock doesn't retrace a few thousand points.
   */
  const targetShape = useMemo(() => {
    if (type !== "outline" || !target) return "";
    const feature = features.find((f) => f.properties.name === target);
    return feature ? outlinePath(feature.geometry) : "";
  }, [type, target, features]);

  const endRound = useCallback(() => {
    end({
      found: foundNames.size,
      total: asked.length,
      attempted: attempted.size,
      firstTry: [...attempted].filter((name) => !fumbled.has(name)).length,
    });
  }, [end, foundNames.size, asked.length, attempted, fumbled]);

  // The countdown reaching zero ends the round wherever the player is.
  useEffect(() => {
    if (round.timeUp) endRound();
  }, [round.timeUp, endRound]);

  // Nothing left to ask means the round is over.
  useEffect(() => {
    if (features.length > 0 && queue.length === 0) endRound();
  }, [features.length, queue.length, endRound]);

  const advance = () => {
    setTyped("");
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

  /**
   * Answering by name instead of by clicking. The globe cannot be operated
   * from a keyboard, so without this a keyboard user could never answer at all.
   */
  const submitTyped = () => {
    if (!target || !typed.trim() || revealed || summary) return;
    handleClick(
      isCorrectGuess(typed, getCountryMeta(target))
        ? target
        : // Anything that isn't the answer is scored as a wrong pick.
          "\u0000not-a-country",
    );
    setTyped("");
  };

  /** Buys the next clue for this country, while there is one left. */
  /** Whether the round has earned enough to pay for a hint yet. */
  const afford = (hint: HintKind) => canAfford(round.score, hint);

  const handleAnotherClue = () => {
    if (!target || revealed) return;
    if (cluesShown >= cluesFor(target).length) return;
    if (!afford("letter")) return;
    spendHint("letter");
    setCluesShown((shown) => shown + 1);
  };

  /** Narrows the search to the target's continent, for a price. */
  const handleNarrow = () => {
    if (!target || narrowedTo || revealed) return;
    if (!afford("region")) return;
    spendHint("region");
    setNarrowedTo(getCountryMeta(target).continents[0]);
  };

  const handleClick = (name: string) => {
    if (summary || !target || revealed) return;
    setAttempted((prev) => new Set(prev).add(target));

    if (name === target) {
      setFoundNames((prev) => new Set(prev).add(name));
      correct();
      advance();
      return;
    }

    // Wrong country — flash it, say something about where it landed, and
    // leave the same target in place to retry.
    setFumbled((prev) => new Set(prev).add(target));
    wrong();
    setWrongName(name);
    setMissNote(missQuip(name, target, kmBetween(name, target)));
    window.clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(
      ruleset === "sudden"
        ? endRound
        : () => {
            setWrongName(null);
            setMissNote(null);
          },
      // Long enough to read the line, which is the point of having one.
      ruleset === "sudden" ? 700 : 1600
    );
  };

  /**
   * Moves on without the answer and without paying for it.
   *
   * Between a wrong guess, which costs 25, and buying the answer, which costs
   * 120, there was nothing for "I don't know this one and I don't want to pay
   * to find out". The country counts as missed, the same as if the blitz
   * clock had run out on it, and the streak goes — but nothing is charged.
   */
  const handleSkip = () => {
    if (!target || revealed) return;
    pass();
    setPassedNames((prev) => new Set(prev).add(target));
    advance();
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

  const playAgain = () => {
    reset();
    setFoundNames(new Set());
    setPassedNames(new Set());
    setAttempted(new Set());
    setFumbled(new Set());
    setWrongName(null);
    setRevealed(null);
    setNarrowedTo(null);
    setCluesShown(1);
    // A second round over the same mode draws a fresh sample, so "play again"
    // on a short round is ten new countries rather than the same ten. Drawn
    // from what is in play, never from the backdrop.
    const names = inPlay;
    const order = fixedOrder
      ? fixedOrder.filter((n) => names.includes(n))
      : shuffled(names).slice(0, count ?? names.length);
    setQueue(order);
    setAsked(order);
  };

  const inPlaySet = useMemo(() => new Set(inPlay), [inPlay]);

  const reported = useRef(false);
  useEffect(() => {
    if (!summary || reported.current) return;
    reported.current = true;
    const got = [...fumbled].filter((name) => foundNames.has(name));
    // Only countries actually put to the player count towards their stats —
    // the rest of the map was never asked about.
    recordRound({
      seen: [...new Set([...attempted, ...passedNames])],
      found: [...foundNames],
      fumbled: got,
    });
    onRoundEnd?.({
      points: summary.points,
      ms: summary.ms,
      found: [...foundNames],
      fumbled: got,
      missed: asked.filter((name) => !foundNames.has(name)),
    });
  }, [summary, onRoundEnd, foundNames, fumbled, attempted, passedNames, asked]);
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


  /**
   * Roughly how far apart two countries are, for deciding how hard to laugh.
   * Centre to centre is plenty: this picks a sentence, it does not score.
   */
  const kmBetween = useCallback(
    (a: string, b: string): number | null => {
      const centre = (of: string) => {
        const feature = features.find((f) => f.properties.name === of);
        return feature ? featureCentre(feature.geometry) : null;
      };
      const from = centre(a);
      const to = centre(b);
      if (!from || !to) return null;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(to.lat - from.lat);
      const dLng = toRad(to.lng - from.lng);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(from.lat)) *
          Math.cos(toRad(to.lat)) *
          Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
    },
    [features]
  );

  /**
   * What colour a country is, and whether that colour is an answer.
   *
   * One function because the cap and the border both read it and must agree:
   * the border of an answer is derived from its fill, so a second copy of
   * these rules would eventually outline a country in a shade of a colour it
   * is not.
   */
  const fillFor = useMemo(
    () => (name: string): { color: string; answer: boolean } => {
      if (name === wrongName) return { color: theme.missed, answer: true };
      if (name === revealed) return { color: theme.selected, answer: true };
      if (foundNames.has(name)) return { color: theme.found, answer: true };
      if (summary && passedNames.has(name))
        return { color: theme.missed, answer: true };
      if (narrowedTo && !getCountryMeta(name).continents.includes(narrowedTo))
        return { color: theme.sphere, answer: true };
      // The rest of the world, when the ones in play are being marked: there
      // to navigate by, not to be read.
      if (showInPlay && !inPlaySet.has(name))
        return { color: backdropColor(), answer: false };
      return { color: landShade(name), answer: false };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      wrongName,
      revealed,
      foundNames,
      passedNames,
      summary,
      narrowedTo,
      showInPlay,
      inPlaySet,
      // The palette is a live object: a swap changes these colours without
      // changing anything else listed here.
      themeId,
    ]
  );

  const capColor = useMemo(
    () => (d: object) => {
      const fill = fillFor((d as CountryFeature).properties.name);
      return fill.answer
        ? landMaterial(fill.color, "answer")
        : landMaterial(fill.color);
    },
    [fillFor]
  );

  /*
   * The border and height, kept stable between renders like the fill above.
   * The globe takes a new accessor as a sign the map may have changed and
   * walks every piece of land in the world to find out — so written inline,
   * hovering onto a new country or a tick of the round's clock repainted the
   * whole map.
   */
  const strokeColor = useCallback(
    (d: object) => {
      const { name } = (d as CountryFeature).properties;
      // Off-board scenery keeps no border at all: an outline in the land
      // colour worked while the land was flat, but a lit fill moves and an
      // unlit stroke does not, and the hidden map leaked through the gap.
      if (showInPlay && !inPlaySet.has(name)) return null;
      const fill = fillFor(name);
      // A border in the one pale stroke vanishes the moment a country is
      // filled in — measured against the palettes it lands at 1.06 on
      // Emerald, which is not a faint line but no line. An answer gets a
      // border derived from its own colour instead.
      return fill.answer ? answerStroke(fill.color) : theme.stroke;
    },
    [showInPlay, inPlaySet, fillFor]
  );

  const altitude = useCallback(
    (d: object) => {
      const { name } = (d as CountryFeature).properties;
      if (name === revealed) return 0.06;
      // Lifted, so the ones being drilled stand off the sphere and read
      // as raised even where the colour alone would not carry.
      if (showInPlay && inPlaySet.has(name)) return 0.035;
      return 0.008;
    },
    [revealed, showInPlay, inPlaySet]
  );

  const tags = useMemo(() => (nameTag ? [nameTag] : []), [nameTag]);

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
        polygonsData={features}
        polygonCapMaterial={capColor}
        htmlElementsData={tags}
        htmlLat={tagLat}
        htmlLng={tagLng}
        htmlAltitude={0.02}
        htmlElement={tagElement}
        htmlTransitionDuration={0}
        polygonStrokeColor={strokeColor}
        polygonAltitude={altitude}
        polygonsTransitionDuration={200}
        onPolygonHover={(polygon) => {
          const feature = polygon as CountryFeature | null;
          const name = feature?.properties.name;
          // Only ones already answered. Naming an unanswered country here
          // would hand over every question the round has left.
          setNameTag(
            feature && name && (foundNames.has(name) || summary)
              ? tagFor(feature)
              : null
          );
          globeClick.setHovered(feature);
        }}
      />


      <GameHud
        onBack={handleBack}
        found={foundNames.size}
        total={asked.length}
        ms={round.displayMs}
        countdown={round.countdown}
        points={round.score.points}
        streak={round.score.streak}
        gain={round.gain}
        onFinish={summary ? null : () => setConfirmingFinish(true)}
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

          {missNote && (
            <p className="text-xs font-medium text-rose-300">{missNote}</p>
          )}

          {/* The prompt itself — the only part that differs between the modes. */}
          {type === "outline" && !revealed && targetShape && (
            <svg
              viewBox={`0 0 ${VIEW} ${VIEW}`}
              width={132}
              height={132}
              role="img"
              aria-label="Outline of the country to find"
              className="w-32"
            >
              <path d={targetShape} fill={theme.found} />
            </svg>
          )}

          {type === "capital" && !revealed && target && (
            <p className="text-xl font-medium text-zinc-50 sm:text-2xl">
              {capitalOf(target)}
            </p>
          )}

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
            ((type !== "flag" && type !== "outline" && type !== "capital") ||
              revealed !== null) && (
              <p className="text-xl font-medium text-zinc-50 sm:text-2xl">
                {targetLabel}
              </p>
            )
          )}

          {/* Hidden until focused: mouse players never see it, keyboard
              players find it as a tab stop. */}
          <div className="pointer-events-auto">
            {typing ? (
              <div className="flex items-center gap-2 pt-1">
                <label htmlFor="typed-answer" className="sr-only">
                  Type the country
                </label>
                <input
                  id="typed-answer"
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitTyped();
                    if (e.key === "Escape") setTyping(false);
                  }}
                  placeholder="Country name"
                  autoComplete="off"
                  className="w-44 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
                />
                <button
                  onClick={submitTyped}
                  className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-zinc-100 hover:bg-white/15"
                >
                  Answer
                </button>
              </div>
            ) : (
              <button
                onClick={() => setTyping(true)}
                className="sr-only rounded-md border border-white/20 px-2 py-1 text-xs text-zinc-200 focus:not-sr-only focus:relative"
              >
                Answer by typing instead
              </button>
            )}
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 text-xs">
            {hintsOn &&
              type === "famous" &&
              target &&
              cluesShown < cluesFor(target).length && (
                <button
                  onClick={handleAnotherClue}
                  disabled={revealed !== null || !afford("letter")}
                  title={
                    afford("letter") ? undefined : "Not enough points yet"
                  }
                  className="text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300 disabled:no-underline disabled:opacity-40"
                  >
                  Another clue{" "}
                  <span className="text-zinc-600">−{HINT_COST.letter}</span>
                </button>
              )}
            {hintsOn && !narrowedTo && (
              <button
                onClick={handleNarrow}
                disabled={revealed !== null || !afford("region")}
                title={afford("region") ? undefined : "Not enough points yet"}
                className="text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300 disabled:no-underline disabled:opacity-40"
              >
                Narrow it down{" "}
                <span className="text-zinc-600">−{HINT_COST.region}</span>
              </button>
            )}
            {/* Free, and first: the way past a country for someone who does
                not want to spend anything to get past it. */}
            <button
              onClick={handleSkip}
              disabled={revealed !== null}
              className="text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300 disabled:no-underline disabled:opacity-40"
            >
              Pass
            </button>
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

      {confirmingFinish && (
        <ConfirmDialog
          title="Finish already?"
          confirmLabel="Finish"
          onConfirm={() => {
            setConfirmingFinish(false);
            endRound();
          }}
          cancelLabel="Keep playing"
          onCancel={() => setConfirmingFinish(false)}
        />
      )}

      {round.confirmingExit && (
        <ExitConfirm
          onFinish={() => {
            leaving.current = true;
            endRound();
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
          onPlayAgain={playAgain}
          onReviewMap={() => round.setReviewingMap(true)}
        />
      )}
    </div>
  );
}
