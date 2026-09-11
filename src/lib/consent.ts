/**
 * Whether the player has agreed to advertising cookies.
 *
 * Three states, and the difference matters: "granted" and "denied" are answers
 * the player gave, `null` is a question not yet asked. Ads only load on
 * "granted", and the banner only shows on `null` — so a "no" is remembered and
 * never nags, which is the whole point of asking.
 *
 * Nothing here is a legal opinion. It is the mechanism a consent choice needs:
 * stored locally, revocable from Settings, and read before any ad script runs.
 */
const KEY = "worldguess.consent.v1";

export type Consent = "granted" | "denied";

/** Listeners, so the banner and the ad slots agree the moment a button is hit. */
const listeners = new Set<() => void>();

export function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "granted" || raw === "denied" ? raw : null;
  } catch {
    // Blocked storage means no way to remember a yes, and a consent you can't
    // remember is not consent. Treat it as unanswered and run no ads.
    return null;
  }
}

export function setConsent(consent: Consent) {
  try {
    localStorage.setItem(KEY, consent);
  } catch {
    /* the choice won't survive a reload, but it holds for this visit */
  }
  for (const listener of listeners) listener();
}

/**
 * Puts the question back. Used by Settings: someone who said no once should be
 * able to change their mind without clearing their browser.
 */
export function clearConsent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored means nothing to clear */
  }
  for (const listener of listeners) listener();
}

export function subscribeToConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
