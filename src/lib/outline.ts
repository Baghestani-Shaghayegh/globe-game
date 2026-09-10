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
export function outlinePath(geometry: Geometry, padding = 6): string {
  const rings = ringsOf(geometry).filter((ring) => ring.length > 2);
  if (!rings.length) return "";

  const biggest = Math.max(...rings.map(ringArea));
  const kept = rings.filter((ring) => ringArea(ring) >= biggest * 0.006);

  // Latitude of the middle of the shape, for the longitude squeeze.
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of kept) {
    for (const [, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const squeeze = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const projected = kept.map((ring) =>
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
