import { useEffect, useMemo, type MutableRefObject } from "react";
import * as THREE from "three";
import type { GlobeMethods } from "react-globe.gl";
import { theme } from "../../lib/globeTheme";
import { sunlitLights } from "../../lib/globeTerrain";
import { useGlobeTheme } from "./useGlobeTheme";

/**
 * The globe's look, in one place: the sea, the light on it, the grid and the
 * rim of cyan around the edge.
 *
 * All of this grew on the menu globe and stayed there, so a round looked like
 * a different game from the page that started it. It is a hook rather than a
 * component because each globe still owns its own camera — the menu's long
 * lens and slow turn are its own, and a round has to fly to a country and
 * frame it — but nothing about how the planet is *painted* should differ
 * between them, and when it lived in two files it did.
 */
export function useGlobeLook(
  globeRef: MutableRefObject<GlobeMethods | undefined>,
  /** Set from `onGlobeReady`: the scene does not exist before it. */
  ready: boolean
): THREE.MeshPhongMaterial {
  const themeId = useGlobeTheme();

  // Emissive rather than flat: the sea keeps a floor of its own colour where
  // no light reaches it, instead of going to black around the far limb.
  const ocean = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: themeId === "meridian" ? "#082b43" : theme.sphere,
        emissive: themeId === "meridian" ? "#031322" : theme.sphere,
        emissiveIntensity: 0.35,
        shininess: 0,
      }),
    [themeId]
  );
  useEffect(() => () => ocean.dispose(), [ocean]);

  useEffect(() => {
    const globe = globeRef.current;
    const controls = globe?.controls();
    if (!globe || !controls || !ready) return;

    const camera = globe.camera();
    const { lights, aim } = sunlitLights();
    globe.lights(lights);
    aim(camera);
    // The sun is placed relative to the camera, so it has to be re-pointed
    // every time the camera moves — which, in a round, is every fly-to.
    const follow = () => aim(camera);
    controls.addEventListener("change", follow);

    // three-globe hard-codes the graticules to light grey and gives no
    // accessor for them, so find the one object that matches what it builds.
    globe.scene().traverse((object) => {
      const line = object as THREE.LineSegments;
      if (!line.isLineSegments) return;
      const material = line.material as THREE.LineBasicMaterial;
      if (!material?.color) return;
      if (
        !line.userData.isGraticule &&
        (material.color.getHexString() !== "d3d3d3" || material.opacity > 0.2)
      ) {
        return;
      }
      line.userData.isGraticule = true;
      material.color.set("#2c7198");
      material.opacity = 0.38;
      // Lift the grid clear of the sea, or curved segments break up.
      line.scale.setScalar(1.0015);
    });

    // One cyan ring on the edge of the sphere and nothing else. The exponent
    // is what keeps it thin: the higher it is, the faster the light falls
    // away from the limb.
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
          float rim = pow(1.0 - max(n.z, 0.0), 22.0);
          gl_FragColor = vec4(rimColor, rim * 0.85);
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
  }, [globeRef, ready, themeId]);

  return ocean;
}

/**
 * The props every globe shares, so a round and the menu are painted the same
 * way. Spread these onto `<Globe>`; the camera, the data and which colour a
 * country is are still each globe's own business.
 */
export const GLOBE_SURFACE = {
  showAtmosphere: false,
  showGraticules: true,
  polygonSideColor: () => theme.sphere,
  // Unlit, so one value has to clear the brightest land anywhere on the
  // sphere. Damped, it disappeared into the sunlit side altogether.
  polygonStrokeColor: () => theme.stroke,
  polygonAltitude: () => 0.008,
  polygonCapCurvatureResolution: 1,
} as const;
