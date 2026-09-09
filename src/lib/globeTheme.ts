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
    id: "atlantic",
    name: "Atlantic",
    level: 1,
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
