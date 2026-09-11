/**
 * Ads, loaded late and only when allowed.
 *
 * Two separate switches have to be on. `VITE_ADSENSE_CLIENT` is the publisher
 * id, which is absent in development and stays absent until the site is
 * approved — so nothing here runs on a dev machine or on a preview build. The
 * second is the player's consent, read fresh at load time rather than captured
 * once, because the answer can change from Settings.
 *
 * The script tag is never in index.html. Putting it there would fetch Google's
 * code before anyone had been asked anything, which is the exact thing consent
 * is for.
 */
import { readConsent } from "./consent";

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;

const SCRIPT =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

/** Whether this build was given a publisher id at all. */
export const adsConfigured = Boolean(CLIENT);

/** Whether an ad may be shown right now: configured, and allowed. */
export function adsAllowed(): boolean {
  return adsConfigured && readConsent() === "granted";
}

type AdsWindow = Window & { adsbygoogle?: unknown[] };

let loading: Promise<void> | null = null;

/**
 * Fetches the ad script once per page load. Repeat calls share the promise —
 * several slots mounting together must not mean several script tags.
 */
export function loadAds(): Promise<void> {
  if (!adsAllowed()) return Promise.reject(new Error("ads not allowed"));
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = `${SCRIPT}?client=${CLIENT}`;
    tag.async = true;
    tag.crossOrigin = "anonymous";
    tag.onload = () => resolve();
    tag.onerror = () => {
      // A blocker, an offline player, or a network that ate it. The page has
      // to carry on regardless, so let the next mount try again.
      loading = null;
      reject(new Error("ad script blocked"));
    };
    document.head.appendChild(tag);
  });
  return loading;
}

/** Asks the loaded script to fill one slot. */
export function fillSlot() {
  const scope = window as AdsWindow;
  scope.adsbygoogle = scope.adsbygoogle ?? [];
  scope.adsbygoogle.push({});
}

export const adsClient = CLIENT;
