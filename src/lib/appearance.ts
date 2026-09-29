/**
 * Light or dark, for the pages around the games.
 *
 * Dark by default, because that is what the game has always looked like and
 * the globe is a night scene either way. "Match device" follows the system
 * setting, and keeps following it if it changes while the page is open.
 *
 * Kept under its own key rather than inside the prefs object so the script in
 * index.html can read it before anything renders — otherwise a light-mode
 * player sees a dark flash on every load.
 */
import { setGlobesByDay } from "./globeTheme";

export type Appearance = "dark" | "light" | "system";

const KEY = "worldguess.appearance.v1";

export const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "system", label: "Match device" },
];

function isAppearance(value: unknown): value is Appearance {
  return value === "dark" || value === "light" || value === "system";
}

export function appearance(): Appearance {
  try {
    const stored = localStorage.getItem(KEY);
    return isAppearance(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

/** What "system" comes to on this device right now. */
function resolved(choice: Appearance): "dark" | "light" {
  if (choice !== "system") return choice;
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/** The browser bar's colour, matched to the page. */
const BAR = { dark: "#07111c", light: "#f3f1ec" } as const;

function paint(choice: Appearance) {
  // No page to paint outside a browser, as in the tests.
  if (typeof document === "undefined") return;
  const mode = resolved(choice);
  document.documentElement.dataset.theme = mode;
  // The globes follow the page: light mode draws them by daylight.
  setGlobesByDay(mode === "light");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", BAR[mode]);
}

const listeners = new Set<() => void>();

export function setAppearance(choice: Appearance) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* the choice still applies for this visit */
  }
  paint(choice);
  for (const listener of listeners) listener();
}

/** For React: re-render when the choice changes. */
export function subscribeToAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Applies the stored choice, and keeps "Match device" in step with the
 * system. Called once at start-up; index.html has already set the attribute,
 * so this mostly wires up the listener.
 */
export function startAppearance() {
  paint(appearance());
  try {
    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", () => {
        if (appearance() === "system") paint("system");
      });
  } catch {
    /* no media queries: the stored choice stands */
  }
}
