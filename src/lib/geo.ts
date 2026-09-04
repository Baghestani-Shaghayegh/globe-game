type Ring = [number, number][];

export type Geometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

/** Shoelace area of a ring in square degrees. Only used to compare sizes. */
function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/**
 * Where to point the camera to show a country: the middle of its largest
 * landmass. Averaging every ring instead would put France in the Atlantic and
 * the United States in the Pacific, dragged out by overseas territories and
 * Alaska.
 */
export function featureCentre(geometry: Geometry): {
  lat: number;
  lng: number;
  /** Rough width of that landmass in degrees, for choosing a zoom level. */
  span: number;
} {
  const rings: Ring[] =
    geometry.type === "Polygon"
      ? geometry.coordinates.slice(0, 1)
      : geometry.coordinates.map((polygon) => polygon[0]);

  let largest = rings[0];
  let largestArea = -1;
  for (const ring of rings) {
    const area = ringArea(ring);
    if (area > largestArea) {
      largestArea = area;
      largest = ring;
    }
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of largest) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const lat = (minLat + maxLat) / 2;
  const lng = (minLng + maxLng) / 2;
  // Degrees of longitude get narrower towards the poles, so scale by latitude
  // or Russia and Greenland read as far wider than they appear on the globe.
  const lngSpan = (maxLng - minLng) * Math.cos((lat * Math.PI) / 180);
  return { lat, lng, span: Math.max(maxLat - minLat, Math.abs(lngSpan)) };
}

/**
 * How far out to sit so a country of this size fills a useful part of the view.
 * The floor has to be low: Luxembourg is under a degree across and is invisible
 * from anywhere a country like France looks right.
 */
export function altitudeFor(span: number): number {
  return Math.min(2.2, Math.max(0.38, 0.25 + span / 22));
}
