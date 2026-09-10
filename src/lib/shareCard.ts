/**
 * Turns a result into an image worth posting.
 *
 * Drawn on a canvas rather than screenshotted: the card wants to be the same
 * shape whatever device made it, and Instagram wants a portrait it doesn't
 * have to crop. Tiles are drawn as coloured rectangles rather than emoji —
 * emoji render differently on every platform, and half the point is that the
 * card looks like the game.
 */

/** Instagram's preferred portrait. Fits a feed post and sits fine in a story. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export type CardSpec = {
  /** Small line above the title. */
  eyebrow: string;
  title: string;
  /** The line under the title — score, count, whatever the mode counts. */
  subtitle: string;
  /** One colour per square, in the order they were earned. */
  tiles: string[];
  /** Optional line under the tiles. */
  note?: string;
};

const BACKGROUND = "#07111c";
const INK = "#fafafa";
const MUTED = "#71717a";
const ACCENT = "#38bdf8";

/** The band the tiles are allowed to occupy, between the subtitle and the note. */
export const TILE_BAND_TOP = 560;
export const TILE_BAND_HEIGHT = 430;

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
    CARD_WIDTH / 2, CARD_HEIGHT * 0.42, 0,
    CARD_WIDTH / 2, CARD_HEIGHT * 0.42, CARD_WIDTH * 0.75
  );
  glow.addColorStop(0, "rgba(56,189,248,0.10)");
  glow.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const font = (size: number, weight = "400") =>
    `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.textAlign = "center";

  ctx.fillStyle = MUTED;
  ctx.font = font(34, "500");
  ctx.fillText(spec.eyebrow.toUpperCase(), CARD_WIDTH / 2, 300);

  ctx.fillStyle = INK;
  ctx.font = font(84, "600");
  ctx.fillText(spec.title, CARD_WIDTH / 2, 400);

  ctx.fillStyle = ACCENT;
  ctx.font = font(44, "500");
  ctx.fillText(spec.subtitle, CARD_WIDTH / 2, 478);

  // Tiles, centred in their band so a short row and a tall block both sit right.
  const { perRow, size, gap, height } = tileLayout(spec.tiles.length, CARD_WIDTH - 180);
  const top = TILE_BAND_TOP + Math.max(0, (TILE_BAND_HEIGHT - height) / 2);
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
    ctx.font = font(36);
    // Under the band rather than under the block, so the note never rides
    // down onto the wordmark when there are a lot of tiles.
    ctx.fillText(spec.note, CARD_WIDTH / 2, TILE_BAND_TOP + TILE_BAND_HEIGHT + 76);
  }

  ctx.fillStyle = INK;
  ctx.font = font(46, "600");
  ctx.fillText("WorldGuess", CARD_WIDTH / 2, CARD_HEIGHT - 140);
  ctx.fillStyle = MUTED;
  ctx.font = font(32);
  ctx.fillText("play it yourself", CARD_WIDTH / 2, CARD_HEIGHT - 92);

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
  const file = new File([blob], filename, { type: "image/png" });

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
