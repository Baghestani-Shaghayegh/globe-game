import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { iceShade, theme } from "../lib/globeTheme";
import {
  forgetLandMaterials,
  landMaterial,
  sunlitLights,
} from "../lib/globeTerrain";
import { type Geometry } from "../lib/geo";
import { GLOBE_BOX, GLOBE_CANVAS } from "../lib/globePlacement";
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
const FIELD_OF_VIEW = 20;
const ALTITUDE_WIDE = 4.93;
const ALTITUDE_NARROW = 6.28;

/**
 * Decorative globe behind the menu. Opens on the Atlantic and ignores the
 * pointer entirely — everything on top stays clickable.
 *
 * Drawn wider than the window and pushed off to the right, so it sits beside
 * the column of words rather than under it: the menu reads against the dark
 * left edge while the globe fills the space that would otherwise be empty.
 */
export default function BackgroundGlobe() {
  // Repaint when the player changes the globe palette.
  const themeId = useGlobeTheme();
  const oceanMaterial = useMemo(() => new THREE.MeshPhongMaterial({
    color: themeId === "meridian" ? "#082b43" : theme.sphere,
    emissive: themeId === "meridian" ? "#031322" : theme.sphere,
    emissiveIntensity: 0.35,
    shininess: 0,
  }), [themeId]);

  useEffect(() => () => oceanMaterial.dispose(), [oceanMaterial]);

  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [ready, setReady] = useState(false);
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

    // The rotation goes on first, before anything else in here. It used to be
    // the last thing the effect did, which left every line above it — reaching
    // into the scene, swapping the lights — standing between the globe and the
    // one property that makes it turn.
    //
    // And it is now unconditional. It used to stand down for
    // `prefers-reduced-motion`, which meant anyone carrying that setting saw a
    // globe that never moved; asked for the turn back, the turn stays. Slow,
    // continuous, and carrying nothing the player has to track — the mildest
    // thing motion can be, but motion, and so a choice rather than an
    // oversight.
    controls.autoRotate = true;
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

    // Keep ocean illumination aligned when the viewport changes.
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
      if (!material?.color) return;
      if (!line.userData.isGraticule &&
          (material.color.getHexString() !== "d3d3d3" || material.opacity > 0.2)) return;
      line.userData.isGraticule = true;
      material.color.set("#2c7198");
      material.opacity = 0.38;
      // Lift the grid clear of the ocean so curved segments stay continuous.
      line.scale.setScalar(1.0015);
    });

    // A fine cyan edge on the sphere, with the built-in atmosphere outside it.
    const rimGeometry = new THREE.SphereGeometry(100.4, 96, 64);
    const rimMaterial = new THREE.ShaderMaterial({
      uniforms: { rimColor: { value: new THREE.Color(theme.atmosphere) } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 rimColor;
        varying vec3 vNormal;
        void main() {
          vec3 n = normalize(vNormal);
          float rim = pow(1.0 - max(n.z, 0.0), 9.0);
          gl_FragColor = vec4(rimColor, rim * 0.48);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.renderOrder = 2;
    globe.scene().add(rim);

    return () => {
      controls.removeEventListener("change", follow);
      globe.scene().remove(rim);
      rimGeometry.dispose();
      rimMaterial.dispose();
    };
  }, [features, size.width, themeId, ready]);

  const capMaterial = useMemo(() => {
    forgetLandMaterials();
    return (d: object) => {
      const { name } = (d as Feature).properties;
      const colour = ICE.has(name) ? iceShade() : theme.idle;
      return landMaterial(colour, ICE.has(name));
    };
    // themeId is not read here — the colours come from the live `theme` — but
    // a palette change makes every cached material the wrong colour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId]);

  // Offset rather than centred. On a phone there is no room to put it beside
  // anything, so it stays where it was.
  const wide = size.width >= 768;

  return (
    <div
      className="absolute"
      style={wide ? GLOBE_BOX : { inset: 0 }}
    >
      <Globe
        ref={globeRef}
        onGlobeReady={() => setReady(true)}
        width={wide ? size.width * GLOBE_CANVAS.width : size.width}
        height={wide ? size.height * GLOBE_CANVAS.height : size.height}
        rendererConfig={{
          antialias: true,
          alpha: true,
          logarithmicDepthBuffer: true,
        }}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={oceanMaterial}
        atmosphereColor={theme.atmosphere}
        // Narrow. The wide version read as fog around the globe rather than
        // as a rim; the soft blue spread outside it is a CSS halo on the page,
        // which can be a different colour from the rim itself.
        atmosphereAltitude={0.045}
        // The meridians and parallels in the design. They cost nothing, and a
        // sphere with a grid on it reads as a globe rather than a circle.
        showGraticules
        polygonsData={features}
        // A lit material rather than a flat colour. This is what puts the sun
        // on the upper left and lets the lower hemisphere fall into shadow;
        // the shade and the texture only vary the ground underneath it.
        polygonCapMaterial={capMaterial}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => new THREE.Color(theme.stroke).multiplyScalar(0.62).getStyle()}
        polygonAltitude={() => 0.003}
        polygonCapCurvatureResolution={1}
        polygonsTransitionDuration={0}
      />
    </div>
  );
}
