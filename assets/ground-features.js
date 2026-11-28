import * as THREE from './vendor/three.module.min.js';

const stone = new THREE.Color('#8d806d');
const roofs = ['#71685b', '#a19680', '#88705c', '#7f8074', '#b3aa94'].map(color => new THREE.Color(color));
const road = new THREE.Color('#93836d');
const water = new THREE.Color('#345653');
const shade = new THREE.Color('#1c2a20');

function batch() {
  return { vertices: [], colors: [] };
}

function triangle(target, a, b, c, color) {
  target.vertices.push(...a, ...b, ...c);
  for (let i = 0; i < 3; i++) target.colors.push(color.r, color.g, color.b);
}

function addMesh(group, geometry, material) {
  if (!geometry.vertices.length) return;
  const meshGeometry = new THREE.BufferGeometry();
  meshGeometry.setAttribute('position', new THREE.Float32BufferAttribute(geometry.vertices, 3));
  meshGeometry.setAttribute('color', new THREE.Float32BufferAttribute(geometry.colors, 3));
  meshGeometry.computeVertexNormals();
  meshGeometry.computeBoundingSphere();
  group.add(new THREE.Mesh(meshGeometry, material));
}

function openRings(rings, transform) {
  return rings.map(ring => ring.filter((point, i) => i === 0 || point[0] !== ring[i - 1][0] || point[1] !== ring[i - 1][1])
    .map(point => transform(point))).filter(ring => ring.length > 2);
}

function triangulate(rings) {
  const [outline, ...holes] = rings.map(ring => ring.map(([x, z]) => new THREE.Vector2(x, z)));
  return THREE.ShapeUtils.triangulateShape(outline, holes);
}

function pitchedRoof(target, outline, eaves, height, top, index) {
  if (outline.length !== 4 || height > .014 || index % 5 === 0) return false;
  const edge = i => Math.hypot(outline[i][0] - outline[(i + 1) % 4][0], outline[i][1] - outline[(i + 1) % 4][1]);
  const longer = edge(0) >= edge(1) ? 0 : 1;
  const width = edge((longer + 1) % 4);
  if (width < .004 || width > .033 || edge(longer) / width > 4.8) return false;
  const [a, b, c, d] = Array.from({ length: 4 }, (_, i) => {
    const [x, z] = outline[(longer + i) % 4];
    return [x, eaves, z];
  });
  const crown = eaves + Math.min(.0025, width * .21);
  const left = [(a[0] + d[0]) * .5, crown, (a[2] + d[2]) * .5];
  const right = [(b[0] + c[0]) * .5, crown, (b[2] + c[2]) * .5];
  const farSide = top.clone().multiplyScalar(.84);
  triangle(target, a, right, b, top);
  triangle(target, a, left, right, top);
  triangle(target, d, c, right, farSide);
  triangle(target, d, right, left, farSide);
  triangle(target, a, d, left, stone);
  triangle(target, b, right, c, stone);
  return true;
}

function roofModel(target, shadow, rings, height, heightAt, index) {
  if (!rings.length) return;
  const top = roofs[index % roofs.length];
  const outline = rings[0];
  const center = outline.reduce(([x, z], p) => [x + p[0] / outline.length, z + p[1] / outline.length], [0, 0]);
  const ridge = Math.max(heightAt(...center), ...outline.map(point => heightAt(...point))) + height;
  const vertices = rings.flat();
  const shaped = rings.length === 1 && pitchedRoof(target, outline, ridge, height, top, index);
  const shadowX = Math.min(height * 1.16, .031);
  const shadowZ = Math.min(height * .63, .022);
  for (const [a, b, c] of triangulate(rings)) {
    if (!shaped) {
      const [px, py, pz] = [a, b, c].map(i => [vertices[i][0], ridge, vertices[i][1]]);
      triangle(target, px, pz, py, top);
    }
    const ground = [a, b, c].map(i => {
      const x = vertices[i][0] + shadowX;
      const z = vertices[i][1] + shadowZ;
      return [x, heightAt(x, z) + .00058, z];
    });
    triangle(shadow, ...ground, shade);
  }
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x, z] = ring[i];
      const [u, v] = ring[(i + 1) % ring.length];
      const a = [x, heightAt(x, z) - .001, z];
      const b = [u, heightAt(u, v) - .001, v];
      const c = [u, Math.max(b[1] + .001, ridge), v];
      const d = [x, Math.max(a[1] + .001, ridge), z];
      triangle(target, a, b, c, stone);
      triangle(target, a, c, d, stone);
    }
  }
}

function drapedTriangle(target, a, b, c, heightAt, maxStep) {
  const segments = [[a, b, c], [b, c, a], [c, a, b]];
  let longest;
  let size = maxStep;
  for (const [from, to, other] of segments) {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (length > size) {
      longest = [from, to, other];
      size = length;
    }
  }
  if (longest) {
    const [from, to, other] = longest;
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    drapedTriangle(target, from, mid, other, heightAt, maxStep);
    drapedTriangle(target, mid, to, other, heightAt, maxStep);
    return;
  }
  const points = [a, b, c].map(([x, z]) => [x, heightAt(x, z) + .00155, z]);
  triangle(target, ...points, water);
}

function ribbon(target, path, width, heightAt, color, offset) {
  const stations = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const [x, z] = path[i - 1];
    const [u, v] = path[i];
    const dx = u - x;
    const dz = v - z;
    const length = Math.hypot(dx, dz);
    if (length < .00005) continue;
    const steps = Math.ceil(length / .006);
    for (let j = 1; j <= steps; j++) stations.push([x + dx * j / steps, z + dz * j / steps]);
  }
  if (stations.length < 2) return;
  const banks = stations.map(([x, z], i) => {
    const from = stations[Math.max(0, i - 1)];
    const to = stations[Math.min(stations.length - 1, i + 1)];
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const scale = width / (2 * Math.max(.00005, Math.hypot(dx, dz)));
    return [-1, 1].map(side => {
      const px = x - dz * scale * side;
      const pz = z + dx * scale * side;
      return [px, heightAt(px, pz) + offset, pz];
    });
  });
  for (let i = 1; i < banks.length; i++) {
    const [a, b] = banks[i - 1];
    const [d, c] = banks[i];
    triangle(target, a, b, c, color);
    triangle(target, a, c, d, color);
  }
}

const waterVertex = /* glsl */ `
  varying vec3 vWater;
  void main() {
    vWater = position;
    // Match the terrain's view-space projection before perspective scaling.
    // Matrix-first multiplication loses precision on the atlas coordinates.
    vec4 eyePosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * eyePosition;
  }
`;

const waterFragment = /* glsl */ `
  uniform float time;
  uniform float haze;
  uniform vec2 riverOrigin;
  uniform sampler2D shoreMap;
  uniform float hasShore;
  uniform vec3 sunDirection;
  varying vec3 vWater;
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec4 n = fract(sin(vec4(dot(i, vec2(51.7, 72.2)), dot(i + vec2(1, 0), vec2(51.7, 72.2)),
      dot(i + vec2(0, 1), vec2(51.7, 72.2)), dot(i + 1.0, vec2(51.7, 72.2)))) * 43758.54);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(n.x, n.y, f.x), mix(n.z, n.w, f.x), f.y);
  }
  void main() {
    vec2 p = vWater.xz - riverOrigin;
    vec2 downstream = vec2(p.x * 235.0, (p.y - time * .005) * 117.0);
    float turbulence = noise(downstream * .38);
    float wave = noise(downstream * vec2(1.7, 2.9) + turbulence * 2.0);
    float ripple = sin(downstream.y * 5.2 + wave * 4.2 + turbulence * 12.0);
    float detail = 1.0 - smoothstep(.18, .93, length(fwidth(downstream)));
    vec2 shoreUv = p / 1.28 + .5;
    vec2 edge = min(shoreUv, 1.0 - shoreUv);
    float bank = hasShore * smoothstep(0.0, .045, min(edge.x, edge.y));
    float shore = texture2D(shoreMap, shoreUv).r;
    float shallows = (1.0 - smoothstep(.13, .62, shore)) * bank;
    float foam = smoothstep(.68, .94, wave * .68 + turbulence * .32);
    float whitewater = foam * (.17 + shallows * .64) * (.58 + ripple * .24) * detail;
    vec3 ray = cameraPosition - vWater;
    vec3 view = normalize(ray);
    vec3 microNormal = normalize(vec3((wave - .50) * .20, 1.0, ripple * .07));
    float sky = pow(1.0 - max(dot(view, microNormal), 0.0), 4.5);
    float glint = pow(max(0.0, dot(microNormal, normalize(view + sunDirection))), 66.0) *
      (.13 + turbulence * .42) * (.52 + wave * .38);
    vec3 base = mix(vec3(.013, .038, .045), vec3(.036, .084, .081), turbulence);
    base = mix(base, vec3(.064, .085, .068), shallows * .71);
    vec3 color = base + vec3(.065, .089, .104) * sky + vec3(.49, .37, .23) * glint + vec3(.32, .40, .37) * whitewater;
    gl_FragColor = vec4(mix(color, vec3(.165, .235, .254), (1.0 - exp(-length(ray) * haze)) * .73), .97);
    #include <colorspace_fragment>
  }
`;

const blankShore = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat);
blankShore.needsUpdate = true;

function makeShoreMap(water) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = 'white';
  for (const polygon of water) {
    context.beginPath();
    for (const ring of polygon) {
      ring.forEach(([x, z], i) => {
        const px = (x / 1280 + .5) * size;
        const py = (z / 1280 + .5) * size;
        if (i) context.lineTo(px, py);
        else context.moveTo(px, py);
      });
      context.closePath();
    }
    context.fill('evenodd');
  }
  const pixels = context.getImageData(0, 0, size, size).data;
  const distance = Float32Array.from({ length: size * size }, (_, i) => pixels[i * 4 + 3] > 127 ? 32 : 0);
  const diagonal = Math.SQRT2;
  for (let y = 1; y < size; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      distance[i] = Math.min(distance[i], distance[i - 1] + 1, distance[i - size] + 1,
        distance[i - size - 1] + diagonal, distance[i - size + 1] + diagonal);
    }
  }
  for (let y = size - 2; y >= 0; y--) {
    for (let x = size - 2; x > 0; x--) {
      const i = y * size + x;
      distance[i] = Math.min(distance[i], distance[i + 1] + 1, distance[i + size] + 1,
        distance[i + size - 1] + diagonal, distance[i + size + 1] + diagonal);
    }
  }
  const texture = new THREE.DataTexture(Uint8Array.from(distance, d => Math.min(255, d * 20)), size, size, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function overlapsLandmark(outline, point) {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [ax, az] = outline[j], [bx, bz] = outline[i];
    const dx = bx - ax, dz = bz - az;
    const length = dx * dx + dz * dz;
    if (!length) continue;
    const t = THREE.MathUtils.clamp(((point.x - ax) * dx + (point.z - az) * dz) / length, 0, 1);
    if (Math.hypot(ax + t * dx - point.x, az + t * dz - point.z) < .033) return true;
    if ((az > point.z) !== (bz > point.z) && point.x < ax + (point.z - az) * dx / dz) inside = !inside;
  }
  return inside;
}

export async function loadGroundFeatures(name, origin, heightAt, extraBuildings, sunDirection, landmark) {
  const additions = extraBuildings ? fetch(new URL('./terrain/' + name + '-buildings.json', import.meta.url))
    .then(response => response.ok ? response.json() : null).catch(() => null) : null;
  const response = await fetch(new URL('./terrain/' + name + '-vectors.json', import.meta.url));
  if (!response.ok) throw new Error('Ground features unavailable for ' + name);
  const data = await response.json();
  const extra = await additions;
  const footprints = data.buildings.concat(extra?.buildings || []);
  const tx = data.origin[0] - origin[0];
  const tz = data.origin[1] - origin[1];
  const transform = ([x, z]) => [tx + x * .001, tz + z * .001];
  const group = new THREE.Group();
  const buildings = batch();
  const shadows = batch();
  const roads = batch();
  const waterways = batch();
  const roadWidths = { motorway: .012, trunk: .010, primary: .0075, secondary: .0062, tertiary: .0048, minor: .0034, service: .0025, path: .0014 };

  footprints.forEach(([height, rings], i) => {
    const outline = openRings(rings, transform);
    if (landmark && outline[0] && overlapsLandmark(outline[0], landmark)) return;
    roofModel(buildings, shadows, outline, height * .00117, heightAt, i);
  });
  for (const [kind, line] of data.roads) {
    ribbon(roads, line.map(transform), roadWidths[kind] || .0031, heightAt, road, .0017);
  }
  for (const polygon of data.water) {
    const rings = openRings(polygon, transform);
    if (!rings.length) continue;
    const points = rings.flat();
    const spacing = name === 'luding' ? .009 : .024;
    for (const [a, b, c] of triangulate(rings)) drapedTriangle(waterways, points[a], points[b], points[c], heightAt, spacing);
  }
  if (!data.water.length) {
    for (const [kind, line] of data.streams) {
      ribbon(waterways, line.map(transform), kind === 'river' ? .008 : .0028, heightAt, water, .00143);
    }
  }
  const shoreMap = name === 'luding' && data.water.length ? makeShoreMap(data.water) : blankShore;
  const liquid = new THREE.ShaderMaterial({
    vertexShader: waterVertex, fragmentShader: waterFragment,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    uniforms: {
      time: { value: 0 }, haze: { value: .012 }, riverOrigin: { value: new THREE.Vector2(tx, tz) },
      shoreMap: { value: shoreMap }, hasShore: { value: shoreMap === blankShore ? 0 : 1 }, sunDirection: { value: sunDirection }
    }
  });
  addMesh(group, waterways, liquid);
  const river = group.children.at(-1);
  addMesh(group, roads, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true, transparent: true, opacity: .55 }));
  addMesh(group, shadows, new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide, vertexColors: true, transparent: true, opacity: .35, depthWrite: false
  }));
  addMesh(group, buildings, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: true }));
  group.userData.time = liquid.uniforms.time;
  group.userData.haze = liquid.uniforms.haze;
  group.userData.river = waterways.vertices.length ? river : null;
  if (shoreMap !== blankShore) group.userData.shoreMap = shoreMap;
  group.userData.count = footprints.length + data.roads.length + data.water.length + data.streams.length;
  return group;
}
