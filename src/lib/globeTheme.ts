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
      sphere: "#0a1b2b",
      stroke: "#5fbfa8",
      atmosphere: "#2bb8a3",
      idle: "#2f6f63",
      unfound: "#2a6459",
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
      missed: "#b3684f",
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
      missed: "#d4574f",
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
 * Land on the decorative globe behind the menu.
 *
 * Brighter than the land in a round, and deliberately: nothing is being read
 * off it, it sits under a scrim, and a backdrop too dark to make out is the
 * same as not drawing one. Lifted towards the palette's own atmosphere colour
 * so it stays that palette's globe rather than becoming a second theme.
 */
export function backdropLand(): string {
  return mix(theme.idle, theme.atmosphere, 0.55);
}

/** Blends two #rrggbb colours, `amount` of the way from the first to the second. */
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
  globeMaterial.color.set(chosen.palette.sphere);
  setGlobeThemeId(chosen.id);
  for (const listener of listeners) listener();
}

/** For React: re-render whatever is on screen when the palette changes. */
export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
