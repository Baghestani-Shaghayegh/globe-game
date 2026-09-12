import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { globeMaterial, iceShade, landShade, theme } from "../lib/globeTheme";
import {
  forgetLandMaterials,
  landMaterial,
  repeatForSpan,
  sunlitLights,
} from "../lib/globeTerrain";
import { featureCentre, type Geometry } from "../lib/geo";
import { useGlobeTheme } from "../features/globe-guess/useGlobeTheme";

type Feature = { properties: { name: string }; geometry: Geometry };

/**
 * The parts of the map that are ice rather than country. Pale here and only
 * here: in a round the odd one out would be a free answer.
 */
const ICE = new Set([
  "Greenland",
  "Antarctica",
  "Iceland",
  "French Southern and Antarctic Lands",
]);

/**
 * A camera this far out with a narrow lens is most of what makes the globe
 * read as a sphere seen straight on rather than a fisheye. At the default
 * fifty degrees the continents nearest the middle bulge towards the viewer.
 */
const FIELD_OF_VIEW = 30;
const ALTITUDE_WIDE = 3.1;
const ALTITUDE_NARROW = 4.55;

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
  const themeId = useGlobeTheme();

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

    // Set the rotation going before anything else in here. It used to be the
    // last thing the effect did, which meant every line above it — reaching
    // into the scene, swapping the lights — was standing between the globe and
    // the one property that makes it turn.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const spin = () => {
      controls.autoRotate = !still.matches;
    };
    spin();
    // And keep watching: someone who turns the setting off wants the motion
    // back without having to reload the page.
    still.addEventListener("change", spin);
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = false;

    // A long lens rather than a wide one, backed off far enough to keep the
    // globe the same size on screen. Straight-on, with the bulge taken out of
    // the middle of the sphere.
    const camera = globe.camera() as THREE.PerspectiveCamera;
    if (camera.isPerspectiveCamera && camera.fov !== FIELD_OF_VIEW) {
      camera.fov = FIELD_OF_VIEW;
      camera.updateProjectionMatrix();
    }

    // On narrow screens stay further out, or the sphere bleeds off every edge
    // and stops reading as a globe. The Atlantic is the opening view: it puts
    // the Americas and Africa either side of the words rather than a blank
    // ocean behind them, and Greenland at the top.
    globe.pointOfView(
      {
        lat: 18,
        lng: -32,
        altitude: size.width < 640 ? ALTITUDE_NARROW : ALTITUDE_WIDE,
      },
      0
    );

    const { lights, aim } = sunlitLights();
    globe.lights(lights);

    // Once for where the camera is now, and again whenever it moves. The globe
    // turns under a fixed camera, and the controls announce every step of it,
    // so the sun stays up and to the left of the viewer instead of sliding
    // round to the back as the world rotates.
    aim(camera);
    const follow = () => aim(camera);
    controls.addEventListener("change", follow);

    // three-globe hard-codes the graticules to light grey. There is no
    // accessor for them, so reach in and find the one object that matches what
    // it builds — the country outlines are separate objects with their own
    // colour, and are left alone.
    globe.scene().traverse((object) => {
      const line = object as THREE.LineSegments;
      if (!line.isLineSegments) return;
      const material = line.material as THREE.LineBasicMaterial;
      if (!material?.color || material.opacity > 0.2) return;
      if (material.color.getHexString() !== "d3d3d3") return;
      material.color.set("#5f93c4");
      material.opacity = 0.16;
    });

    return () => {
      controls.removeEventListener("change", follow);
      still.removeEventListener("change", spin);
    };
  }, [features, size.width]);

  // How finely to tile the ground texture, per country, worked out once when
  // the map arrives rather than on every repaint.
  const grain = useMemo(() => {
    const byName = new Map<string, number>();
    for (const feature of features) {
      byName.set(
        feature.properties.name,
        repeatForSpan(featureCentre(feature.geometry).span)
      );
    }
    return byName;
  }, [features]);

  const capMaterial = useMemo(() => {
    forgetLandMaterials();
    return (d: object) => {
      const { name } = (d as Feature).properties;
      const colour = ICE.has(name) ? iceShade() : landShade(name, theme.idle);
      return landMaterial(colour, grain.get(name) ?? 1);
    };
    // themeId is not read here — the colours come from the live `theme` — but
    // a palette change makes every cached material the wrong colour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grain, themeId]);

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
        // Narrow. The wide version read as fog around the globe rather than
        // as a rim; the soft blue spread outside it is a CSS halo on the page,
        // which can be a different colour from the rim itself.
        atmosphereAltitude={0.14}
        // The meridians and parallels in the design. They cost nothing, and a
        // sphere with a grid on it reads as a globe rather than a circle.
        showGraticules
        polygonsData={features}
        // A lit material rather than a flat colour. This is what puts the sun
        // on the upper left and lets the lower hemisphere fall into shadow;
        // the shade and the texture only vary the ground underneath it.
        polygonCapMaterial={capMaterial}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => theme.stroke}
        polygonAltitude={() => 0.012}
        polygonsTransitionDuration={0}
      />
    </div>
  );
}
