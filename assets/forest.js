import * as THREE from './vendor/three.module.min.js';

const crownVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vOrigin;
  varying float vDepth;
  void main() {
    vUv = uv;
    vColor = instanceColor;
    vOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec4 eye = viewMatrix * vec4(vOrigin, 1.0);
    eye.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
    vDepth = -eye.z;
    gl_Position = projectionMatrix * eye;
  }
`;

const crownFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vOrigin;
  varying float vDepth;
  uniform float history;
  uniform vec2 bridgeCenter;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(67.1, 251.9))) * 41278.5453);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float tree = min(length((p - vec2(-.26, -.15)) / vec2(.58, .65)),
      length((p - vec2(.28, -.12)) / vec2(.55, .60)));
    tree = min(tree, length((p - vec2(.02, .29)) / vec2(.55, .60)));
    float branches = hash(floor(vUv * vec2(9.0, 11.0)) + floor(vOrigin.xz * 13.0));
    float leaves = hash(floor(vUv * vec2(41.0, 46.0)) + floor(vOrigin.xz * 4.0));
    float silhouette = 1.0 - smoothstep(.76, 1.04, tree + (branches - .44) * .25 + (leaves - .5) * .16);
    float weight = (1.0 - smoothstep(10.5, 22.0, vDepth)) *
      (1.0 - history * (1.0 - smoothstep(.16, .38, distance(vOrigin.xz, bridgeCenter))));
    float alpha = silhouette * weight * .91;
    if (alpha < .025) discard;
    float shade = clamp(.62 + .29 * p.y - .26 * p.x + branches * .23 + leaves * .17, .35, 1.27);
    vec3 color = (vColor + vec3(.013, .028, .009)) * shade;
    color = mix(color, vec3(.17, .225, .192), (1.0 - exp(-vDepth * .017)) * .85);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

function imagerySample(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

export function canopyCoverage(image, cover) {
  const width = 640;
  const height = Math.round(width * image.height / image.width);
  const rgb = imagerySample(image, width, height);
  const classified = cover ? imagerySample(cover, width, height) : null;
  const coverValues = new Uint8Array(width * height);
  for (let i = 0; i < coverValues.length; i++) {
    const [r, g, b] = [rgb[i * 4], rgb[i * 4 + 1], rgb[i * 4 + 2]];
    const spectral = g > 29 && g < 156 && g - r > 5 && g - b > 10 && r >= b ? 210 : 0;
    coverValues[i] = classified ? classified[i * 4] * (spectral ? 1 : .74) : spectral;
  }
  const texture = new THREE.DataTexture(coverValues, width, height, THREE.RedFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { width, height, rgb, coverValues, texture };
}

export function makeForest(patch, heightAt, compact, coverage) {
  if (!coverage || patch.name === 'huahu-near') return null;
  const [west, north, east, south] = patch.bounds;
  const { width, height, rgb, coverValues } = coverage;
  const candidates = compact ? 36000 : 79000;
  const step = Math.sqrt((east - west) * (south - north) / candidates);
  const trees = [];
  let state = 17219;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let z = north + step; z < south - step; z += step) {
    for (let x = west + step; x < east - step; x += step) {
      const px = x + (random() - .5) * step;
      const pz = z + (random() - .5) * step;
      const u = (px - west) / (east - west);
      const v = (pz - north) / (south - north);
      // The relief fades into the surrounding surface at the patch perimeter.
      const edge = Math.min(u, v, 1 - u, 1 - v);
      const edgeWeight = THREE.MathUtils.smoothstep(edge, .032, .13);
      if (!edgeWeight) continue;
      const cell = Math.floor(v * height) * width + Math.floor(u * width);
      if (random() * 255 > coverValues[cell] * edgeWeight) continue;
      const index = 4 * cell;
      const r = rgb[index];
      const g = rgb[index + 1];
      const b = rgb[index + 2];
      const y = heightAt(px, pz);
      const slope = Math.hypot(heightAt(px + .025, pz) - y, heightAt(px, pz + .025) - y) / .025;
      if (y > 5.15 || slope > 1.82 || random() < .08) continue;
      trees.push({ x: px, y, z: pz, r, g, b, scale: random() });
    }
  }

  if (!trees.length) return null;
  const crown = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: crownVertex, fragmentShader: crownFragment, transparent: true, depthWrite: false,
    uniforms: { history: { value: 0 }, bridgeCenter: { value: new THREE.Vector2() } }
  });
  const canopy = new THREE.InstancedMesh(crown, material, trees.length);
  const transform = new THREE.Object3D();
  const color = new THREE.Color();

  trees.forEach(({ x, y, z, r, g, b, scale }, i) => {
    const size = .0036 + scale * .0068;
    transform.position.set(x, y + size * .8, z);
    transform.scale.set(size, size * 1.21, size);
    transform.updateMatrix();
    canopy.setMatrixAt(i, transform.matrix);
    color.setRGB(r / 255 * 1.16, g / 255 * 1.27, b / 255 * 1.10, THREE.SRGBColorSpace);
    canopy.setColorAt(i, color);
  });

  canopy.computeBoundingSphere();
  return canopy;
}
