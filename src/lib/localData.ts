/**
 * Everything the game keeps in this browser, in one list.
 *
 * Kept here rather than derived at runtime because `localStorage` is shared
 * with whatever else is served from the same origin: clearing by prefix would
 * be neater but would also be a promise about keys we don't own. An explicit
 * list can be wrong only by being out of date, which a test catches.
 */
export const LOCAL_KEYS = [
  "worldguess.prefs.v1",
  "worldguess.prefs.v2",
  "worldguess.consent.v1",
  "worldguess.records.v1",
  "worldguess.records.v2",
  "worldguess.records.v3",
  "worldguess.countries.v1",
  "worldguess.daily.v1",
  "worldguess.practice.v1",
  "worldguess.achievements.v1",
  "worldguess.mystery.v1",
  "worldguess.connect.v1",
  "worldguess.higherlower.v1",
] as const;

/** What a player would call each thing, for the warning before erasing it. */
export const LOCAL_SUMMARY = [
  "Best times and scores for every mode",
  "Daily challenge history and your streak",
  "Badges, level and XP",
  "Per-country statistics and your practice deck",
  "Mystery, connect and higher-or-lower results",
  "Settings, including your answer about cookies",
];

/**
 * The three puzzles on the Today row, and where each keeps its result.
 *
 * `daily` is filed per day, so today's entry can be lifted out on its own and
 * the streak survives. Mystery and connect only ever hold the current day, so
 * for those the whole key goes.
 */
const DAILY_KEY = "worldguess.daily.v1";
const TODAY_ONLY_KEYS = ["worldguess.mystery.v1", "worldguess.connect.v1"];

/**
 * Puts today's three puzzles back to unplayed, for testing them more than once
 * a day. Yesterday's results and the streak built on them are left alone: the
 * point is to replay today, not to erase a history.
 *
 * Deliberately not something a player can reach — see where it is called.
 */
export function replayTodaysDailies(day: string) {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const store = parsed as Record<string, unknown>;
        delete store[day];
        localStorage.setItem(DAILY_KEY, JSON.stringify(store));
      }
    }
    for (const key of TODAY_ONLY_KEYS) localStorage.removeItem(key);
  } catch {
    // Unreadable storage means there is nothing stored to replay.
  }
}

/** How many of those keys actually hold something right now. */
export function storedCount(): number {
  try {
    return LOCAL_KEYS.filter((key) => localStorage.getItem(key) !== null).length;
  } catch {
    return 0;
  }
}

/**
 * Erases the lot. Irreversible by design — there is no server copy of any of
 * it, which is exactly what the privacy page promises.
 */
export function clearLocalData() {
  try {
    for (const key of LOCAL_KEYS) localStorage.removeItem(key);
  } catch {
    /* nothing readable means nothing to erase */
  }
}
