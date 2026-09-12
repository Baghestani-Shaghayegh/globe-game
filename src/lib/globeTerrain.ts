import * as THREE from "three";

/**
 * The land's relief: lighting and a mottled ground texture.
 *
 * three-globe paints country caps with an unlit `MeshBasicMaterial`, which is
 * why a flat fill stayed flat — no light in the scene could touch it. Swapping
 * in a lit material is what gives the globe a sunlit upper left and a lower
 * hemisphere that falls away into shadow, and it is the single biggest part of
 * looking like a lit sphere rather than a coloured circle.
 *
 * Everything here is generated at runtime. A terrain image would be another
 * megabyte over the wire for something the player looks at for five seconds on
 * the menu.
 */

/** Deterministic, so the same coastline is mottled the same way every load. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * One octave of value noise on a wrapping lattice, so the texture tiles
 * without a seam showing up as a straight line across a continent.
 */
function octave(size: number, cells: number, rng: () => number): Float32Array {
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = rng();

  const out = new Float32Array(size * size);
  const scale = cells / size;
  for (let y = 0; y < size; y += 1) {
    const fy = y * scale;
    const y0 = Math.floor(fy);
    const ty = smooth(fy - y0);
    for (let x = 0; x < size; x += 1) {
      const fx = x * scale;
      const x0 = Math.floor(fx);
      const tx = smooth(fx - x0);
      const x1 = (x0 + 1) % cells;
      const y1 = (y0 + 1) % cells;
      const top =
        lattice[y0 * cells + x0] +
        (lattice[y0 * cells + x1] - lattice[y0 * cells + x0]) * tx;
      const bottom =
        lattice[y1 * cells + x0] +
        (lattice[y1 * cells + x1] - lattice[y1 * cells + x0]) * tx;
      out[y * size + x] = top + (bottom - top) * ty;
    }
  }
  return out;
}

const TEXTURE_SIZE = 256;

/**
 * How dark the darkest patch of ground goes, as a fraction of the country's
 * own colour. A multiply map can only ever darken, so the mottling is a
 * shallow dip rather than a swing either side — anything deeper stopped
 * reading as terrain and started reading as dirt on the lens.
 */
const FLOOR = 0.86;

let texture: THREE.CanvasTexture | null = null;

/** Three octaves of noise, dark patches on an otherwise clean surface. */
function terrainTexture(): THREE.CanvasTexture {
  if (texture) return texture;

  const rng = seeded(0x51ce);
  const octaves: { data: Float32Array; weight: number }[] = [
    { data: octave(TEXTURE_SIZE, 4, rng), weight: 0.5 },
    { data: octave(TEXTURE_SIZE, 9, rng), weight: 0.32 },
    { data: octave(TEXTURE_SIZE, 18, rng), weight: 0.18 },
  ];

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context for the terrain texture");
  const image = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);

  for (let i = 0; i < TEXTURE_SIZE * TEXTURE_SIZE; i += 1) {
    let value = 0;
    for (const { data, weight } of octaves) value += data[i] * weight;
    const level = Math.round((FLOOR + (1 - FLOOR) * value) * 255);
    image.data[i * 4] = level;
    image.data[i * 4 + 1] = level;
    image.data[i * 4 + 2] = level;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Country caps are UV-mapped to their own bounding box, so one repeat count
 * would stretch the same patch of ground across Russia and squeeze it into
 * Luxembourg. Tiling by how wide the country actually is keeps the grain
 * roughly the same size everywhere, and quantising to a few buckets keeps the
 * number of textures down to those few rather than one per country.
 */
const REPEATS = [1, 2, 4, 8];

export function repeatForSpan(span: number): number {
  const wanted = span / 14;
  let best = REPEATS[0];
  for (const repeat of REPEATS) {
    if (Math.abs(repeat - wanted) < Math.abs(best - wanted)) best = repeat;
  }
  return best;
}

const tiled = new Map<number, THREE.Texture>();

function tiledTexture(repeat: number): THREE.Texture {
  const existing = tiled.get(repeat);
  if (existing) return existing;
  const clone = terrainTexture().clone();
  clone.needsUpdate = true;
  clone.repeat.set(repeat, repeat);
  tiled.set(repeat, clone);
  return clone;
}

const materials = new Map<string, THREE.MeshLambertMaterial>();

/**
 * A lit, matte, gently mottled material for one shade of land. Cached, because
 * the globe asks for a material per country on every repaint and there are
 * only ever a handful of distinct shades.
 */
export function landMaterial(
  color: string,
  repeat: number
): THREE.MeshLambertMaterial {
  const key = `${color}@${repeat}`;
  const existing = materials.get(key);
  if (existing) return existing;

  const material = new THREE.MeshLambertMaterial({
    color,
    map: tiledTexture(repeat),
  });
  materials.set(key, material);
  return material;
}

/** Dropped when the palette changes, or every old shade would stay cached. */
export function forgetLandMaterials() {
  for (const material of materials.values()) material.dispose();
  materials.clear();
}

/**
 * Sun from the upper left, with enough ambient that the far side stays a
 * colour rather than going black. The two intensities are what set the range
 * the land moves through: ambient alone at the terminator, ambient plus
 * directional where the light is square on.
 */
export function sunlitLights(): {
  lights: THREE.Light[];
  /** Re-points the sun for where the camera is now. */
  aim: (camera: THREE.Camera) => void;
} {
  // Faintly warm key against a faintly cool fill. Land lit by a single white
  // lamp brightens straight along its own hue, which reads as "turned up"
  // rather than as sunlight; splitting the two by colour temperature is what
  // takes the sunlit side towards turquoise and the far side towards blue.
  //
  // The two intensities were set by measuring the rendered globe rather than
  // by eye: they put the middle of the land on #23616A, the sunlit end near
  // #43858A and the shadowed end around #123D48.
  const sun = new THREE.DirectionalLight(0xffe8d8, 1.25 * Math.PI);
  const toCamera = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  /**
   * The light is placed relative to the camera rather than pinned to a corner
   * of the world. A world-fixed sun drifts as the globe turns and ends up
   * behind it; what the design wants is a fixed key light up and to the left
   * of whoever is looking, which means moving it whenever the camera moves.
   *
   * A directional light shines from its position towards its target, and the
   * target defaults to the origin — which is the centre of the globe.
   */
  const aim = (camera: THREE.Camera) => {
    // The camera has usually just been moved and its world matrix is only
    // refreshed at render time. Reading it stale put the sun on the far side
    // of the globe from where the design wants it.
    camera.updateMatrixWorld();
    camera.getWorldDirection(toCamera).multiplyScalar(-1);
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    sun.position
      .copy(toCamera)
      // Left and up by about this much each: the bright spot then sits in the
      // upper-left quarter of the disc, roughly forty degrees off the line of
      // sight, and the terminator crosses the lower right.
      .addScaledVector(right, -0.8)
      .addScaledVector(up, 0.58)
      .normalize()
      .multiplyScalar(400);
  };

  return {
    lights: [new THREE.AmbientLight(0xc3dcf0, 0.8 * Math.PI), sun],
    aim,
  };
}
