import { useEffect, useRef } from "react";

/**
 * The burst of colour when something is finished.
 *
 * Its own canvas over the page rather than a library: this is a few dozen
 * rectangles under gravity, and a confetti dependency would cost more bytes
 * than the whole effect. It draws nothing at all when the player has asked
 * for reduced motion — that request is usually about vestibular comfort, and a
 * screenful of tumbling paper is exactly what it means.
 *
 * Nothing about the page underneath moves, so it can be dropped on top of any
 * screen without touching that screen's layout.
 */

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  angle: number;
  color: string;
};

/** Bright enough to read on the game's near-black background. */
const COLORS = [
  "#5bb98c",
  "#38bdf8",
  "#f2a93b",
  "#a78bfa",
  "#f472b6",
  "#facc15",
];

const GRAVITY = 0.28;
const DRAG = 0.995;

export default function Celebrate({
  /** Bumping this fires another burst — the same value never fires twice. */
  burst,
  /** Roughly how much paper. A personal best deserves more than a round won. */
  count = 70,
}: {
  burst: number;
  count?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    if (!burst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const scale = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);

    // Thrown up and outwards from just below the middle, so the arc peaks
    // across the screen rather than raining straight down the centre.
    const pieces: Piece[] = Array.from({ length: count }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = 7 + Math.random() * 9;
      return {
        x: width / 2 + (Math.random() - 0.5) * width * 0.35,
        y: height * 0.55,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });

    let alive = true;
    const draw = () => {
      if (!alive) return;
      context.clearRect(0, 0, width, height);
      let onScreen = 0;

      for (const piece of pieces) {
        piece.vy += GRAVITY;
        piece.vx *= DRAG;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        if (piece.y - piece.size > height) continue;
        onScreen++;

        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.fillStyle = piece.color;
        // Squashed across its spin, so each piece reads as paper turning over.
        context.fillRect(
          -piece.size / 2,
          -piece.size / 4,
          piece.size,
          piece.size / 2
        );
        context.restore();
      }

      // Stop as soon as the last piece has fallen out of view: leaving the
      // loop running would keep a canvas repainting behind a summary screen
      // for as long as the player sat on it.
      if (onScreen === 0) {
        context.clearRect(0, 0, width, height);
        return;
      }
      frame.current = requestAnimationFrame(draw);
    };
    frame.current = requestAnimationFrame(draw);

    return () => {
      alive = false;
      cancelAnimationFrame(frame.current);
    };
  }, [burst, count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}
