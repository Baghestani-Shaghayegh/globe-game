import { useEffect, useState } from "react";

/**
 * The window's size, kept current.
 *
 * react-globe.gl sizes its canvas from the window once, when it mounts, and
 * never looks again. Open the game in half a screen and then maximise it and
 * the canvas stays the old size, pinned to the top-left of a window that has
 * grown around it — so the globe sits off to one side with dead space beside
 * it. Handing it an explicit width and height from here is what makes it
 * follow the window.
 *
 * Measured on a frame rather than on every event: dragging a window edge fires
 * resize continuously, and rebuilding a three.js renderer that often is how a
 * smooth drag turns into a slideshow.
 */
export function useViewport(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSize((old) =>
          old.width === window.innerWidth && old.height === window.innerHeight
            ? old
            : { width: window.innerWidth, height: window.innerHeight }
        );
      });
    };
    window.addEventListener("resize", measure);
    // Rotating a phone, and leaving full screen, both land here too.
    window.addEventListener("orientationchange", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  return size;
}
