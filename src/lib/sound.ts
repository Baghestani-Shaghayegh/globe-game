/**
 * The game's sounds, synthesised rather than loaded.
 *
 * Half a dozen short tones do not justify half a dozen audio files: files are
 * bytes to download, another thing to cache for offline, and another licence
 * to keep track of. The Web Audio API makes these shapes in a few lines each,
 * and they cost nothing until the first one plays.
 *
 * Every sound follows a click or a keystroke, which matters: browsers keep an
 * AudioContext suspended until a gesture, so `resume()` on each play is what
 * makes the first sound of a session arrive rather than being swallowed.
 */
import { soundEnabled } from "./prefs";

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;

/** The context, made on first use. Null where Web Audio isn't available. */
function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctx: Ctor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    ctx = new Ctx();
  } catch {
    // Some browsers refuse before any interaction at all; try again next time.
    return null;
  }
  return ctx;
}

/**
 * One note. Shaped with an attack and an exponential decay — a bare gain that
 * stops dead clicks, which is worse than no sound at all.
 */
function tone(
  frequency: number,
  {
    type = "sine",
    start = 0,
    duration = 0.12,
    volume = 0.18,
    glideTo,
  }: {
    type?: OscillatorType;
    start?: number;
    duration?: number;
    volume?: number;
    /** Slides to this frequency across the note, for a rise or a fall. */
    glideTo?: number;
  } = {}
) {
  const context = audio();
  if (!context) return;

  const at = context.currentTime + start;
  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + duration);

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(gain).connect(context.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** Whether to make a noise at all: the player's setting, checked every time. */
function playing(): boolean {
  if (!soundEnabled()) return false;
  const context = audio();
  if (!context) return false;
  // Suspended until the page has been interacted with. Every call site is a
  // click or a keypress, so this resolves in time to be heard.
  if (context.state === "suspended") void context.resume();
  return true;
}

/** Semitones above a base note, as a frequency. */
function step(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12);
}

const C5 = 523.25;

/**
 * A correct answer, climbing with the streak.
 *
 * The pitch walks up a major pentatonic scale, so a run of right answers plays
 * a rising phrase rather than the same blip eight times. It tops out after
 * nine so a long streak stays musical instead of shrill.
 */
export function playCorrect(streak: number) {
  if (!playing()) return;
  const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  const note = PENTATONIC[Math.min(streak, PENTATONIC.length - 1)];
  tone(step(C5, note), { type: "triangle", duration: 0.14, volume: 0.16 });
  // A fifth above, quieter and a beat later: the interval is what makes it
  // read as an arrival rather than a beep.
  tone(step(C5, note + 7), {
    type: "sine",
    start: 0.05,
    duration: 0.16,
    volume: 0.07,
  });
}

/** A wrong answer: low, short, and falling. Not a punishment, just a no. */
export function playWrong() {
  if (!playing()) return;
  tone(180, {
    type: "sawtooth",
    duration: 0.18,
    volume: 0.1,
    glideTo: 120,
  });
}

/** Buying a hint — a soft neutral tick, since it is neither win nor loss. */
export function playHint() {
  if (!playing()) return;
  tone(step(C5, -5), { type: "sine", duration: 0.09, volume: 0.08 });
}

/** The end of a round: a major triad up when it was finished, down when not. */
export function playRoundEnd(completed: boolean) {
  if (!playing()) return;
  const notes = completed ? [0, 4, 7, 12] : [7, 4, 0];
  notes.forEach((note, i) =>
    tone(step(C5, note), {
      type: "triangle",
      start: i * 0.11,
      duration: 0.3,
      volume: completed ? 0.15 : 0.1,
    })
  );
}

/** A personal best, landing on top of the round-end triad. */
export function playRecord() {
  if (!playing()) return;
  [0, 7, 12, 19].forEach((note, i) =>
    tone(step(C5, note), {
      type: "sine",
      start: 0.45 + i * 0.07,
      duration: 0.34,
      volume: 0.13,
    })
  );
}
