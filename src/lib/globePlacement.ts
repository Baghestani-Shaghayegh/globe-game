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
 * Size. The sphere's radius is 48.5% of the canvas height, so a canvas the
 * height of the window fills it very nearly top to bottom. But the globe sits
 * to the right, and on a window that is wide-but-short the right-hand limb
 * reaches the edge of the screen long before the top and bottom do — hence
 * the width term: the canvas is the smaller of the window's height and
 * `WIDEST` of its width, whichever pins the sphere inside the screen first.
 * The altitude in BackgroundGlobe is what turns canvas height into radius, so
 * that constant and these move together.
 */
const LEFT = 0.205;
const WIDTH = 1.02;

/**
 * The canvas height as a fraction of the window's width, used when the window
 * is wide and short. Derived, not guessed: the sphere's centre lands at
 * (LEFT + WIDTH / 2) of the width, so its radius can be at most the
 * (1 − that) remaining, and radius is 0.485 of the canvas height.
 */
const WIDEST = 0.57;

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
