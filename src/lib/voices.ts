import { getCountryMeta } from "../data/countries";
import { capitalOf } from "../data/capitals";

/**
 * Recorded names: one short clip per country and capital a lesson teaches,
 * made once by scripts/build-voices.mjs and served from /voice.
 *
 * The device's own speech read every name the way its English voice guessed
 * it, which is a different guess on every phone — and a wrong one for the
 * names that don't spell the way they sound: Kiribati, Lesotho, Grenada. A
 * clip is the same everywhere, and the tricky ones are made from a checked
 * pronunciation (scripts/voice/lexicon.tsv) rather than from the spelling.
 */

/** Every name a lesson can say: the countries taught, and their capitals. */
export function voiceTexts(geoNames: string[]): string[] {
  const out = new Set<string>();
  for (const name of geoNames) {
    const meta = getCountryMeta(name);
    if (meta.tier !== "country" || !meta.continents.length) continue;
    out.add(meta.displayName);
    const capital = capitalOf(name);
    if (capital) out.add(capital);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/** Where a clip is served from, versioned so a remade one isn't cached. */
export function clipUrl(clip: { file: string; v?: string }): string {
  return `/voice/${clip.file}${clip.v ? `?v=${clip.v}` : ""}`;
}

/** The file a name's clip is saved as: "São Tomé" → "sao-tome". */
export function voiceSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type VoiceManifest = {
  /** Which voice made the clips, for the review page. */
  voice: string;
  /** Name → file under /voice, and the pronunciation it was made from. */
  clips: Record<string, { file: string; v?: string; ipa?: string }>;
};

let manifest: Promise<VoiceManifest | null> | null = null;
/** The manifest once it has arrived; undefined until then. */
let loaded: VoiceManifest | null | undefined;

/**
 * The manifest if it has already arrived. A clip has to start inside the
 * tap that asked for it — iPhones refuse to play sound started later — so
 * the speaker button can't wait on a download; the lesson asks for the
 * manifest as it opens, and a tap before it lands uses the device's voice.
 */
export function voiceManifestNow(): VoiceManifest | null | undefined {
  return loaded;
}

/**
 * The clips there are, or null if none have been made — in which case the
 * device's speech is used instead. Asked for once a visit.
 */
export function loadVoiceManifest(): Promise<VoiceManifest | null> {
  manifest ??= fetch("/voice/manifest.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((data: unknown) => {
      const clips = (data as VoiceManifest | null)?.clips;
      return clips && typeof clips === "object" ? (data as VoiceManifest) : null;
    })
    // No clips yet, or a host that answers a missing file with the page
    // itself: either way, not JSON, and the device's voice takes over.
    .catch(() => null)
    .then((result) => {
      loaded = result;
      return result;
    });
  return manifest;
}
