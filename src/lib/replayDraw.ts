import {
  geoGraticule10,
  geoMercator,
  geoOrthographic,
  geoPath,
  type GeoGeometryObjects,
} from "d3-geo";
import { getCountryMeta } from "../data/countries";
import { capitalOf } from "../data/capitals";
import { cluesFor } from "../data/clues";
import { flagUrl } from "../data/flags";
import { labelPoint, type Geometry } from "./geo";
import type { Replay } from "./replay";
import { clock, type Frame } from "./replayFrame";

/**
 * Paints one moment of a recording onto a canvas: the globe as the player
 * saw it, the question they were on, the clock and the score.
 *
 * The same painter serves the player on the site and the video for a
 * story, so what you watch is what you post. Drawn in 2D from the map
 * rather than by running the game again: it's quick enough to make a video
 * faster than real time, and it looks the same on every device.
 */

export type WorldFeature = { properties: { name: string }; geometry: GeoGeometryObjects };

export type ReplayAssets = {
  byName: Map<string, WorldFeature>;
  features: WorldFeature[];
  /** Where each country's name goes. */
  labels: Map<string, [number, number]>;
  /** Flags for the countries asked about, loaded before playing. */
  flags: Map<string, HTMLImageElement>;
};

const BG = "#07111c";
const OCEAN = "#082b43";
const LAND = "#245a5f";
const IN_PLAY = "#3f8a8e";
const FOUND = "#34d399";
const MISSED = "#fb7185";
const LIT = "#fbbf24";
const INK = "#fafafa";
const MUTED = "#9ca3af";
const ACCENT = "#5eead4";

/** Loads what drawing needs: the map, and the flags a flag round asked. */
export async function loadReplayAssets(replay: Replay): Promise<ReplayAssets> {
  const res = await fetch("/data/world.geojson");
  const data = (await res.json()) as { features: WorldFeature[] };
  const byName = new Map(data.features.map((f) => [f.properties.name, f]));
  const labels = new Map<string, [number, number]>();
  for (const f of data.features) {
    const { lat, lng } = labelPoint(f.geometry as Geometry);
    labels.set(f.properties.name, [lng, lat]);
  }
  const flags = new Map<string, HTMLImageElement>();
  if (replay.game.type === "flag") {
    const asked = new Set(replay.ev.filter((e) => e[1] === "q").map((e) => e[2] as string));
    await Promise.all(
      [...asked].map(
        (name) =>
          new Promise<void>((resolve) => {
            const url = flagUrl(name);
            if (!url) return resolve();
            const img = new Image();
            img.onload = () => {
              flags.set(name, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
          })
      )
    );
  }
  return { byName, features: data.features, labels, flags };
}

const display = (name: string) => getCountryMeta(name).displayName;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The globe's size on screen for the game's camera height: the sphere's
 * apparent radius through the game's 50° lens, so a zoom in the game is
 * the same zoom here.
 */
function globeRadius(altitude: number, width: number): number {
  const d = 1 + Math.max(0.05, altitude);
  return Math.min(width * 6, (width * 0.5) / (Math.tan((25 * Math.PI) / 180) * Math.sqrt(d * d - 1)));
}

export type DrawOptions = {
  width: number;
  height: number;
  /** Who played it, for the top line. */
  player?: string;
  /** The site's address, for the last card. */
  site?: string;
  /** A title card over the opening frame, 0–1 opacity. */
  intro?: number;
};

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  replay: Replay,
  assets: ReplayAssets,
  { width: W, height: H, player, site, intro = 0 }: DrawOptions
) {
  const u = W / 1080;
  const font = (size: number, weight = "400") =>
    `${weight} ${Math.round(size * u)}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ---- The globe -----------------------------------------------------------
  const cx = W / 2;
  const cy = H * 0.56;
  const r = globeRadius(frame.camera.altitude, W);
  const projection = geoOrthographic()
    .scale(r)
    .translate([cx, cy])
    .rotate([-frame.camera.lng, -frame.camera.lat])
    .clipAngle(90);
  const path = geoPath(projection, ctx);

  const glow = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.08);
  glow.addColorStop(0, "rgba(94,234,212,0)");
  glow.addColorStop(0.5, "rgba(94,234,212,0.28)");
  glow.addColorStop(1, "rgba(94,234,212,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = OCEAN;
  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fill();

  ctx.strokeStyle = "rgba(94,234,212,0.09)";
  ctx.lineWidth = Math.max(1, 1.2 * u);
  ctx.beginPath();
  path(geoGraticule10());
  ctx.stroke();

  const inPlay = replay.game.inPlay ? new Set(replay.game.inPlay) : null;
  const naming = replay.game.type === "name";
  const colour = (name: string): string => {
    if (name === frame.wrong) return MISSED;
    if (name === frame.revealed) return LIT;
    if (frame.found.has(name)) return FOUND;
    if (naming && name === frame.target) return LIT;
    if (inPlay) return inPlay.has(name) ? IN_PLAY : LAND;
    return IN_PLAY;
  };
  ctx.lineWidth = Math.max(0.6, 0.9 * u);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  for (const f of assets.features) {
    ctx.beginPath();
    path(f.geometry);
    ctx.fillStyle = colour(f.properties.name);
    ctx.fill();
    ctx.stroke();
  }

  // Ripples where the player clicked, and the name on what they hit.
  for (const ripple of frame.ripples) {
    const at = assets.labels.get(ripple.name);
    const xy = at && projection(at);
    if (!xy) continue;
    ctx.strokeStyle = ripple.ok ? FOUND : MISSED;
    ctx.globalAlpha = 1 - ripple.progress;
    ctx.lineWidth = 5 * u;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], (14 + 70 * ripple.progress) * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const pill = (name: string, tone: string) => {
    const at = assets.labels.get(name);
    const xy = at && projection(at);
    if (!xy) return;
    const text = display(name);
    ctx.font = font(30, "600");
    const w = ctx.measureText(text).width + 32 * u;
    const h = 48 * u;
    const x = xy[0] - w / 2;
    const y = xy[1] - h - 22 * u;
    ctx.fillStyle = "rgba(10,16,24,0.88)";
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = tone;
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, xy[0], y + h / 2);
    ctx.textBaseline = "alphabetic";
  };
  if (frame.wrong) pill(frame.wrong, MISSED);
  if (frame.right) pill(frame.right, FOUND);
  if (frame.revealed) pill(frame.revealed, LIT);

  // ---- The top: who, what, and the clock -----------------------------------
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.32);
  top.addColorStop(0, "rgba(7,17,28,0.96)");
  top.addColorStop(0.75, "rgba(7,17,28,0.8)");
  top.addColorStop(1, "rgba(7,17,28,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.32);

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = font(40, "700");
  ctx.fillText("WorldGuess", cx, 96 * u);
  ctx.fillStyle = MUTED;
  ctx.font = font(30, "500");
  ctx.fillText(
    [replay.game.label, player].filter(Boolean).join(" · ").toUpperCase(),
    cx,
    146 * u
  );

  const stat = (x: number, value: string, label: string) => {
    ctx.fillStyle = INK;
    ctx.font = font(56, "700");
    ctx.fillText(value, x, 236 * u);
    ctx.fillStyle = MUTED;
    ctx.font = font(24, "500");
    ctx.fillText(label, x, 272 * u);
  };
  const shownT = Math.min(frame.t, replay.result.ms);
  stat(W * 0.2, clock(shownT), "TIME");
  stat(W * 0.5, `${frame.found.size}/${replay.result.total}`, "FOUND");
  stat(W * 0.8, frame.points.toLocaleString(), "POINTS");

  // ---- The question --------------------------------------------------------
  if (frame.target && !frame.over) {
    const boxW = 760 * u;
    const boxH = 190 * u;
    const bx = cx - boxW / 2;
    const by = 310 * u;
    ctx.fillStyle = "rgba(20,27,35,0.92)";
    roundRect(ctx, bx, by, boxW, boxH, 28 * u);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2 * u;
    ctx.stroke();

    const t = frame.target;
    const ask = (kicker: string, text: string, size = 64) => {
      ctx.fillStyle = MUTED;
      ctx.font = font(26, "600");
      ctx.fillText(kicker, cx, by + 58 * u);
      ctx.fillStyle = INK;
      let at = size;
      ctx.font = font(at, "700");
      while (at > 26 && ctx.measureText(text).width > boxW - 60 * u) {
        at -= 3;
        ctx.font = font(at, "700");
      }
      ctx.fillText(text, cx, by + 138 * u);
    };
    switch (replay.game.type) {
      case "find":
        ask("WHERE'S", `${display(t)}?`);
        break;
      case "capital":
        ask("WHOSE CAPITAL?", capitalOf(t) ?? display(t));
        break;
      case "famous":
        ask("FAMOUS FOR", cluesFor(t)[Math.min(frame.hints.length, cluesFor(t).length - 1)] ?? display(t), 44);
        break;
      case "name":
        ask("WHICH COUNTRY IS THIS?", frame.found.has(t) ? display(t) : "?");
        break;
      case "flag": {
        ctx.fillStyle = MUTED;
        ctx.font = font(26, "600");
        ctx.fillText("WHOSE FLAG?", cx, by + 52 * u);
        const img = assets.flags.get(t);
        if (img) {
          const fh = 104 * u;
          const fw = Math.min(boxW - 80 * u, fh * (img.naturalWidth / Math.max(1, img.naturalHeight) || 1.5));
          ctx.drawImage(img, cx - fw / 2, by + 70 * u, fw, fh);
        }
        break;
      }
      case "outline": {
        ctx.fillStyle = MUTED;
        ctx.font = font(26, "600");
        ctx.fillText("WHOSE SHAPE?", cx, by + 52 * u);
        const f = assets.byName.get(t);
        if (f) {
          const shape = geoMercator().fitExtent(
            [
              [cx - 150 * u, by + 68 * u],
              [cx + 150 * u, by + boxH - 18 * u],
            ],
            f.geometry
          );
          const draw = geoPath(shape, ctx);
          ctx.beginPath();
          draw(f.geometry);
          ctx.fillStyle = FOUND;
          ctx.fill();
        }
        break;
      }
    }
  }

  // ---- How far through -----------------------------------------------------
  const progress = Math.min(1, frame.t / Math.max(1, replay.result.ms));
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, 80 * u, H - 70 * u, W - 160 * u, 8 * u, 4 * u);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  roundRect(ctx, 80 * u, H - 70 * u, (W - 160 * u) * progress, 8 * u, 4 * u);
  ctx.fill();

  // ---- The end -------------------------------------------------------------
  if (frame.over) {
    ctx.fillStyle = "rgba(7,17,28,0.82)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = MUTED;
    ctx.font = font(34, "500");
    ctx.fillText(replay.game.label.toUpperCase(), cx, H * 0.36);
    ctx.fillStyle = INK;
    ctx.font = font(150, "800");
    ctx.fillText(`${replay.result.found} / ${replay.result.total}`, cx, H * 0.47);
    ctx.fillStyle = ACCENT;
    ctx.font = font(52, "600");
    ctx.fillText(
      `${clock(replay.result.ms)} · ${replay.result.points.toLocaleString()} points`,
      cx,
      H * 0.53
    );
    if (player) {
      ctx.fillStyle = MUTED;
      ctx.font = font(38, "500");
      ctx.fillText(`played by ${player}`, cx, H * 0.58);
    }
    ctx.fillStyle = INK;
    ctx.font = font(60, "700");
    ctx.fillText("Can you beat it?", cx, H * 0.78);
    if (site) {
      ctx.fillStyle = ACCENT;
      ctx.font = font(40, "500");
      ctx.fillText(site, cx, H * 0.83);
    }
  }

  // ---- A title over the opening ------------------------------------------
  if (intro > 0) {
    ctx.globalAlpha = intro;
    ctx.fillStyle = "rgba(7,17,28,0.9)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK;
    ctx.font = font(84, "800");
    ctx.fillText(replay.game.label, cx, H * 0.45);
    ctx.fillStyle = ACCENT;
    ctx.font = font(44, "600");
    ctx.fillText(player ? `${player}'s run` : "The run", cx, H * 0.51);
    ctx.globalAlpha = 1;
  }
}
