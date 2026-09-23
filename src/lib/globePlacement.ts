/**
 * Where the globe sits on the menu page.
 *
 * Its own module, with nothing imported into it, because two things need these
 * numbers: the globe, which is loaded lazily so that three.js stays out of the
 * first download, and the halo drawn behind it, which is plain CSS on the page.
 * A second copy is how the glow ends up somewhere the globe is not.
 *
 * The canvas starts at the top of the window rather than being pushed down it.
 * Shifting a window-sized canvas cut the top off the sphere in a dead straight
 * line under the masthead — which read as the navigation covering the globe,
 * and left the halo hanging above the cut as a crescent with nothing attached
 * to it. The sphere is allowed to run up behind the masthead, which has no
 * background of its own; what it must not do is leave the window.
 *
 * Size. The sphere's radius is 49.5% of the canvas height, so a canvas the
 * height of the window all but fills it top to bottom — 50% is the ceiling,
 * where the sphere would touch both edges at once. On a window that is
 * wide-but-short a limb reaches the edge of the screen before the top and
 * bottom do — hence the width term: the canvas is the smaller of the window's
 * height and `WIDEST` of its width, whichever pins the sphere inside the
 * screen first. The altitude in BackgroundGlobe is what turns canvas height
 * into radius, so that constant and these move together.
 *
 * The globe used to sit off to the right, beside a column of words down the
 * left. The menu is a centred column now, so the sphere is centred under it:
 * the cards sit on the face of it and the limb shows on both sides rather
 * than one.
 */
const WIDTH = 1.02;
const LEFT = 0.5 - WIDTH / 2;

/**
 * The canvas height as a fraction of the window's width, used when the window
 * is wide and short. Derived, not guessed: the sphere's centre lands at
 * (LEFT + WIDTH / 2) of the width — the middle, now — so its radius can be at
 * most the half remaining, and radius is 0.495 of the canvas height.
 */
const WIDEST = 0.5 / 0.495;

/** The canvas in pixels, for the globe. */
export function globeCanvas(window: { width: number; height: number }): {
  width: number;
  height: number;
} {
  return {
    width: window.width * WIDTH,
    height: Math.min(window.height, window.width * WIDEST),
  };
}

/** The same box in CSS, for the halo — and for the globe's own wrapper. */
export const GLOBE_BOX = {
  left: `${LEFT * 100}%`,
  top: 0,
  width: `${WIDTH * 100}vw`,
  height: `min(100vh, ${WIDEST * 100}vw)`,
} as const;
