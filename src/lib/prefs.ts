/**
 * Standing preferences — things a player sets once, unlike the clock and rules
 * which are chosen per round. Kept apart from records so clearing one doesn't
 * take the other with it.
 */
const KEY = "worldguess.prefs.v1";

type Prefs = { hints: boolean; sound: boolean; globeTheme: string };

/**
 * No palette chosen yet.
 *
 * Deliberately empty rather than naming one: `themeById` falls back to the
 * first entry in GLOBE_THEMES, so the default lives there and only there.
 * Naming it here as well meant two defaults, and when the palettes were
 * reordered they disagreed — the menu's backdrop used the new one while every
 * globe in an actual round kept the old.
 */
const NO_THEME_CHOSEN = "";

const DEFAULTS: Prefs = {
  hints: true,
  sound: true,
  globeTheme: NO_THEME_CHOSEN,
};

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    const { hints, sound, globeTheme } = parsed as Partial<Prefs>;
    return {
      hints: typeof hints === "boolean" ? hints : DEFAULTS.hints,
      sound: typeof sound === "boolean" ? sound : DEFAULTS.sound,
      globeTheme:
        typeof globeTheme === "string" ? globeTheme : DEFAULTS.globeTheme,
    };
  } catch {
    // Private window, blocked storage, or a corrupt value.
    return DEFAULTS;
  }
}

export function hintsEnabled(): boolean {
  return read().hints;
}

export function setHintsEnabled(hints: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), hints }));
  } catch {
    /* the setting just won't survive a reload */
  }
}

export function soundEnabled(): boolean {
  return read().sound;
}

export function setSoundEnabled(sound: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), sound }));
  } catch {
    /* the setting just won't survive a reload */
  }
}

export function globeThemeId(): string {
  return read().globeTheme;
}

export function setGlobeThemeId(globeTheme: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), globeTheme }));
  } catch {
    /* the setting just won't survive a reload */
  }
}
