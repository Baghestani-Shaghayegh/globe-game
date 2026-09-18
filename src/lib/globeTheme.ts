import * as THREE from "three";
import { globeThemeId, setGlobeThemeId } from "./prefs";

/** The colours one globe is painted in. */
export type Palette = {
  /** Behind the globe. Held the same across palettes so the page chrome, which
   *  is plain CSS, can't fall out of step with it. */
  page: string;
  /** Ocean. */
  sphere: string;
  stroke: string;
  atmosphere: string;
  /** Menu backdrop: every country the same colour. */
  idle: string;
  /** In game: not yet identified. */
  unfound: string;
  found: string;
  /** Revealed at the end of a run: found by nobody. */
  missed: string;
  selected: string;
};

export type GlobeTheme = {
  id: string;
  name: string;
  /** The level that unlocks it. 1 means it is there from the start. */
  level: number;
  palette: Palette;
};

const PAGE = "#07111c";

/**
 * Found stays green and missed stays red in every palette: they are the two
 * colours that carry meaning rather than mood, and a theme that made them
 * ambiguous would cost the player the round.
 */
export const GLOBE_THEMES: GlobeTheme[] = [
  {
    id: "meridian",
    name: "Meridian",
    level: 1,
    palette: {
      page: PAGE,
      // Very dark navy. The land is lit, so the sea has to stay well under it
      // or the coastline stops being the thing that separates them.
      sphere: "#061c2c",
      // Bright enough to read as coastlines from across the room. The first
      // pass used a stroke only a shade off the land it was drawn on, and the
      // continents came out as one mass.
      stroke: "#79b9ad",
      atmosphere: "#35dbe0",
      // Muted teal. This is the colour of land facing the light square on;
      // the lighting takes it up towards #43858A where the sun catches it and
      // down towards #123D48 around the far limb.
      idle: "#23616a",
      unfound: "#23616a",
      // Land is teal here, so "found" has to be a green nothing else is: a
      // brighter, yellower spring green rather than the sea-green of the map.
      found: "#4ade80",
      missed: "#e0576a",
      selected: "#fbbf24",
    },
  },
  {
    id: "atlantic",
    name: "Atlantic",
    // Was the palette everyone started on. Meridian took that place, so this
    // becomes the first thing levelling up gives you.
    level: 2,
    palette: {
      page: PAGE,
      sphere: "#0d1b2a",
      stroke: "#8fb8d1",
      atmosphere: "#1e7d76",
      idle: "#2f4f6b",
      unfound: "#28455e",
      found: "#5bb98c",
      missed: "#a85466",
      selected: "#f2a93b",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    level: 3,
    palette: {
      page: PAGE,
      sphere: "#0b1026",
      stroke: "#8f8fd1",
      atmosphere: "#4c3f9e",
      idle: "#33306b",
      unfound: "#2b2957",
      found: "#5bb98c",
      missed: "#b05473",
      selected: "#f0b429",
    },
  },
  {
    id: "vintage",
    name: "Vintage",
    level: 5,
    palette: {
      page: PAGE,
      sphere: "#1b1710",
      stroke: "#d8c39a",
      atmosphere: "#8a6b3d",
      idle: "#6b5636",
      unfound: "#544428",
      found: "#8fae5d",
      // Rose rather than brick. The land here is brown and lit brown goes
      // redder; a brick "missed" was 31 channels off the sunlit ground.
      missed: "#c9556e",
      selected: "#e8b95c",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    level: 8,
    palette: {
      page: PAGE,
      sphere: "#04201c",
      stroke: "#9fd8c0",
      atmosphere: "#1f8f6a",
      idle: "#2f6b56",
      unfound: "#265948",
      found: "#6ddba0",
      missed: "#c2645f",
      selected: "#f2d16b",
    },
  },
  {
    id: "ember",
    name: "Ember",
    level: 12,
    palette: {
      page: PAGE,
      sphere: "#22110c",
      stroke: "#e5a887",
      atmosphere: "#a34a2a",
      idle: "#7a3d2a",
      unfound: "#63301f",
      found: "#7fbe7a",
      // Same story, further along: this palette's ground *is* red-orange, so
      // "missed" has to leave the hue altogether to stay readable on it.
      missed: "#e8467f",
      selected: "#f6c453",
    },
  },
  {
    id: "mono",
    name: "Mono",
    level: 16,
    palette: {
      page: PAGE,
      sphere: "#141414",
      stroke: "#bdbdbd",
      atmosphere: "#6b6b6b",
      idle: "#4a4a4a",
      unfound: "#3d3d3d",
      found: "#9ad3a8",
      missed: "#d08a8a",
      selected: "#e8d07a",
    },
  },
];

export const DEFAULT_THEME = GLOBE_THEMES[0];

export function themeById(id: string): GlobeTheme {
  return GLOBE_THEMES.find((entry) => entry.id === id) ?? DEFAULT_THEME;
}

/** Which themes a level has earned. */
export function unlockedThemes(level: number): GlobeTheme[] {
  return GLOBE_THEMES.filter((entry) => entry.level <= level);
}

let activeId = DEFAULT_THEME.id;
try {
  activeId = themeById(globeThemeId()).id;
} catch {
  /* storage unavailable — the default is fine */
}

/**
 * The live palette.
 *
 * A mutable object rather than a value that gets replaced: every globe reads
 * `theme.found` and friends at render time, so swapping the contents recolours
 * all of them at once without a single import having to change.
 */
export const theme: Palette = { ...themeById(activeId).palette };

/**
 * One material shared by every globe. Only one is ever on screen at a time,
 * and keeping it in one place means a theme change has a single thing to
 * recolour rather than four copies to chase.
 */
export const globeMaterial = new THREE.MeshPhongMaterial({
  color: theme.sphere,
  shininess: 0,
});

/**
 * Land that is on screen but not in play.
 *
 * Lighter than the sea and darker than anything a player can act on. The
 * connect puzzle hides the map by painting it, and painting it the sea's own
 * colour left a featureless ball with two countries floating on it — nothing
 * to orient by at all. This gives the continents back as silhouettes while
 * their borders stay hidden, so you can tell Arabia from Europe without being
 * able to count off the countries in between, which is the thing the puzzle
 * is asking you to remember.
 *
 * Derived rather than added to all six palettes, so it cannot be forgotten in
 * one of them, and so it sits correctly against whichever sea is on screen.
 */
export function backdropColor(): string {
  return mix(theme.sphere, theme.unfound, 0.45);
}

/**
 * Permanent ice: Greenland, Antarctica and the rest of the white parts.
 *
 * Pale and slightly blue against the teal of everything else, which is what
 * an ice sheet looks like from orbit and, more usefully, what stops Greenland
 * reading as just another large northern country.
 *
 * Only the menu globe uses it. In a round it would be a tell — the one pale
 * country on the map is an easy guess — so in play the ice is ordinary land.
 */
export function iceShade(): string {
  return mix(theme.sphere, "#cfdce6", 0.8);
}

/**
 * The shade of land a country is painted, when it is land and nothing more.
 *
 * One flat fill for every landmass made the continents read as a single
 * cut-out shape rather than a map. Each country instead gets a fixed step
 * along a narrow band around the land colour, so the map breaks into tones
 * the way relief shading does and neighbours separate without the stroke
 * having to do all the work.
 *
 * The step comes from the country's *name* and nothing else, so it is stable
 * across reloads and cannot leak anything the player is being asked to work
 * out. The band is kept tight and stays inside the land's own hue: `found`
 * and `missed` are the two colours that carry meaning, and no shade of the
 * map is allowed to drift towards either.
 */
export function landShade(name: string, base: string = theme.unfound): string {
  const key = `${activeId}:${base}:${name}`;
  const cached = shadeCache.get(key);
  if (cached) return cached;

  const step = hash(name) % SHADE_STEPS;
  const shade = mix(
    mix(base, theme.sphere, 0.2),
    mix(base, theme.stroke, 0.16),
    step / (SHADE_STEPS - 1)
  );
  shadeCache.set(key, shade);
  return shade;
}

/**
 * Few enough that the variation reads as deliberate rather than as noise, and
 * enough that neighbours rarely draw the same one. The band is narrow on
 * purpose: on the menu globe the light already carries a wide range across the
 * sphere, and this only has to keep one country from merging into the next.
 */
const SHADE_STEPS = 7;

const shadeCache = new Map<string, string>();

/** FNV-1a, for a stable shade per country without pulling in a dependency. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    value ^= text.charCodeAt(at);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** Blends two #rrggbb colours, `amount` of the way from the first to the second. */
/** WCAG relative luminance, for judging whether two colours read apart. */
function luminance(hex: string): number {
  const channel = (at: number) => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** How far apart two colours read, 1 being identical. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * How far apart a border has to read from the land it is drawn on.
 *
 * Three is the point at which a hairline stops dissolving into its
 * background. Measured across the palettes, the ordinary stroke clears it
 * comfortably on unanswered land — 3.1 to 5.8 — and nowhere near it on an
 * answer: 1.06 on Emerald, 1.10 on Mono, 1.13 on Atlantic. A ratio of 1.06 is
 * not a faint line, it is no line.
 */
const READABLE = 3;

/**
 * A border that reads on a filled-in answer, whatever colour the answer is.
 *
 * The one pale stroke suits the dark unanswered land it was chosen against
 * and disappears the moment a country turns green. Rather than pick a second
 * colour by eye — which would be wrong again the next time a palette is added
 * — this darkens the answer's own colour until it measurably separates from
 * it, so the border is always a shade of the country it outlines and always
 * visible on it.
 */
export function answerStroke(fill: string): string {
  // Darker first: a border that is a shadow of the country reads as part of
  // it, where a lighter one reads as something laid on top.
  for (let amount = 0.3; amount <= 0.9; amount += 0.05) {
    const candidate = mix(fill, "#000000", amount);
    if (contrast(candidate, fill) >= READABLE) return candidate;
  }
  // Nothing short of black separated from it, which means the fill is already
  // dark — the narrowed-out land in Find it is nearly the colour of the sea.
  // There is nowhere further down to go, so go up.
  for (let amount = 0.3; amount <= 0.9; amount += 0.05) {
    const candidate = mix(fill, "#ffffff", amount);
    if (contrast(candidate, fill) >= READABLE) return candidate;
  }
  return "#ffffff";
}

function mix(from: string, to: string, amount: number): string {
  const channels = (hex: string) =>
    [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const [r1, g1, b1] = channels(from);
  const [r2, g2, b2] = channels(to);
  const blend = (a: number, b: number) =>
    Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${blend(r1, r2)}${blend(g1, g2)}${blend(b1, b2)}`;
}

const listeners = new Set<() => void>();

export function activeThemeId(): string {
  return activeId;
}

export function setGlobeTheme(id: string) {
  const chosen = themeById(id);
  activeId = chosen.id;
  Object.assign(theme, chosen.palette);
  shadeCache.clear();
  globeMaterial.color.set(chosen.palette.sphere);
  setGlobeThemeId(chosen.id);
  for (const listener of listeners) listener();
}

/** For React: re-render whatever is on screen when the palette changes. */
export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
