import { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { backdropLand, globeMaterial, theme } from "../lib/globeTheme";
import { useGlobeTheme } from "../features/globe-guess/useGlobeTheme";

type Feature = { properties: { name: string } };

/**
 * Decorative globe behind the menu. Slowly self-rotates and ignores the
 * pointer entirely — everything on top stays clickable.
 *
 * Drawn wider than the window and pushed off to the right, so it sits beside
 * the column of words rather than under it: the menu reads against the dark
 * left edge while the globe fills the space that would otherwise be empty.
 */
export default function BackgroundGlobe() {
  // Repaint when the player changes the globe palette.
  useGlobeTheme();

  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { features: Feature[] }) => {
        if (!cancelled) setFeatures(data.features);
      })
      .catch(() => {
        /* the menu reads fine without it */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    const controls = globe?.controls();
    if (!globe || !controls) return;

    // Lower altitude pulls the camera in. On narrow screens stay further out,
    // or the sphere bleeds off every edge and stops reading as a globe. The
    // Atlantic is the opening view: it puts the Americas and Africa either
    // side of the words rather than a blank ocean behind them.
    globe.pointOfView(
      { lat: 18, lng: -32, altitude: size.width < 640 ? 2.6 : 1.75 },
      0
    );

    const stillPreferred = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    controls.autoRotate = !stillPreferred;
    controls.autoRotateSpeed = 0.32;
    controls.enableZoom = false;
  }, [features, size.width]);

  // Offset rather than centred. On a phone there is no room to put it beside
  // anything, so it stays where it was.
  const wide = size.width >= 768;

  return (
    <div
      className="absolute inset-y-0"
      style={
        wide
          ? { left: "28%", right: "-14%" }
          : { left: 0, right: 0 }
      }
    >
      <Globe
        ref={globeRef}
        width={wide ? size.width * 0.86 : size.width}
        height={size.height}
        rendererConfig={{
          antialias: true,
          alpha: true,
          logarithmicDepthBuffer: true,
        }}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        atmosphereColor={theme.atmosphere}
        atmosphereAltitude={0.22}
        polygonsData={features}
        polygonCapColor={() => backdropLand()}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => theme.stroke}
        polygonAltitude={() => 0.012}
        polygonsTransitionDuration={0}
      />
    </div>
  );
}
