import { geoCentroid, geoGraticule10, geoOrthographic, geoPath, type GeoGeometryObjects } from "d3-geo";

/**
 * Turns a result into an image worth posting.
 *
 * Drawn on a canvas rather than screenshotted: the card wants to be the same
 * shape whatever device made it, and Instagram wants a portrait it doesn't
 * have to crop. Tiles are drawn as coloured rectangles rather than emoji —
 * emoji render differently on every platform, and half the point is that the
 * card looks like the game.
 */

/**
 * Full-screen portrait, 9:16: the shape of an Instagram or Facebook story, a
 * TikTok and a YouTube Short. The 4:5 feed card it replaced left a band of
 * blur top and bottom in every one of those, which is where people actually
 * post a game result now.
 */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

export type CardGlobe = {
  /** The whole map, to draw the land. */
  features: { properties: { name: string }; geometry: GeoGeometryObjects }[];
  /** The countries to light up, and in what colour. */
  colors: Record<string, string>;
};

export type CardSpec = {
  /** Small line above the title: which game. */
  eyebrow: string;
  title: string;
  /** The line under the title — score, count, whatever the mode counts. */
  subtitle: string;
  /** One colour per square, in the order they were earned. */
  tiles: string[];
  /** Optional line under the tiles. */
  note?: string;
  /** The result drawn on a globe, turned to face the countries lit. */
  globe?: CardGlobe;
  /** Where to play: the site's address, printed at the foot. */
  site?: string;
};

const BACKGROUND = "#07111c";
const INK = "#fafafa";
const MUTED = "#8b8b95";
const ACCENT = "#5eead4";
const OCEAN = "#082b43";
const LAND = "#2b6469";
const BORDER = "rgba(255,255,255,0.16)";

/** The globe's place on the card. */
export const GLOBE = { cx: CARD_WIDTH / 2, cy: 930, r: 380 };

/** The band the tiles are allowed to occupy: under the globe, or in its place. */
export function tileBand(withGlobe: boolean): { top: number; height: number } {
  return withGlobe ? { top: 1380, height: 190 } : { top: 620, height: 800 };
}

/** Kept for the layout tests: the band a card without a globe gives its tiles. */
export const TILE_BAND_TOP = tileBand(false).top;
export const TILE_BAND_HEIGHT = tileBand(false).height;

/**
 * How big each tile can be, and how to wrap them.
 *
 * Ten tiles sit on one line; thirty have to wrap or each would be four pixels
 * wide. The block is bounded in both directions — a tall stack of rows once
 * pushed the note down onto the wordmark, which is the sort of thing only a
 * long round would ever have shown.
 */
export function tileLayout(
  count: number,
  maxWidth: number,
  maxHeight: number = TILE_BAND_HEIGHT
): { perRow: number; size: number; gap: number; rows: number; height: number } {
  if (count <= 0) return { perRow: 0, size: 0, gap: 0, rows: 0, height: 0 };

  const perRow = Math.min(count, count <= 12 ? count : Math.ceil(Math.sqrt(count * 1.8)));
  const rows = Math.ceil(count / perRow);
  const gap = 16;
  const byWidth = (maxWidth - gap * (perRow - 1)) / perRow;
  const byHeight = (maxHeight - gap * (rows - 1)) / rows;
  const size = Math.max(12, Math.floor(Math.min(96, byWidth, byHeight)));

  return { perRow, size, gap, rows, height: rows * size + (rows - 1) * gap };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/**
 * The result on a globe, turned to face the countries that are lit: the
 * picture that says "this game" at a glance in a feed of other stories.
 */
function drawGlobe(ctx: CanvasRenderingContext2D, globe: CardGlobe) {
  const lit = globe.features.filter((f) => globe.colors[f.properties.name]);
  const [lng, lat] = lit.length
    ? geoCentroid({ type: "FeatureCollection", features: lit.map((f) => ({ type: "Feature", properties: {}, geometry: f.geometry })) } as never)
    : [10, 20];
  const projection = geoOrthographic()
    .scale(GLOBE.r)
    .translate([GLOBE.cx, GLOBE.cy])
    .rotate([-lng, -Math.max(-50, Math.min(50, lat))])
    .clipAngle(90);
  const path = geoPath(projection, ctx);

  // The sea, with a soft rim of light round the edge as in the game.
  ctx.fillStyle = OCEAN;
  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fill();

  ctx.strokeStyle = "rgba(94,234,212,0.10)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  path(geoGraticule10());
  ctx.stroke();

  for (const feature of globe.features) {
    ctx.beginPath();
    path(feature.geometry);
    ctx.fillStyle = globe.colors[feature.properties.name] ?? LAND;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const rim = ctx.createRadialGradient(GLOBE.cx, GLOBE.cy, GLOBE.r * 0.9, GLOBE.cx, GLOBE.cy, GLOBE.r * 1.08);
  rim.addColorStop(0, "rgba(94,234,212,0)");
  rim.addColorStop(0.55, "rgba(94,234,212,0.35)");
  rim.addColorStop(1, "rgba(94,234,212,0)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(GLOBE.cx, GLOBE.cy, GLOBE.r * 1.08, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws the card and hands back a PNG. */
export async function drawCard(spec: CardSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the card.");

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // A soft glow behind the middle, echoing the menu.
  const glow = ctx.createRadialGradient(
    CARD_WIDTH / 2, GLOBE.cy, 0,
    CARD_WIDTH / 2, GLOBE.cy, CARD_WIDTH * 0.8
  );
  glow.addColorStop(0, "rgba(56,189,248,0.12)");
  glow.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const font = (size: number, weight = "400") =>
    `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  /**
   * Sets the largest font up to `size` at which `text` fits the card with a
   * margin: "North Korea → Switzerland" at the title's full size ran off
   * both edges.
   */
  const fit = (text: string, size: number, weight: string) => {
    let at = size;
    ctx.font = font(at, weight);
    while (at > 28 && ctx.measureText(text).width > CARD_WIDTH - 140) {
      at -= 4;
      ctx.font = font(at, weight);
    }
  };

  ctx.textAlign = "center";

  ctx.fillStyle = INK;
  ctx.font = font(44, "700");
  ctx.fillText("WorldGuess", CARD_WIDTH / 2, 150);

  ctx.fillStyle = MUTED;
  fit(spec.eyebrow.toUpperCase(), 34, "500");
  ctx.fillText(spec.eyebrow.toUpperCase(), CARD_WIDTH / 2, 250);

  ctx.fillStyle = INK;
  fit(spec.title, 104, "700");
  ctx.fillText(spec.title, CARD_WIDTH / 2, 370);

  ctx.fillStyle = ACCENT;
  fit(spec.subtitle, 46, "500");
  ctx.fillText(spec.subtitle, CARD_WIDTH / 2, 450);

  if (spec.globe) drawGlobe(ctx, spec.globe);

  // Tiles, centred in their band so a short row and a tall block both sit right.
  const band = tileBand(Boolean(spec.globe));
  const { perRow, size, gap, height } = tileLayout(spec.tiles.length, CARD_WIDTH - 180, band.height);
  const top = band.top + Math.max(0, (band.height - height) / 2);
  spec.tiles.forEach((colour, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inThisRow = Math.min(perRow, spec.tiles.length - row * perRow);
    const rowWidth = inThisRow * size + (inThisRow - 1) * gap;
    const x = (CARD_WIDTH - rowWidth) / 2 + col * (size + gap);
    const y = top + row * (size + gap);
    ctx.fillStyle = colour;
    roundedRect(ctx, x, y, size, size, Math.max(6, size * 0.18));
  });

  if (spec.note) {
    ctx.fillStyle = MUTED;
    ctx.font = font(38);
    // Under the band rather than under the block, so the note never rides
    // down onto the foot when there are a lot of tiles.
    ctx.fillText(spec.note, CARD_WIDTH / 2, band.top + band.height + 80);
  }

  ctx.fillStyle = INK;
  ctx.font = font(52, "600");
  ctx.fillText("Can you beat it?", CARD_WIDTH / 2, CARD_HEIGHT - 200);
  if (spec.site) {
    ctx.fillStyle = ACCENT;
    ctx.font = font(38, "500");
    ctx.fillText(spec.site, CARD_WIDTH / 2, CARD_HEIGHT - 135);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image."))),
      "image/png"
    );
  });
}

export type ShareOutcome = "shared" | "downloaded" | "failed";

/**
 * Hands the card to whatever the device uses to share.
 *
 * On a phone this is the share sheet, with Instagram in it — which is as close
 * to "post to Instagram" as a web page is allowed to get, and is what native
 * apps do too. On a desktop there is no share sheet, so the card downloads and
 * the player posts it themselves.
 */
export async function shareCard(
  blob: Blob,
  { text, filename }: { text: string; filename: string }
): Promise<ShareOutcome> {
  // The blob's own type, so the same hand-off shares a video too.
  const file = new File([blob], filename, { type: blob.type || "image/png" });

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (error) {
      // A player who backs out of the share sheet hasn't hit a problem.
      if ((error as Error)?.name === "AbortError") return "shared";
      // Anything else, fall through and give them the file instead.
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch {
    return "failed";
  }
}
