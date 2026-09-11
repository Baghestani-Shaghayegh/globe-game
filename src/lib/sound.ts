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

/**
 * A guess in the mystery round, pitched by how close it landed. Warmer is
 * literally higher: the sound carries the same information as the colour, for
 * anyone who plays with their eyes on the globe rather than the readout.
 *
 * `closeness` runs 0 (cold) to 1 (on top of it).
 */
export function playWarm(closeness: number) {
  if (!playing()) return;
  const clamped = Math.min(1, Math.max(0, closeness));
  tone(step(C5, -12 + Math.round(clamped * 19)), {
    type: "triangle",
    duration: 0.16,
    volume: 0.13,
  });
}

/** A puzzle solved — the daily, the mystery, a chain joined up. */
export function playSolved() {
  if (!playing()) return;
  [0, 4, 7, 12, 16].forEach((note, i) =>
    tone(step(C5, note), {
      type: "triangle",
      start: i * 0.08,
      duration: 0.35,
      volume: 0.15,
    })
  );
}

/** A step that lands but doesn't finish anything: a country placed, a pair won. */
export function playStep(height = 0) {
  if (!playing()) return;
  tone(step(C5, Math.min(height, 12)), {
    type: "triangle",
    duration: 0.12,
    volume: 0.13,
  });
}

/** A run ending badly — the wrong pick, the broken chain. */
export function playLose() {
  if (!playing()) return;
  [7, 3, 0].forEach((note, i) =>
    tone(step(C5, note - 12), {
      type: "sawtooth",
      start: i * 0.1,
      duration: 0.26,
      volume: 0.09,
    })
  );
}

/**
 * A button, a card, a tab. Quiet and short on purpose: a menu click that
 * announces itself is one you turn the sound off to escape.
 */
export function playTap() {
  if (!playing()) return;
  tone(step(C5, 7), { type: "sine", duration: 0.045, volume: 0.045 });
}

/** Someone else's move in a shared room — an opponent scoring, a player joining. */
export function playOther() {
  if (!playing()) return;
  tone(step(C5, -7), { type: "sine", duration: 0.1, volume: 0.08 });
  tone(step(C5, -2), { type: "sine", start: 0.07, duration: 0.12, volume: 0.06 });
}

/**
 * One second going by, in the last stretch of a countdown.
 *
 * Very quiet, and only worth playing when the clock is nearly out: a tick for
 * every second of a five-minute round would be a metronome nobody asked for.
 * The final second is a touch higher, so running out is heard as arriving
 * somewhere rather than as the ticking simply stopping.
 */
export function playTick(secondsLeft: number) {
  if (!playing()) return;
  tone(step(C5, secondsLeft <= 1 ? 0 : -12), {
    type: "sine",
    duration: 0.06,
    volume: 0.07,
  });
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
