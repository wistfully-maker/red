import * as THREE from './vendor/three.module.min.js';

const crownVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vOrigin;
  varying float vDepth;
  varying float vForm;
  attribute float form;
  #ifdef ATLAS_CROWNS
    attribute float terrainStart;
    uniform float reliefTransition;
  #endif
  void main() {
    vUv = uv;
    vColor = instanceColor;
    vForm = form;
    vOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #ifdef ATLAS_CROWNS
      vOrigin.y = mix(terrainStart, vOrigin.y, smoothstep(0.0, 1.0, reliefTransition));
    #endif
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
  varying float vForm;
  uniform sampler2D crownMap;
  uniform float history;
  uniform float haze;
  uniform float nearStart;
  uniform float nearEnd;
  uniform vec2 bridgeCenter;
  #ifdef ATLAS_CROWNS
    uniform vec4 stationBounds;
    uniform float hasStationBounds;
    uniform float forestBlend;
  #endif
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(67.1, 251.9))) * 41278.5453);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    vec4 leaf = texture2D(crownMap, vec2(vUv.x * .492 + .004 + vForm * .5, vUv.y));
    float nearFade = smoothstep(nearStart, nearEnd, distance(vOrigin, cameraPosition));
    float weight = nearFade * (1.0 - smoothstep(13.0, 29.0, vDepth)) *
      (1.0 - history * (1.0 - smoothstep(.16, .38, distance(vOrigin.xz, bridgeCenter))));
    #ifdef ATLAS_CROWNS
      if (hasStationBounds > .5 && all(greaterThanEqual(vOrigin.xz, stationBounds.xy)) &&
          all(lessThanEqual(vOrigin.xz, stationBounds.zw))) discard;
      weight *= forestBlend;
    #endif
    if (leaf.a < .35 || hash(gl_FragCoord.xy) > weight) discard;
    float shade = clamp(.55 + .33 * p.y - .22 * p.x + leaf.r * .77, .35, 1.27);
    vec3 color = (vColor + vec3(.013, .028, .009)) * shade;
    color = mix(color, vec3(.165, .235, .254), (1.0 - exp(-vDepth * haze)) * .73);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const groveVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vOrigin;
  varying vec3 vCrown;
  varying float vDistance;
  #ifdef FOLIAGE
    varying vec2 vLeafUv;
  #endif
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    mat3 transform = mat3(instanceMatrix);
    vec3 inverseScale = vec3(dot(transform[0], transform[0]), dot(transform[1], transform[1]), dot(transform[2], transform[2]));
    vNormal = normalize(mat3(modelMatrix) * transform * (normal / inverseScale));
    vColor = instanceColor * color;
    vCrown = position;
    vDistance = distance(cameraPosition, vOrigin);
    #ifdef FOLIAGE
      vLeafUv = uv;
    #endif
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const groveFragment = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vOrigin;
  varying vec3 vCrown;
  varying float vDistance;
  uniform vec2 bridgeCenter;
  uniform vec3 sun;
  uniform float history;
  uniform float haze;
  uniform float nearStart;
  uniform float nearEnd;
  #ifdef FOLIAGE
    varying vec2 vLeafUv;
    uniform sampler2D crownMap;
  #endif

  float hash(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715))));
  }

  void main() {
    float fade = 1.0 - smoothstep(nearStart, nearEnd, vDistance);
    float era = history * (1.0 - smoothstep(.16, .38, distance(vOrigin.xz, bridgeCenter)));
    if (fade * (1.0 - era) < hash(gl_FragCoord.xy)) discard;
    vec3 normal = normalize(vNormal);
    float facing = max(0.0, dot(normal, sun));
    float upward = max(0.0, normal.y);
    float leaf = hash(floor((vCrown.xz + vec2(vCrown.y * .71, vCrown.y)) * 29.0));
    float textureWeight = 1.0 - smoothstep(.022, .065, length(fwidth(vCrown)));
    vec3 lit = vColor * (.52 + facing * .88 + upward * .19);
    lit *= mix(vec3(.78, .95, 1.10), vec3(1.10, 1.02, .83), facing);
    lit *= 1.0 + (leaf - .48) * .29 * textureWeight;
    lit += vec3(.010, .020, .008) * (facing + upward) * .4;
    #ifdef FOLIAGE
      vec4 foliage = texture2D(crownMap, vec2(.004 + vLeafUv.x * .492 + CROWN_OFFSET, .19 + vLeafUv.y * .78));
      if (foliage.a < .38) discard;
      lit *= .63 + foliage.r * .65;
      lit += vec3(.029, .039, .012) * (1.0 - facing) * upward * foliage.r;
    #endif
    gl_FragColor = vec4(mix(lit, vec3(.165, .235, .254), (1.0 - exp(-vDistance * haze)) * .73), 1.0);
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

function forestShadows(trees, bounds, sun, compact) {
  const [west, north, east, south] = bounds;
  const size = compact ? 768 : 1536;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const scaleX = size / (east - west), scaleZ = size / (south - north);
  const angle = Math.atan2(-sun.z * scaleZ, -sun.x * scaleX);
  const along = Math.hypot(sun.x * scaleX, sun.z * scaleZ) / sun.y;
  for (const { x, z, scale, form } of trees) {
    const stature = (.0036 + scale * .0068) * (form === 2 ? .62 : 1);
    const px = (x - west) * scaleX, py = (z - north) * scaleZ;
    context.fillStyle = 'rgba(255,255,255,.36)';
    context.beginPath();
    context.ellipse(px - sun.x * stature * .58 * scaleX / sun.y, py - sun.z * stature * .58 * scaleZ / sun.y,
      Math.max(.65, stature * along), Math.max(.43, stature * .70 * scaleX), angle, 0, Math.PI * 2);
    context.fill();
  }
  const rgba = context.getImageData(0, 0, size, size).data;
  const values = new Uint8Array(size * size);
  for (let i = 0; i < values.length; i++) values[i] = rgba[i * 4 + 3];
  const map = new THREE.DataTexture(values, size, size, THREE.RedFormat);
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

export function makeForest(patch, heightAt, compact, coverage, sun, bridgeCenter, forms, crownMap) {
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
      const scale = random();
      const form = y > 2.7 ? (scale < .76 ? 1 : 2) : (scale < .22 ? 1 : scale < .36 ? 2 : 0);
      trees.push({ x: px, y, z: pz, r, g, b, scale, form, angle: random() * Math.PI * 2 });
    }
  }

  if (!trees.length) return null;
  const forest = new THREE.Group();
  const crown = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    history: { value: 0 }, haze: { value: 0 }, bridgeCenter: { value: bridgeCenter }, sun: { value: sun }, crownMap: { value: crownMap },
    nearStart: { value: compact ? .70 : .95 }, nearEnd: { value: compact ? 1.35 : 1.85 }
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: crownVertex, fragmentShader: crownFragment, uniforms
  });
  const solidMaterial = new THREE.ShaderMaterial({
    vertexShader: groveVertex, fragmentShader: groveFragment, uniforms, vertexColors: true
  });
  const leafMaterials = ['0.0', '0.5'].map(offset => new THREE.ShaderMaterial({
    vertexShader: groveVertex, fragmentShader: groveFragment, uniforms, vertexColors: true,
    side: THREE.DoubleSide, defines: { FOLIAGE: 1, CROWN_OFFSET: offset }
  }));
  const canopy = new THREE.InstancedMesh(crown, material, trees.length);
  crown.setAttribute('form', new THREE.InstancedBufferAttribute(Float32Array.from(trees, tree => tree.form === 1 ? 1 : 0), 1));
  const clusters = new Map();
  const transform = new THREE.Object3D();
  const color = new THREE.Color();

  trees.forEach((tree, i) => {
    const { x, y, z, r, g, b, scale, form } = tree;
    const size = .0036 + scale * .0068;
    const stature = form === 2 ? size * .62 : size;
    transform.position.set(x, y + size * .8, z);
    transform.scale.set(size, stature * 1.16, size);
    transform.updateMatrix();
    canopy.setMatrixAt(i, transform.matrix);
    color.setRGB(r / 255 * 1.16, g / 255 * 1.27, b / 255 * 1.10, THREE.SRGBColorSpace);
    canopy.setColorAt(i, color);
    const key = [Math.floor(x / .85), Math.floor(z / .85), form].join('/');
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push({ ...tree, size, stature });
  });

  canopy.computeBoundingSphere();
  forest.add(canopy);
  const closeGroves = [];
  for (const grove of clusters.values()) {
    const form = grove[0].form;
    const mesh = new THREE.InstancedMesh(forms[form].body, solidMaterial, grove.length);
    const leaves = new THREE.InstancedMesh(forms[form].foliage, leafMaterials[form === 1 ? 1 : 0], grove.length);
    mesh.userData.sharedGeometry = true;
    leaves.userData.sharedGeometry = true;
    grove.forEach(({ x, y, z, r, g, b, size, stature, angle }, i) => {
      transform.position.set(x, y - .0006, z);
      transform.rotation.y = angle;
      transform.scale.set(size, stature, size);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      color.setRGB(r / 255 * 1.19, g / 255 * 1.30, b / 255 * 1.12, THREE.SRGBColorSpace);
      mesh.setColorAt(i, color);
    });
    leaves.instanceMatrix.array.set(mesh.instanceMatrix.array);
    leaves.instanceColor = mesh.instanceColor.clone();
    mesh.computeBoundingSphere();
    leaves.computeBoundingSphere();
    const cluster = new THREE.Group();
    cluster.add(mesh, leaves);
    cluster.visible = false;
    closeGroves.push({ cluster, bounds: mesh.boundingSphere.clone().union(leaves.boundingSphere) });
    forest.add(cluster);
  }
  forest.userData = { uniforms, closeGroves, shadowMap: forestShadows(trees, patch.bounds, sun, compact) };
  return forest;
}

export function makeAtlasForest(patch, coverage, sampleSurface, crownMap, compact, stationCut, sun) {
  const [west, north, east, south] = patch.bounds;
  const { width, height, coverValues } = coverage;
  const step = Math.max(compact ? .144 : .091,
    Math.sqrt((east - west) * (south - north) / (compact ? 42000 : 112000)));
  const crowns = [];
  const noise = (x, z, seed) => {
    const n = Math.sin(x * 127.1 + z * 311.7 + seed * 41.2) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let row = Math.ceil(north / step); row < south / step; row++) {
    for (let column = Math.ceil(west / step); column < east / step; column++) {
      const x = (column + noise(column, row, 3) * .94) * step;
      const z = (row + noise(column, row, 5) * .94) * step;
      const u = (x - west) / (east - west), v = (z - north) / (south - north);
      const inset = Math.min(u, v, 1 - u, 1 - v);
      if (inset < .05 || !coverValues[Math.floor(v * height) * width + Math.floor(u * width)]) continue;
      const thinning = THREE.MathUtils.smoothstep(inset, .05, .17);
      const variation = noise(column, row, 11);
      if (variation > thinning * .88) continue;
      const y = sampleSurface(patch, x, z);
      const dx = (sampleSurface(patch, x + .06, z) - y) / .06;
      const dz = (sampleSurface(patch, x, z + .06) - y) / .06;
      if (Math.hypot(dx, dz) > 1.30 || y > 4.7) continue;
      const light = Math.max(0, (-dx * sun.x + sun.y - dz * sun.z) / Math.hypot(dx, 1, dz));
      crowns.push({ x, y, z, size: .006 + noise(column, row, 16) * .010, variation, light });
    }
  }
  if (!crowns.length) return null;
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: crownVertex, fragmentShader: crownFragment, defines: { ATLAS_CROWNS: 1 },
    uniforms: {
      crownMap: { value: crownMap }, history: { value: 0 }, haze: patch.mesh.material.uniforms.haze,
      nearStart: { value: 0 }, nearEnd: { value: .01 }, bridgeCenter: { value: new THREE.Vector2() },
      forestBlend: { value: 0 }, reliefTransition: patch.mesh.material.uniforms.reliefTransition,
      hasStationBounds: stationCut.hasCut, stationBounds: stationCut.cut
    }
  });
  const mesh = new THREE.InstancedMesh(geometry, material, crowns.length);
  const forms = new Float32Array(crowns.length);
  const starting = new Float32Array(crowns.length);
  const transform = new THREE.Object3D(), tint = new THREE.Color();
  crowns.forEach(({ x, y, z, size, variation, light }, i) => {
    const conifer = y > 2.1 ? variation < .71 : variation < .20;
    const lift = size * .85;
    transform.position.set(x, y + lift, z);
    transform.scale.set(size, size * (conifer ? 1.32 : 1.05), size);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
    tint.setHSL(.242 + variation * .066, .24 + variation * .16, (.053 + variation * .034) * (.60 + light * .48));
    mesh.setColorAt(i, tint);
    forms[i] = conifer ? 1 : 0;
    starting[i] = sampleSurface(patch, x, z, 0) + lift;
  });
  geometry.setAttribute('form', new THREE.InstancedBufferAttribute(forms, 1));
  geometry.setAttribute('terrainStart', new THREE.InstancedBufferAttribute(starting, 1));
  mesh.computeBoundingSphere();
  mesh.visible = false;
  return mesh;
}

export function updateForest(forest, eye, distance, haze, history) {
  forest.visible = distance < 32;
  if (!forest.visible) return;
  const { uniforms, closeGroves } = forest.userData;
  uniforms.history.value = history;
  uniforms.haze.value = haze;
  for (const { cluster, bounds } of closeGroves) {
    cluster.visible = bounds.center.distanceToSquared(eye) < (bounds.radius + uniforms.nearEnd.value) ** 2;
  }
}
