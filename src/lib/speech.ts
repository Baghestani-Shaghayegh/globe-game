/**
 * Saying a place name out loud, for the speaker buttons in a lesson.
 *
 * The browser's own speech, not recorded clips: it costs nothing to ship,
 * works offline, and covers every country and capital on the map without
 * anyone having to record them. The voice is whatever English one the
 * device has, so it sounds different on a phone and a laptop — and a name
 * like Ouagadougou comes out the way an English speaker would say it, which
 * is the point for someone learning the map in English.
 */

/** Whether this browser can speak at all. The button isn't shown if not. */
export function canSpeak(): boolean {
  return "speechSynthesis" in globalThis;
}

/**
 * The voice to use: British English first, since the game spells the British
 * way, then any English, then the device's default.
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

/**
 * Says `text`, cutting off anything already being said, so pressing a second
 * button doesn't queue behind the first. `onEnd` runs when it stops, however
 * it stops. Not tied to the game's mute: this only ever plays because the
 * player pressed the button asking for it.
 */
export function speak(text: string, onEnd?: () => void): void {
  if (!canSpeak()) {
    onEnd?.();
    return;
  }
  const synth = globalThis.speechSynthesis;
  synth.cancel();
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

/** Stops anything being said — when the lesson moves on, say. */
export function stopSpeaking(): void {
  if (canSpeak()) globalThis.speechSynthesis.cancel();
}
