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

/** Value at a percentile of a sorted copy of the list. */
function percentile(sorted: number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

/**
 * Where to sit to take in a whole region.
 *
 * Built from each country's centre rather than a bounding box over every
 * coordinate, and read at the 10th/90th percentile rather than the extremes,
 * because one outlier ruins the framing: Russia counts as Europe, and its
 * largest landmass is in Siberia, which would otherwise drag the continent's
 * view thousands of kilometres east.
 */
export function regionFraming(
  centres: { lat: number; lng: number }[]
): { lat: number; lng: number; altitude: number } | null {
  if (centres.length === 0) return null;

  const lats = centres.map((c) => c.lat).sort((a, b) => a - b);
  const lngs = centres.map((c) => c.lng).sort((a, b) => a - b);
  const lat = percentile(lats, 0.5);
  const lng = percentile(lngs, 0.5);

  const latSpan = percentile(lats, 0.9) - percentile(lats, 0.1);
  const lngSpan =
    (percentile(lngs, 0.9) - percentile(lngs, 0.1)) *
    Math.cos((lat * Math.PI) / 180);
  const span = Math.max(latSpan, Math.abs(lngSpan));

  // A gentler curve than altitudeFor: this frames a whole region, not one
  // country, so it should sit back far enough to keep the edges in view.
  return { lat, lng, altitude: Math.min(1.95, Math.max(0.6, 0.38 + span / 44)) };
}
