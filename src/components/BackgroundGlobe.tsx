import { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { theme } from "../lib/globeTheme";

type Feature = { properties: { name: string } };

const globeMaterial = new THREE.MeshPhongMaterial({
  color: theme.sphere,
  shininess: 0,
});

/**
 * Decorative globe behind the menu. Slowly self-rotates and ignores the
 * pointer entirely — the cards on top stay clickable.
 */
export default function BackgroundGlobe() {
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
    // or the sphere bleeds off every edge and stops reading as a globe.
    globe.pointOfView(
      { lat: 12, lng: 20, altitude: size.width < 640 ? 2.6 : 1.9 },
      0
    );

    const stillPreferred = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    controls.autoRotate = !stillPreferred;
    controls.autoRotateSpeed = 0.32;
    controls.enableZoom = false;
  }, [features, size.width]);

  return (
    <Globe
      ref={globeRef}
      width={size.width}
      height={size.height}
      rendererConfig={{
          antialias: true,
          alpha: true,
          logarithmicDepthBuffer: true,
        }}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={globeMaterial}
      atmosphereColor={theme.atmosphere}
      atmosphereAltitude={0.18}
      polygonsData={features}
      polygonCapColor={() => theme.idle}
      polygonSideColor={() => theme.sphere}
      polygonStrokeColor={() => theme.stroke}
      polygonAltitude={() => 0.012}
      polygonsTransitionDuration={0}
    />
  );
}
