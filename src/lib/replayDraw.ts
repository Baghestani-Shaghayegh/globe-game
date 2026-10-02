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
import { areaOf } from "../data/areas";
import { bigger, formatArea } from "./higherLower";
import { heatColor } from "./mystery";
import { CLUE_COUNT, dailyClues } from "./fiveClues";
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
/** Connect's two ends, as on its share card. */
const ENDS = "#a78bfa";
const GRADE: Record<string, string> = { best: FOUND, near: LIT, far: MISSED };

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

  const kind = replay.game.type;
  const { answer, from, to } = replay.game;

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

  if (kind !== "bigger") {
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
      if (kind === "mystery") {
        // The answer once it's found or handed over; every guess its heat.
        if (name === answer && frame.found.has(name)) return FOUND;
        if (name === answer && frame.revealed === name) return heatColor(0);
        const km = frame.heat.get(name);
        return km === undefined ? LAND : heatColor(km);
      }
      if (kind === "clues") {
        if (name === answer && frame.found.has(name)) return FOUND;
        if (name === answer && (frame.over || frame.revealed === name)) return LIT;
        if (frame.missed.includes(name)) return MISSED;
        return LAND;
      }
      if (kind === "connect") {
        if (name === from || name === to) return ENDS;
        const grade = frame.placed.get(name);
        return grade ? (GRADE[grade] ?? LAND) : LAND;
      }
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
    if (kind === "mystery") {
      // The newest guess is named where it is, as the game turns to it.
      if (frame.revealed) pill(frame.revealed, heatColor(0));
      else if (frame.right) pill(frame.right, FOUND);
      else if (frame.lastGuess) pill(frame.lastGuess.name, heatColor(frame.lastGuess.km));
    } else if (kind === "connect") {
      if (from) pill(from, ENDS);
      if (to) pill(to, ENDS);
      const newest = [...frame.placed].pop();
      if (newest) pill(newest[0], GRADE[newest[1]] ?? LAND);
    } else {
      if (frame.wrong) pill(frame.wrong, MISSED);
      if (frame.right) pill(frame.right, FOUND);
      if (frame.revealed) pill(frame.revealed, LIT);
    }
  }

  // ---- Which is bigger?: the pair, side by side ---------------------------
  if (kind === "bigger" && frame.pair) {
    const pair = frame.pair;
    const gap = 90 * u;
    const cardW = (W - 2 * 60 * u - gap) / 2;
    const cardH = 1000 * u;
    const top = H * 0.3;
    const winner = pair.picked ? bigger(pair.left, pair.right) : null;
    [pair.left, pair.right].forEach((name, i) => {
      const x = 60 * u + i * (cardW + gap);
      const chosen = pair.picked === name;
      const tone = chosen ? (pair.correct ? FOUND : MISSED) : null;
      ctx.fillStyle = tone ? (pair.correct ? "rgba(52,211,153,0.10)" : "rgba(251,113,133,0.10)") : "rgba(255,255,255,0.04)";
      roundRect(ctx, x, top, cardW, cardH, 36 * u);
      ctx.fill();
      ctx.strokeStyle = tone ?? "rgba(255,255,255,0.12)";
      ctx.lineWidth = 3 * u;
      ctx.stroke();
      const f = assets.byName.get(name);
      if (f) {
        const shape = geoMercator().fitExtent(
          [
            [x + 40 * u, top + 80 * u],
            [x + cardW - 40 * u, top + cardH * 0.6],
          ],
          f.geometry
        );
        ctx.beginPath();
        geoPath(shape, ctx)(f.geometry);
        ctx.fillStyle = tone ?? (pair.picked ? "#52525b" : ACCENT);
        ctx.fill();
      }
      ctx.textAlign = "center";
      ctx.fillStyle = INK;
      let size = 44;
      ctx.font = font(size, "700");
      while (size > 24 && ctx.measureText(display(name)).width > cardW - 40 * u) {
        size -= 2;
        ctx.font = font(size, "700");
      }
      ctx.fillText(display(name), x + cardW / 2, top + cardH * 0.73);
      if (pair.picked) {
        ctx.fillStyle = "#d4d4d8";
        ctx.font = font(32, "500");
        ctx.fillText(formatArea(areaOf(name) ?? 0), x + cardW / 2, top + cardH * 0.82);
        if (name === winner) {
          ctx.fillStyle = FOUND;
          ctx.font = font(28, "700");
          ctx.fillText("BIGGER", x + cardW / 2, top + cardH * 0.91);
        }
      }
    });
    ctx.fillStyle = MUTED;
    ctx.font = font(30, "600");
    ctx.fillText("OR", cx, top + cardH / 2);
    ctx.fillStyle = INK;
    ctx.font = font(64, "700");
    ctx.fillText("Which is bigger?", cx, top - 60 * u);
  }

  // ---- The top: who, what, and the clock -----------------------------------
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.32);
  top.addColorStop(0, "rgba(7,17,28,0.96)");
  top.addColorStop(0.75, "rgba(7,17,28,0.8)");
  top.addColorStop(1, "rgba(7,17,28,0)");
  ctx.fillStyle = top;
  // Over the globe only: the bigger cards have nothing under them to fade.
  if (kind !== "bigger") ctx.fillRect(0, 0, W, H * 0.32);

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
  if (kind === "mystery") {
    const closest = Math.min(...frame.heat.values());
    stat(W * 0.2, clock(shownT), "TIME");
    stat(W * 0.5, String(frame.heat.size), "GUESSES");
    stat(W * 0.8, frame.heat.size ? `${closest.toLocaleString()} km` : "–", "CLOSEST");
  } else if (kind === "connect") {
    stat(W * 0.2, clock(shownT), "TIME");
    stat(W * 0.5, String(frame.placed.size), "PLACED");
    stat(W * 0.8, String(replay.game.par ?? "–"), "PAR");
  } else if (kind === "clues") {
    stat(W * 0.2, clock(shownT), "TIME");
    stat(W * 0.5, `${Math.min(CLUE_COUNT, frame.hints.length + 1)}/${CLUE_COUNT}`, "CLUE");
    stat(W * 0.8, String(frame.missed.length), "MISSES");
  } else if (kind === "bigger") {
    stat(W * 0.3, clock(shownT), "TIME");
    stat(W * 0.7, String(frame.streak), "IN A ROW");
  } else {
    stat(W * 0.2, clock(shownT), "TIME");
    stat(W * 0.5, `${frame.found.size}/${replay.result.total}`, "FOUND");
    stat(W * 0.8, frame.points.toLocaleString(), "POINTS");
  }

  // ---- The question --------------------------------------------------------
  const asking =
    kind === "mystery" || kind === "connect" || kind === "clues"
      ? !frame.over
      : frame.target && !frame.over;
  if (asking) {
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

    const t = frame.target ?? "";
    const ask = (kicker: string, text: string, size = 64, tone = INK) => {
      ctx.fillStyle = MUTED;
      ctx.font = font(26, "600");
      ctx.fillText(kicker, cx, by + 58 * u);
      ctx.fillStyle = tone;
      let at = size;
      ctx.font = font(at, "700");
      while (at > 26 && ctx.measureText(text).width > boxW - 60 * u) {
        at -= 3;
        ctx.font = font(at, "700");
      }
      ctx.fillText(text, cx, by + 138 * u);
    };
    switch (replay.game.type) {
      case "mystery": {
        const g = frame.lastGuess;
        if (answer && frame.revealed === answer) ask("IT WAS", display(answer), 64, heatColor(0));
        else if (!g) ask("FIND THE MYSTERY COUNTRY", "Warmer means closer", 48);
        else if (g.km === 0 && g.name === answer) ask("FOUND IT", display(g.name), 64, FOUND);
        else
          ask(
            display(g.name).toUpperCase(),
            g.km === 0 ? "Touching" : `${g.km.toLocaleString()} km away`,
            64,
            heatColor(g.km)
          );
        break;
      }
      case "clues": {
        const n = Math.min(CLUE_COUNT, frame.hints.length + 1);
        const clue = dailyClues(answer ?? "")[n - 1] ?? "";
        ctx.fillStyle = MUTED;
        ctx.font = font(26, "600");
        ctx.fillText(`CLUE ${n} OF ${CLUE_COUNT}`, cx, by + 50 * u);
        // A clue is a sentence: wrapped onto up to three lines, smaller if
        // it needs more.
        const room = boxW - 60 * u;
        let size = 44;
        let lines: string[] = [];
        for (; size >= 26; size -= 2) {
          ctx.font = font(size, "700");
          lines = [];
          let line = "";
          for (const word of clue.split(" ")) {
            const next = line ? `${line} ${word}` : word;
            if (ctx.measureText(next).width > room && line) {
              lines.push(line);
              line = word;
            } else line = next;
          }
          if (line) lines.push(line);
          if (lines.length <= (size > 36 ? 2 : 3)) break;
        }
        ctx.fillStyle = frame.found.size ? FOUND : INK;
        // Centred in the box under the label.
        const lh = size * 1.2 * u;
        const top0 = by + 124 * u - ((lines.length - 1) * lh) / 2 + size * 0.35 * u;
        lines.forEach((l, i) => ctx.fillText(l, cx, top0 + i * lh));
        break;
      }
      case "connect":
        ask("WALK FROM", `${display(from ?? "")} → ${display(to ?? "")}`, 56);
        break;
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
    const res = replay.result;
    const guesses = replay.ev.filter((e) => e[1] === "g").length;
    const [big, line] =
      kind === "mystery"
        ? [
            res.found ? "Found it" : "Gave up",
            `${display(answer ?? "")} · ${guesses} ${guesses === 1 ? "guess" : "guesses"} · ${clock(res.ms)}`,
          ]
        : kind === "connect"
          ? [
              `${res.found} ${res.found === 1 ? "step" : "steps"}`,
              `par ${replay.game.par ?? "–"} · ${clock(res.ms)} · ${res.points.toLocaleString()} points`,
            ]
          : kind === "clues"
            ? [
                res.found ? `Clue ${CLUE_COUNT + 1 - res.points / 200} of ${CLUE_COUNT}` : "Not found",
                `${display(answer ?? "")} · ${clock(res.ms)} · ${res.points.toLocaleString()} points`,
              ]
          : kind === "bigger"
            ? [`${res.points} in a row`, `${clock(res.ms)} · countries by land area`]
            : [
                `${res.found} / ${res.total}`,
                `${clock(res.ms)} · ${res.points.toLocaleString()} points`,
              ];
    ctx.fillStyle = INK;
    let bigSize = 150;
    ctx.font = font(bigSize, "800");
    while (bigSize > 60 && ctx.measureText(big).width > W - 120 * u) {
      bigSize -= 6;
      ctx.font = font(bigSize, "800");
    }
    ctx.fillText(big, cx, H * 0.47);
    ctx.fillStyle = ACCENT;
    let lineSize = 52;
    ctx.font = font(lineSize, "600");
    while (lineSize > 28 && ctx.measureText(line).width > W - 100 * u) {
      lineSize -= 2;
      ctx.font = font(lineSize, "600");
    }
    ctx.fillText(line, cx, H * 0.53);
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
