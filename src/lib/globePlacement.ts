/**
 * Where the globe sits on the menu page.
 *
 * Its own module, with nothing imported into it, because two things need these
 * numbers: the globe, which is loaded lazily so that three.js stays out of the
 * first download, and the halo drawn behind it, which is plain CSS on the page.
 * A second copy is how the glow ends up somewhere the globe is not.
 *
 * The canvas is a little taller than the window. Moving the globe down by
 * shifting a window-sized canvas cut the top off the sphere in a dead straight
 * line under the masthead — which read as the navigation covering the globe,
 * and left the halo hanging above the cut as a crescent with nothing attached
 * to it. Growing the canvas instead keeps the whole sphere drawn.
 *
 * The sphere itself comes out at 45% of the window's height in radius, sitting
 * slightly above centre, which fits it inside the window top to bottom with a
 * margin either side — on a tall screen the old size ran off both the bottom
 * and the right and stopped reading as a globe at all. The altitude in
 * BackgroundGlobe is what sets that, and the two have to be changed together.
 */
const LEFT = 0.205;
const WIDTH = 1.02;
const HEIGHT = 1.04;

/** The canvas, as a multiple of the window. */
export const GLOBE_CANVAS = { width: WIDTH, height: HEIGHT };

/** The same box in CSS, for the halo — and for the globe's own wrapper. */
export const GLOBE_BOX = {
  left: `${LEFT * 100}%`,
  top: 0,
  width: `${WIDTH * 100}vw`,
  height: `${HEIGHT * 100}vh`,
} as const;
