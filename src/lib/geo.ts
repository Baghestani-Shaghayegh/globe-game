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
 * A ring with its longitudes made continuous. Russia's mainland and Fiji are
 * drawn across the 180° line, so their coordinates leap from 179.9 to -180
 * mid-ring; taken literally, the box round Russia runs the whole way round
 * the world and its middle lands in the North Sea.
 *
 * A ring round a pole (Antarctica) leaps too, but there the leap is the ring
 * closing along the edge of the map, so it is left as drawn.
 */
function unwrap(ring: Ring): Ring {
  const out: Ring = [];
  let shift = 0;
  for (const [lng, lat] of ring) {
    const prev = out[out.length - 1];
    if (prev) {
      const step = lng + shift - prev[0];
      if (step > 180) shift -= 360;
      else if (step < -180) shift += 360;
    }
    out.push([lng + shift, lat]);
  }
  return shift === 0 ? out : ring;
}

/** Back into -180..180 after unwrapping may have carried it past. */
const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

/** The country's largest landmass, outline first and then any holes. */
function largestPolygon(geometry: Geometry): Ring[] {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let largest = polygons[0];
  let largestArea = -1;
  for (const polygon of polygons) {
    const area = ringArea(unwrap(polygon[0]));
    if (area > largestArea) {
      largestArea = area;
      largest = polygon;
    }
  }
  return largest.map(unwrap);
}

function bounds(ring: Ring) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
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
  const { minLng, maxLng, minLat, maxLat } = bounds(
    largestPolygon(geometry)[0]
  );

  const lat = (minLat + maxLat) / 2;
  const lng = wrapLng((minLng + maxLng) / 2);
  // Degrees of longitude get narrower towards the poles, so scale by latitude
  // or Russia and Greenland read as far wider than they appear on the globe.
  const lngSpan = (maxLng - minLng) * Math.cos((lat * Math.PI) / 180);
  return { lat, lng, span: Math.max(maxLat - minLat, Math.abs(lngSpan)) };
}

/**
 * Signed distance from a point to a polygon's edge: positive inside, negative
 * outside. Points are already in the flattened frame `labelPoint` works in.
 */
function edgeDistance(x: number, y: number, polygon: Ring[]): number {
  let inside = false;
  let nearest = Infinity;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) {
        inside = !inside;
      }
      let dx = bx - ax;
      let dy = by - ay;
      let px = ax;
      let py = ay;
      if (dx !== 0 || dy !== 0) {
        const t = Math.max(
          0,
          Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))
        );
        px += dx * t;
        py += dy * t;
      }
      dx = x - px;
      dy = y - py;
      nearest = Math.min(nearest, dx * dx + dy * dy);
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(nearest);
}

/**
 * Where to write a country's name: the point on its largest landmass that is
 * furthest from any coast or border. The middle of the box round it can sit
 * off to one side of a country, or outside it altogether — Croatia's is in
 * Bosnia — while this is always well inside the land.
 *
 * Found by the usual pole-of-inaccessibility search: split the box into
 * cells, and keep splitting only the cells that could still beat the best
 * point found so far. Longitude is squeezed by the cosine of the latitude
 * first so that a degree counts the same both ways, as it does on the globe.
 */
export function labelPoint(geometry: Geometry): { lat: number; lng: number } {
  const lngLat = largestPolygon(geometry);
  const box = bounds(lngLat[0]);
  const squeeze = Math.cos((((box.minLat + box.maxLat) / 2) * Math.PI) / 180);
  const polygon: Ring[] = lngLat.map((ring) =>
    ring.map(([lng, lat]) => [lng * squeeze, lat])
  );

  const minX = box.minLng * squeeze;
  const width = (box.maxLng - box.minLng) * squeeze;
  const height = box.maxLat - box.minLat;
  const cellSize = Math.min(width, height);
  const toLngLat = (x: number, y: number) => ({
    lat: y,
    lng: wrapLng(x / squeeze),
  });
  if (!(cellSize > 0)) return toLngLat(minX, box.minLat);

  type Cell = { x: number; y: number; h: number; d: number; max: number };
  const cell = (x: number, y: number, h: number): Cell => {
    const d = edgeDistance(x, y, polygon);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  const queue: Cell[] = [];
  let h = cellSize / 2;
  for (let x = minX; x < minX + width; x += cellSize) {
    for (let y = box.minLat; y < box.maxLat; y += cellSize) {
      queue.push(cell(x + h, y + h, h));
    }
  }

  let best = cell(minX + width / 2, box.minLat + height / 2, 0);
  // About a hundredth of the country's size: far finer than a label needs.
  const precision = Math.max(width, height) / 100;
  while (queue.length) {
    // Most promising cell first. The queue stays small enough that a scan
    // is simpler than a heap and no slower in practice.
    let top = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].max > queue[top].max) top = i;
    }
    const c = queue[top];
    queue[top] = queue[queue.length - 1];
    queue.pop();

    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) continue;

    h = c.h / 2;
    queue.push(
      cell(c.x - h, c.y - h, h),
      cell(c.x + h, c.y - h, h),
      cell(c.x - h, c.y + h, h),
      cell(c.x + h, c.y + h, h)
    );
  }
  return toLngLat(best.x, best.y);
}

/**
 * How far out to sit so a country of this size fills a useful part of the view.
 * The floor has to be low: Luxembourg is under a degree across and is invisible
 * from anywhere a country like France looks right.
 */
export function altitudeFor(span: number): number {
  return Math.min(2.2, Math.max(0.38, 0.25 + span / 22));
}


/**
 * How far back the camera sits to show the whole world in a round.
 *
 * One number for every game, worked out rather than picked: the globes each
 * carried their own 2.1, which was uniform by luck and left the sphere small
 * in the middle of a lot of empty screen.
 *
 * The lens is vertical, so the sphere's size follows the window's height —
 * but on a window taller than it is wide, the *width* is what runs out first.
 * Hence the `min`: the globe is sized against whichever edge it would reach
 * soonest, which is what keeps it inside the view on a phone held upright
 * without shrinking it on a desktop.
 */
export const ROUND_FOV = 50;

/** How much of the shorter edge the sphere's diameter is allowed to take. */
const FILL = 0.88;

export function worldAltitude(width: number, height: number): number {
  if (!width || !height) return 2.1;
  const wanted = (FILL * Math.min(width, height)) / height;
  const spread = Math.tan((ROUND_FOV / 2) * (Math.PI / 180));
  // Invert the projection: radius = (height / 2) * (1 / sqrt((1+a)^2 - 1)) / tan(fov/2)
  const reach = 1 / (wanted * spread);
  return Math.max(0.6, Math.sqrt(1 + reach * reach) - 1);
}
