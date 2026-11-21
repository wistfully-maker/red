import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as THREE from '../assets/vendor/three.module.min.js';
import { mergeGeometries } from '../assets/vendor/BufferGeometryUtils.js';
import { GLTFExporter } from './vendor/GLTFExporter.js';
import { GLTFLoader } from '../assets/vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../assets/vendor/meshopt_decoder.js';
import { mercator } from '../assets/geo.js';
import { foliageGeometries, treeGeometries } from './vegetation_geometry.mjs';
import { makeLudingBridge } from './luding_geometry.mjs';
import { makeZunyiHall } from './overview_geometry.mjs';

// The Three.js exporter uses FileReader to assemble its binary chunks.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

function bakeBridge() {
  const source = makeLudingBridge();
  const bridge = new THREE.Group();
  bridge.name = 'Luding Bridge';
  bridge.scale.copy(source.scale);
  bridge.quaternion.copy(source.quaternion);
  const eras = [
    ['common', source.children.filter(child => child.isMesh)],
    ['modern', source.userData.modern.children],
    ['historical', source.userData.historical.children]
  ];
  for (const [name, objects] of eras) {
    const era = new THREE.Group();
    era.name = name;
    const batches = new Map();
    for (const object of objects) {
      object.updateMatrixWorld(true);
      object.traverse(mesh => {
        if (!mesh.isMesh) return;
        // The two eras share placement. Preserve the repeated chain links as GPU instances.
        if (mesh.isInstancedMesh) {
          era.add(mesh.clone());
          return;
        }
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        if (!batches.has(mesh.material)) batches.set(mesh.material, []);
        batches.get(mesh.material).push(geometry);
      });
    }
    for (const [source, parts] of batches) {
      const geometry = mergeGeometries(parts);
      if (!geometry) throw new Error('Cannot merge bridge primitives');
      const material = new THREE.MeshStandardMaterial({
        color: source.color, roughness: .85, vertexColors: source.vertexColors, side: source.side
      });
      material.name = source.name;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = source.name;
      era.add(mesh);
      parts.forEach(part => part.dispose());
    }
    bridge.add(era);
  }
  return bridge;
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j];
    if ((b > z) !== (d > z) && x < (c - a) * (z - b) / (d - b) + a) inside = !inside;
  }
  return inside;
}

async function bakeBanks() {
  const terrainDir = new URL('../assets/terrain/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', terrainDir), 'utf8'));
  const data = JSON.parse(await readFile(new URL('luding-vectors.json', terrainDir), 'utf8'));
  const [ox, oz] = mercator(manifest.origin);
  const [dx, dz] = data.origin.map((value, index) => value - [ox, oz][index]);
  const [left, top, right, bottom] = manifest.regions['luding-near'].bounds.map((value, i) => value - [ox, oz][i % 2]);
  const raw = await readFile(new URL('luding-near.glb', destination));
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const { scene } = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const { columns, rows } = scene.children[0].userData;
  const positions = scene.children[0].geometry.attributes.position;
  const height = (x, z) => {
    const u = (x - left) / (right - left) * columns;
    const v = (z - top) / (bottom - top) * rows;
    const i = Math.floor(u), j = Math.floor(v);
    const a = j * (columns + 1) + i, b = a + columns + 1;
    const y00 = positions.getY(a), y10 = positions.getY(a + 1);
    const y01 = positions.getY(b), y11 = positions.getY(b + 1);
    const s = u - i, t = v - j;
    return s + t <= 1 ? y00 + s * (y10 - y00) + t * (y01 - y00) :
      y11 + (1 - s) * (y01 - y11) + (1 - t) * (y10 - y11);
  };
  const water = (x, z) => data.water.some(([outline, ...holes]) =>
    pointInRing(x, z, outline) && !holes.some(hole => pointInRing(x, z, hole)));
  let seed = 1763;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const rocks = [], scrub = [], grasses = [];
  for (let z = -310; z <= 260; z += 4) {
    for (let x = -215; x <= 170; x += 4) {
      const east = x + random() * 4, north = z + random() * 4;
      if (water(east, north) || (Math.abs(north) < 13 && Math.abs(east) < 82)) continue;
      const shore = [-19, 19].some(offset => water(east + offset, north));
      const clusters = .50 + .24 * Math.sin(east * .092 + Math.sin(north * .11)) +
        .22 * Math.cos(north * .076 - east * .042);
      const localHeight = height(dx + east * .001, dz + north * .001);
      const slope = Math.abs(height(dx + (east + 4) * .001, dz + north * .001) - localHeight) / .004;
      if ((shore && random() < clusters * .66) || random() < slope * .075) rocks.push([east, north]);
      if (!shore && clusters > .60 && slope < .84 && random() < (clusters - .50) * .38) scrub.push([east, north]);
      if (slope < .8 && random() < clusters * (shore ? .42 : .24)) grasses.push([east, north]);
    }
  }
  const group = new THREE.Group();
  group.name = 'Luding historical banks';
  group.position.set(dx, 0, dz);
  const bridgeGeo = manifest.stations.luding;
  const [bridgeX, bridgeZ] = mercator(bridgeGeo);
  const centerX = bridgeX - ox - dx, centerZ = bridgeZ - oz - dz;
  const deck = Math.max(height(bridgeX - ox - .0587, bridgeZ - oz), height(bridgeX - ox + .0587, bridgeZ - oz)) + .0035;
  const stonePath = new THREE.BufferGeometry();
  const pathPoints = [], pathColors = [];
  const tint = new THREE.Color();
  for (const side of [-1, 1]) {
    const start = .073, length = side > 0 ? .046 : .032, segments = 42;
    function approach(t, edge) {
      const x = centerX + side * (start + length * t);
      const width = (.0040 - .0019 * t) * (1 - .78 * Math.max(0, (t - .55) / .45) ** 2);
      const z = centerZ + side * (.0028 + .018 * t * t) + edge * width;
      const ground = height(dx + x, dz + z);
      const blend = Math.max(0, 1 - t * 4) ** 2;
      const y = ground + .00036 + Math.max(0, deck - .0017 - ground) * blend;
      return [x, y, z];
    }
    for (let i = 0; i < segments; i++) {
      for (let lane = 0; lane < 4; lane++) {
        if (i > 14 && random() < i / segments * .34) continue;
        const u = (i + .05 + random() * .12) / segments;
        const v = (i + .82 + random() * .14) / segments;
        const left = lane * .5 - .98 + random() * .12;
        const right = left + .37 + random() * .07;
        const a = approach(u, left), b = approach(u, right), c = approach(v, left), d = approach(v, right);
        pathPoints.push(...a, ...b, ...c, ...c, ...b, ...d);
        tint.setHSL(.10 + random() * .045, .15 + random() * .09, .097 + random() * .075);
        for (let j = 0; j < 6; j++) pathColors.push(tint.r, tint.g, tint.b);
        if (lane !== 0 && lane !== 3) continue;
        const from = lane === 0 ? a : b;
        const to = lane === 0 ? c : d;
        const low = point => [point[0], height(dx + point[0], dz + point[2]) - .00028, point[2]];
        pathPoints.push(...from, ...to, ...low(from), ...to, ...low(to), ...low(from));
        for (let j = 0; j < 6; j++) pathColors.push(tint.r * .55, tint.g * .55, tint.b * .55);
      }
    }
  }
  stonePath.setAttribute('position', new THREE.Float32BufferAttribute(pathPoints, 3));
  stonePath.setAttribute('color', new THREE.Float32BufferAttribute(pathColors, 3));
  stonePath.computeVertexNormals();
  const approachMesh = new THREE.Mesh(stonePath, new THREE.MeshStandardMaterial({
    name: 'stone approach', roughness: .93, vertexColors: true, side: THREE.DoubleSide
  }));
  approachMesh.name = 'Schematic footpaths to both bridge pavilions';
  group.add(approachMesh);
  const stone = new THREE.IcosahedronGeometry(1, 1);
  const vertices = stone.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const edge = .83 + .17 * Math.sin(x * 13.1 + y * 9.2 + z * 15.1);
    vertices.setXYZ(i, x * edge, Math.max(-.58, y * edge) * .78, z * edge);
  }
  stone.computeVertexNormals();
  const grass = new THREE.BufferGeometry();
  const blades = [];
  for (let i = 0; i < 17; i++) {
    const theta = i * 2.39996;
    const x = Math.cos(theta), z = Math.sin(theta);
    const length = .24 + random() * .72, bend = .17 + random() * .62;
    blades.push(x * .12 - z * .05, 0, z * .12 + x * .05,
      x * .12 + z * .05, 0, z * .12 - x * .05, x * bend, length, z * bend);
  }
  grass.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
  grass.computeVertexNormals();
  const paint = ['#707064', '#666b61', '#827966', '#8d826f'];
  const leaf = ['#515b3e', '#414e34', '#66694b', '#464f36'];
  const reeds = ['#77734c', '#576143', '#8a8056'];
  const material = new THREE.MeshStandardMaterial({ roughness: .93 });
  const transform = new THREE.Object3D();
  for (const [name, points, geometry, colors, scaleMin, scaleRange] of [
    ['riverbank stones', rocks, stone, paint, .00022, .00195],
    ['low riverbank scrub', scrub, treeGeometries()[2], leaf, .00046, .00260],
    ['bank grasses', grasses, grass, reeds, .00036, .00095]
  ]) {
    for (const [index, color] of colors.entries()) {
      const selected = points.filter((_, i) => i % colors.length === index);
      const mesh = new THREE.InstancedMesh(geometry, material.clone(), selected.length);
      mesh.name = name + ' ' + (index + 1);
      mesh.material.name = name;
      if (geometry === grass) mesh.material.side = THREE.DoubleSide;
      mesh.material.color.set(color);
      selected.forEach(([x, z], i) => {
        const scale = scaleMin + random() ** 2 * scaleRange;
        const base = height(dx + x * .001, dz + z * .001);
        transform.position.set(x * .001, base - (geometry === stone ? scale * .12 : .00005), z * .001);
        transform.rotation.set(random() * .4, random() * 6.28, random() * .42);
        transform.scale.set(scale * (1 + random() * .55), scale * (.55 + random() * .55), scale);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      });
      group.add(mesh);
    }
  }
  return group;
}

const vegetation = new THREE.Group();
vegetation.name = 'Sichuan vegetation forms';
treeGeometries().forEach((geometry, index) => {
  const name = ['broadleaf', 'conifer', 'scrub'][index];
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.name = name;
  const foliage = new THREE.Mesh(foliageGeometries()[index],
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  foliage.name = name + '_foliage';
  vegetation.add(mesh, foliage);
});

const destination = new URL('../assets/models/', import.meta.url);
await mkdir(destination, { recursive: true });
const exporter = new GLTFExporter();
for (const [file, model] of [['zunyi-hall', makeZunyiHall()], ['vegetation', vegetation],
  ['luding-bridge', bakeBridge()], ['luding-banks', await bakeBanks()]]) {
  const binary = await exporter.parseAsync(model, { binary: true, onlyVisible: false });
  await writeFile(new URL(file + '.glb', destination), new Uint8Array(binary));
  console.log(file + '.glb: ' + binary.byteLength + ' bytes');
}
// Keep the dedicated, compressed nine-station overview reproducible from this entry point.
await import('./build_overview_models.mjs');
