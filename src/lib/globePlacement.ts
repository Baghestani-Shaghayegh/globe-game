/**
 * Where the globe sits on the menu page: off to the right and dropped below
 * the middle, wide enough that its right-hand limb runs off the edge of the
 * screen rather than floating in the corner.
 *
 * Its own module, with nothing imported into it, because two things need it:
 * the globe, which is loaded lazily so that three.js stays out of the first
 * download, and the halo drawn behind it, which is plain CSS on the page. A
 * second copy of these numbers is how the glow ends up somewhere the globe
 * is not.
 */
export const GLOBE_PLACEMENT = {
  left: "31%",
  right: "-17%",
  top: "5%",
  bottom: "-5%",
} as const;

/**
 * How much of the window the globe's canvas spans, which is just what `left`
 * and `right` above leave between them: 100% − 31% + 17%. Kept here beside
 * them so moving the globe cannot leave the canvas the wrong width behind it.
 */
export const GLOBE_WIDTH = 0.86;
