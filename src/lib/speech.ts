import { clipUrl, voiceManifestNow } from "./voices";

/**
 * Saying a place name out loud, for the speaker buttons in a lesson.
 *
 * A recorded clip where there is one (see lib/voices.ts): the same voice on
 * every device, and made from a checked pronunciation for the names that
 * don't sound the way they're spelled. Where there isn't — before the clips
 * are made, or offline before they're cached — the browser's own speech.
 */

/** Whether a name can be said at all. The button isn't shown if not. */
export function canSpeak(): boolean {
  return "speechSynthesis" in globalThis || typeof Audio !== "undefined";
}

/**
 * The device voice to fall back on: British English first, since the game
 * spells the British way, then any English, then the device's default.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  return (
    english.find((v) => v.lang.toLowerCase() === "en-gb" && v.localService) ??
    english.find((v) => v.lang.toLowerCase() === "en-gb") ??
    english.find((v) => v.localService) ??
    english[0] ??
    null
  );
}

let clip: HTMLAudioElement | null = null;

function speakWithDevice(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in globalThis)) {
    onEnd?.();
    return;
  }
  const synth = globalThis.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "en-GB";
  // A touch slower than conversation: it's a name being learned.
  utterance.rate = 0.85;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  synth.speak(utterance);
}

/**
 * Says `text`, cutting off anything already being said, so pressing a second
 * button doesn't queue behind the first. `onEnd` runs when it stops, however
 * it stops. Not tied to the game's mute: this only ever plays because the
 * player pressed the button asking for it.
 */
export function speak(text: string, onEnd?: () => void): void {
  stopSpeaking();
  const recorded = voiceManifestNow()?.clips[text];
  if (!recorded || typeof Audio === "undefined") {
    speakWithDevice(text, onEnd);
    return;
  }
  const audio = new Audio(clipUrl(recorded));
  clip = audio;
  let settled = false;
  const fallBack = () => {
    // A clip that won't load — offline and not yet cached — still gets said.
    if (settled || clip !== audio) return;
    settled = true;
    clip = null;
    speakWithDevice(text, onEnd);
  };
  audio.onended = () => {
    settled = true;
    if (clip === audio) clip = null;
    onEnd?.();
  };
  audio.onerror = fallBack;
  audio.play().catch(fallBack);
}

/** Stops anything being said — when the lesson moves on, say. */
export function stopSpeaking(): void {
  if (clip) {
    clip.pause();
    clip = null;
  }
  if ("speechSynthesis" in globalThis) globalThis.speechSynthesis.cancel();
}
