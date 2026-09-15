import type { Geometry } from "./geo";

/**
 * A country reduced to its shape.
 *
 * Every ring is kept, not just the largest — Indonesia and the Philippines
 * *are* their scatter of islands, and drawing only the biggest one would be a
 * different country. The whole set is framed together so the proportions hold.
 */

export const VIEW = 100;

type Ring = [number, number][];

function ringsOf(geometry: Geometry): Ring[] {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.map((polygon) => polygon[0]);
}

/** Shoelace area in square degrees, for deciding what's worth drawing. */
function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/**
 * An SVG path for a country, scaled into a square box.
 *
 * Longitude is squeezed by cos(latitude) first, or every country far from the
 * equator comes out stretched sideways — Norway would look nothing like
 * Norway.
 *
 * Slivers below a fraction of the largest ring are dropped: at this size they
 * are single pixels, and a hundred of them is just noise around the shape.
 */
/** The bounding box of a ring, as a centre and a radius. */
function ringBounds(ring: Ring) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    reach: Math.hypot(maxX - minX, maxY - minY) / 2,
  };
}

/**
 * How far a ring may sit from the main landmass, as a multiple of that
 * landmass's own size, and how small it has to be before the distance counts
 * against it.
 *
 * Both conditions, never one. Far-flung *and* minor is an overseas territory;
 * far-flung and major is simply the country. Measured across all 167: France's
 * départements are nine times out at a ninth of the mainland, while every
 * genuine island scatter is far but big — Indonesia is 3.4 times out at 78%,
 * the Philippines 2.2 at 85%, the Solomons 3.6 at 57%. Nothing else on the map
 * sits between the two.
 */
const FAR = 3;
const MINOR = 0.25;

/**
 * Drops the outlying territories that were framing the picture.
 *
 * France was the case that showed it: drawn with French Guiana and Réunion,
 * the box spanned two oceans and mainland France came out as a thumbnail in
 * one corner. The overseas départements are France, but they are not its
 * *shape*, and the shape is what both games that use this are asking about.
 */
function mainland(rings: Ring[]): Ring[] {
  if (rings.length < 2) return rings;
  const areas = rings.map(ringArea);
  const biggest = Math.max(...areas);
  const main = ringBounds(rings[areas.indexOf(biggest)]);
  if (main.reach <= 0) return rings;

  const near = rings.filter((ring, i) => {
    const bounds = ringBounds(ring);
    const away = Math.hypot(bounds.x - main.x, bounds.y - main.y) / main.reach;
    return away <= FAR || areas[i] > biggest * MINOR;
  });
  // Never everything: a shape has to be left to draw.
  return near.length ? near : rings;
}

export function outlinePath(geometry: Geometry, padding = 6): string {
  const rings = ringsOf(geometry).filter((ring) => ring.length > 2);
  if (!rings.length) return "";

  const biggest = Math.max(...rings.map(ringArea));
  const kept = rings.filter((ring) => ringArea(ring) >= biggest * 0.006);

  // Latitude of the middle of the shape, for the longitude squeeze.
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const ring of kept) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  /**
   * Countries that cross the 180th meridian are stored with longitudes at
   * both ends of the scale — Fiji runs from 177 to -178, three degrees of
   * ocean written as three hundred and fifty-five. Framed on that span, Fiji
   * came out as a couple of specks on opposite edges of an empty box, and
   * Russia lost most of its width to sea it does not occupy.
   *
   * A country cannot really span more than half the globe, so a span wider
   * than that is this, not a genuinely enormous country: carry the negative
   * side round past 180 and the shape is contiguous again.
   */
  const wraps = maxLng - minLng > 180;
  const unwrap = (lng: number) => (wraps && lng < 0 ? lng + 360 : lng);
  const straightened = kept.map((ring) =>
    ring.map(([lng, lat]) => [unwrap(lng), lat] as [number, number])
  );

  const near = mainland(straightened);

  // From what survives, not from what was dropped: framing on the mainland and
  // then squeezing by the latitude of a territory an ocean away would stretch
  // the shape that is actually drawn.
  let lowLat = Infinity;
  let highLat = -Infinity;
  for (const ring of near) {
    for (const [, lat] of ring) {
      if (lat < lowLat) lowLat = lat;
      if (lat > highLat) highLat = lat;
    }
  }
  const squeeze = Math.cos((((lowLat + highLat) / 2) * Math.PI) / 180);

  const projected = near.map((ring) =>
    ring.map(([lng, lat]) => [lng * squeeze, -lat] as [number, number])
  );

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of projected) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const span = Math.max(width, height, 1e-9);
  const scale = (VIEW - padding * 2) / span;
  // Centred in the box, so a wide country and a tall one both sit in the middle.
  const offsetX = padding + (VIEW - padding * 2 - width * scale) / 2;
  const offsetY = padding + (VIEW - padding * 2 - height * scale) / 2;

  const round = (n: number) => Math.round(n * 100) / 100;

  return projected
    .map((ring) => {
      const points = ring.map(
        ([x, y]) =>
          `${round((x - minX) * scale + offsetX)},${round((y - minY) * scale + offsetY)}`
      );
      return `M${points.join("L")}Z`;
    })
    .join("");
}
