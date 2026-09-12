import * as THREE from "three";

// Sample terrain in globe coordinates so the grain continues across borders.
// View-space lighting keeps the sun above the viewer's left shoulder.
const vertexShader = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vGround;
  varying vec3 vSurfaceNormal;
  void main() {
    vGround = normalize(position);
    vSurfaceNormal = normalize(normalMatrix * normalize(position));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 baseColor;
  uniform vec3 shadowColor;
  uniform vec3 highlightColor;
  varying vec3 vGround;
  varying vec3 vSurfaceNormal;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vSurfaceNormal);
    float light = smoothstep(-0.25, 0.98, dot(n, normalize(vec3(-0.65, 0.8, 0.65))));
    vec3 color = light < 0.55
      ? mix(shadowColor, baseColor, light / 0.55)
      : mix(baseColor, highlightColor, (light - 0.55) / 0.45);
    vec3 p = normalize(vGround) * 95.0;
    float terrain = noise(p) * 0.48 + noise(p * 2.1) * 0.28
                  + noise(p * 4.3) * 0.16 + noise(p * 8.2) * 0.08;
    color *= 0.84 + terrain * 0.32;
    // A matte limb and a gentle falloff into the lower hemisphere.
    color *= mix(0.72, 1.0, smoothstep(0.0, 0.35, n.z));
    color *= mix(0.58, 1.0, smoothstep(-0.8, 0.3, n.y));
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const materials = new Map<string, THREE.ShaderMaterial>();

export function landMaterial(color: string, ice = false): THREE.ShaderMaterial {
  const key = `${color}:${ice}`;
  const existing = materials.get(key);
  if (existing) return existing;
  const base = new THREE.Color(color);
  const reference = new THREE.Color("#23616a");
  const tint = (hex: string) => {
    const target = new THREE.Color(hex);
    return new THREE.Color().setRGB(
      target.r * base.r / reference.r,
      target.g * base.g / reference.g,
      target.b * base.b / reference.b,
    );
  };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: base },
      shadowColor: { value: ice ? base.clone().multiplyScalar(0.24) : tint("#123d48") },
      highlightColor: { value: ice ? base.clone().multiplyScalar(0.9) : tint("#43858a") },
    },
    vertexShader,
    fragmentShader,
  });
  materials.set(key, material);
  return material;
}

export function forgetLandMaterials() {
  for (const material of materials.values()) material.dispose();
  materials.clear();
}

/** Soft, cool illumination for the matte ocean. */
export function sunlitLights(): {
  lights: THREE.Light[];
  aim: (camera: THREE.Camera) => void;
} {
  const sun = new THREE.DirectionalLight(0xb8e6ed, 1.15);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  return {
    lights: [new THREE.AmbientLight(0xc3dcf0, 0.55), sun],
    aim(camera) {
      camera.updateMatrixWorld();
      camera.getWorldDirection(forward).multiplyScalar(-1);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      sun.position.copy(forward).addScaledVector(right, -0.65)
        .addScaledVector(up, 0.8).normalize().multiplyScalar(400);
    },
  };
}
