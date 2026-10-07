/**
 * The game's public address, for the links people send and the cards they
 * post. Read from VITE_SITE_URL, so a link made while testing on a laptop
 * still points at the real game, which a friend can open and a chat app can
 * preview. localhost can be neither.
 */
export function siteUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined;
  return (fromEnv || window.location.origin).replace(/\/+$/, "");
}

/** "guessglobe.com", for the foot of a share card. */
export function siteHost(): string {
  return new URL(siteUrl()).host;
}

/**
 * The game's Buy Me a Coffee page, linked from the footer, Settings and the
 * feedback thank-you. Empty hides all three, so nothing points at a page that
 * isn't there.
 */
export const SUPPORT_URL = "https://buymeacoffee.com/guessglobe";
