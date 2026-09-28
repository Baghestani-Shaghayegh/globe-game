/**
 * Builds public/data/world.geojson from Natural Earth.
 *
 *   node scripts/build-map.mjs
 *
 * The map this game shipped with was a simplified dataset that drew 177
 * shapes. Simplification works by dropping detail below a size threshold, and
 * a country smaller than that threshold does not become coarse — it vanishes.
 * Twenty-seven did: Singapore, Bahrain, Malta, Monaco, Nauru and the rest.
 * Nobody could ever name them, in any mode, because they were not there.
 *
 * So the source is now Natural Earth 1:10m, which has them, and the
 * simplification is done here where it can be told never to drop a country.
 * Detail is spent where it is visible — a coastline seen from orbit needs far
 * less of it than the source carries — and every country keeps at least enough
 * points to stay a shape.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { NOT_A_PLACE, RENAME, TERRITORY } from "./map-names.mjs";

const SOURCE = "node_modules/world-atlas/countries-10m.json";
const OUT = "public/data/world.geojson";

/**
 * How much a point has to be worth, in square degrees, to survive.
 *
 * Applied to the triangle a point makes with its neighbours — the standard
 * Visvalingam measure, which removes the flattest points first and so keeps
 * the corners that make a country recognisable.
 */
const DETAIL = 0.06;

/**
 * The most detail a single shape may lose, as a share of its own area.
 *
 * DETAIL alone is a flat rule, and a flat rule is not the same rule for
 * everybody: 0.06 square degrees is a rounding error off Brazil and the whole
 * of Kosovo, so every small country was thinned to the floor and drawn as an
 * octagon. A player reported Micronesia as an indistinct blob, and Kosovo,
 * Malta, Barbados and the rest were the same shape in different places.
 *
 * So each ring is also measured against itself: a point has to be worth this
 * share of the ring's bounding box to be dropped. Small countries keep their
 * corners, big ones are unaffected because their own share is far above
 * DETAIL and the flat rule still binds.
 */
const SHARE = 0.002;

/** Never fewer than this many points, however small the country. */
const FLOOR = 8;

/**
 * Islands whose bounding box is smaller than this, in square degrees, are
 * dropped — but never a country's last one.
 *
 * It was 0.0004, which kept 3,855 separate pieces of land: Canada alone was
 * 410 of them. The globe makes each piece its own mesh, draws each one every
 * frame, and tests each one under the pointer, so the map ran at half the
 * frame rate of the one it replaced. 0.2 — an island about fifty kilometres
 * across — keeps 628: every country, Japan's main islands, Crete, Sicily and
 * the Arctic islands, and none of the rocks nobody could see from orbit.
 */
const SPECK = 0.2;

/**
 * The smallest a place may appear on the globe, in degrees across.
 *
 * Not a number picked from the air: it is Luxembourg, which at 0.685 degrees
 * is the smallest country the map already asked people to click, and which
 * nobody has complained about. Anything below it is scaled up about its own
 * centre until it reaches it.
 *
 * This is a deliberate lie about the map, and the only alternative to a worse
 * one. Vatican City is 0.001 degrees across — a thousandth of Luxembourg, far
 * under one screen pixel at any sane zoom. Drawn truthfully it is not a
 * country you can fail to find, it is a country you cannot click, which is
 * indistinguishable from the absence we just spent this whole change undoing.
 * The shape is kept; only its scale is not true.
 */
const SMALLEST = 0.685;

const area = (a, b, c) =>
  Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;

/** Visvalingam–Whyatt, down to a detail threshold but never past a floor. */
function thin(ring, detail = DETAIL, floor = FLOOR) {
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const points = closed ? ring.slice(0, -1) : ring.slice();
  if (points.length <= floor) return ring;

  const live = points.map((p, i) => ({ p, i, gone: false }));
  let left = live.length;
  while (left > floor) {
    let worstAt = -1;
    let worst = Infinity;
    const kept = live.filter((v) => !v.gone);
    for (let i = 1; i < kept.length - 1; i++) {
      const value = area(kept[i - 1].p, kept[i].p, kept[i + 1].p);
      if (value < worst) {
        worst = value;
        worstAt = kept[i].i;
      }
    }
    if (worstAt < 0 || worst >= detail) break;
    live[worstAt].gone = true;
    left--;
  }

  const out = live.filter((v) => !v.gone).map((v) => v.p);
  return closed ? [...out, out[0]] : out;
}

/** Bounding-box area of a ring, for deciding what is a speck. */
function span(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

const round = (n) => Math.round(n * 1000) / 1000;
const trimPoint = ([x, y]) => [round(x), round(y)];
const trim = (ring) => ring.map(trimPoint);

function simplify(geometry) {
  const rings =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.coordinates;

  // Already thinned, arc by arc, before any of this was a country: what is
  // left here is deciding which pieces are worth drawing at all.
  const kept = rings.filter((polygon) => polygon[0].length >= 4);

  // Islands too small to see, unless they are all a country has. Ranked, so
  // what survives for a scattered country is its biggest pieces.
  const ranked = kept
    .map((polygon) => ({ polygon, size: span(polygon[0]) }))
    .sort((a, b) => b.size - a.size);
  const big = ranked.filter((r) => r.size >= SPECK);
  const survivors = (big.length ? big : ranked.slice(0, 1)).map((r) => r.polygon);

  return survivors.length === 1
    ? { type: "Polygon", coordinates: survivors[0] }
    : { type: "MultiPolygon", coordinates: survivors };
}

/** Every point of a geometry, for measuring and for scaling. */
function rings(geometry) {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

/**
 * Grows a place too small to click, about its own centre, and says so.
 *
 * The flag is for the globe: an inflated microstate sits where its real
 * outline did and would otherwise fight its neighbour for the same pixels, so
 * the game lifts the marked ones a little to keep them on top and clickable.
 */
function enlarge(geometry) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const ring of rings(geometry)) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const across = Math.max(maxX - minX, maxY - minY);
  if (across >= SMALLEST || across <= 0) return { geometry, tiny: false };

  const scale = SMALLEST / across;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const grow = (ring) =>
    ring.map(([x, y]) => [
      round(cx + (x - cx) * scale),
      round(cy + (y - cy) * scale),
    ]);

  const grown =
    geometry.type === "Polygon"
      ? { type: "Polygon", coordinates: geometry.coordinates.map(grow) }
      : {
          type: "MultiPolygon",
          coordinates: geometry.coordinates.map((p) => p.map(grow)),
        };
  return { geometry: grown, tiny: true };
}

/**
 * Absolute coordinates for every arc in the source topology.
 *
 * TopoJSON stores each stretch of border once, as an arc both neighbours
 * point at, delta-encoded against a quantisation grid. Undoing that here is
 * what lets the thinning happen on the shared line rather than on two private
 * copies of it.
 */
function decodeArcs(topology) {
  const [sx, sy] = topology.transform?.scale ?? [1, 1];
  const [tx, ty] = topology.transform?.translate ?? [0, 0];
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return topology.transform ? [x * sx + tx, y * sy + ty] : [x, y];
    });
  });
}

/** Every arc index a geometry is drawn from, sign and nesting undone. */
function arcsOf(geometry, into = new Set()) {
  const walk = (node) => {
    if (typeof node === "number") into.add(node < 0 ? ~node : node);
    else if (Array.isArray(node)) node.forEach(walk);
  };
  walk(geometry.arcs);
  return into;
}

/** Bounding-box area of a geometry's biggest piece, in square degrees. */
function biggestPiece(geometry, arcs) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs ?? [];
  let biggest = 0;
  for (const polygon of polygons) {
    const outer = (polygon[0] ?? []).flatMap((i) => arcs[i < 0 ? ~i : i]);
    if (outer.length) biggest = Math.max(biggest, span(outer));
  }
  return biggest;
}

const topo = JSON.parse(readFileSync(SOURCE, "utf8"));
const arcs = decodeArcs(topo);

/**
 * How hard each arc may be thinned, decided by the smallest country that
 * touches it.
 *
 * A border is shared, so it can only be thinned as gently as its most
 * demanding side: the line between Kosovo and Serbia has to keep Kosovo's
 * corners, and Serbia inherits them. This is also what keeps the two sides
 * identical afterwards — the same points, dropped by the same rule, once.
 */
const arcDetail = new Array(arcs.length).fill(DETAIL);
for (const geometry of topo.objects.countries.geometries) {
  const detail = Math.min(DETAIL, biggestPiece(geometry, arcs) * SHARE);
  for (const index of arcsOf(geometry)) {
    arcDetail[index] = Math.min(arcDetail[index], detail);
  }
}

// Thinned in place, endpoints untouched: an arc's ends are junctions where
// three or more countries meet, and moving one tears the map open.
topo.arcs = arcs.map((arc, i) => thin(arc, arcDetail[i], 2).map(trimPoint));
delete topo.transform;

const world = feature(topo, topo.objects.countries);

const features = [];
for (const f of world.features) {
  const raw = f.properties.name;
  if (!raw || NOT_A_PLACE.has(raw)) continue;
  const name = RENAME[raw] ?? raw;
  const simplified = simplify(f.geometry);
  if (!simplified.coordinates.length) continue;
  const { geometry, tiny } = enlarge(simplified);
  features.push({
    type: "Feature",
    properties: tiny ? { name, tiny: true } : { name },
    geometry,
  });
}
features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

writeFileSync(
  OUT,
  JSON.stringify({ type: "FeatureCollection", features })
);

const points = features.reduce((sum, f) => {
  const c = f.geometry.coordinates;
  return (
    sum +
    (f.geometry.type === "Polygon"
      ? c.reduce((s, r) => s + r.length, 0)
      : c.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0))
  );
}, 0);

const territories = features.filter((f) => TERRITORY.has(f.properties.name));
const grown = features.filter((f) => f.properties.tiny);
console.log(`grown to stay clickable (${grown.length}): ` +
  grown.map((f) => f.properties.name).join(", "));
console.log(
  `${features.length} places (${features.length - territories.length} countries,` +
    ` ${territories.length} territories), ${points} points,` +
    ` ${(readFileSync(OUT).length / 1024).toFixed(0)} KB`
);
