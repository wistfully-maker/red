import * as THREE from '../assets/vendor/three.module.min.js';
import { mergeGeometries } from '../assets/vendor/BufferGeometryUtils.js';

const surface = (name, color, roughness = .86) =>
  new THREE.MeshStandardMaterial({ name, color, roughness });
const slate = surface('Slate', '#424f4a');
const darkWood = surface('Dark timber', '#584339');
const beam = surface('Weathered timber', '#af875b');
const stone = surface('Sandstone', '#cbb394');
const plaster = surface('Lime plaster', '#f0dec0');
const brick = surface('Dark grey brick', '#615e53');
const opening = surface('Recesses', '#282b26');
const water = surface('River', '#335f61', .32);
const grass = surface('Meadow', '#8f9d5b');
const peat = surface('Peat', '#5b6240');
const rock = surface('River bank', '#7d8271');

function builder(name) {
  const batches = new Map();
  function add(geometry, material, x, y, z, yaw = 0) {
    geometry.rotateY(yaw).translate(x, y, z);
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    // Every primitive shares the same vertex layout within its material batch.
    part.deleteAttribute('uv');
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(part);
  }
  function box(material, x, y, z, w, h, d, yaw) {
    add(new THREE.BoxGeometry(w, h, d), material, x, y, z, yaw);
  }
  function tube(material, path, radius) {
    const points = path.map(p => new THREE.Vector3(...p));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length * 3), radius, 5), material, 0, 0, 0);
  }
  function roof(x, y, z, w, d, h) {
    const geometry = new THREE.BufferGeometry();
    const a = [-w/2, 0, -d/2], b = [w/2, 0, -d/2], c = [w/2, 0, d/2], e = [-w/2, 0, d/2];
    const p = [-w * .30, h, 0], q = [w * .30, h, 0];
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      ...a, ...p, ...b, ...b, ...p, ...q, ...b, ...q, ...c,
      ...c, ...q, ...e, ...e, ...q, ...p, ...e, ...p, ...a
    ], 3));
    geometry.computeVertexNormals();
    add(geometry, slate, x, y, z);
    box(darkWood, x, y + h, z, w * .63, .021, .027);
  }
  function finish() {
    const model = new THREE.Group();
    model.name = name;
    for (const [material, parts] of batches) {
      const mesh = new THREE.Mesh(mergeGeometries(parts), material);
      mesh.name = material.name;
      model.add(mesh);
    }
    return model;
  }
  return {add, box, tube, roof, finish};
}

function yudu() {
  const b = builder('yudu');
  b.add(new THREE.CylinderGeometry(.49, .45, .044, 32), water, 0, .025, 0);
  for (let i = -3; i <= 3; i++) {
    const x = i * .119;
    b.add(new THREE.CapsuleGeometry(.035, .21, 3, 6).rotateX(Math.PI / 2).scale(.95, .48, 1), darkWood, x, .080, 0);
    b.box(beam, x, .107, 0, .05, .020, .23);
  }
  for (let i = -17; i <= 17; i++) b.box(i % 4 === 0 ? stone : beam, i * .025, .143, 0, .023, .020, .138);
  for (const side of [-1, 1]) {
    b.box(rock, side * .435, .080, -.02, .158, .096, .38, side * .17);
    b.box(stone, side * .419, .121, 0, .12, .027, .13);
  }
  return b.finish();
}

export function makeZunyiHall() {
  const b = builder('zunyi');
  b.box(stone, 0, .035, 0, 1, .068, .79);
  b.box(brick, -.02, .245, -.102, .84, .39, .39);
  b.box(plaster, .323, .235, .11, .225, .37, .35);
  b.roof(-.02, .445, -.102, .95, .50, .13);
  b.roof(.32, .425, .10, .30, .45, .101);
  b.box(slate, -.11, .256, .13, .67, .033, .126);
  for (const y of [.072, .252, .432]) b.box(plaster, -.030, y, .102, .85, .025, .034);
  b.box(brick, -.417, .259, .131, .052, .40, .16);
  b.box(brick, .382, .259, .161, .052, .40, .16);
  for (const y of [.147, .339]) {
    for (let i = 0; i < 5; i++) {
      const x = -.35 + i * .139;
      b.box(opening, x, y, .097, .105, .125, .015);
      b.box(beam, x, y, .111, .013, .104, .011);
      b.box(darkWood, x, y + .02, .112, .092, .011, .012);
      b.box(darkWood, x + .06, y, .181, .032, .169, .028);
      b.tube(plaster, Array.from({length: 7}, (_, k) => {
        const angle = Math.PI * k / 6;
        return [x + .056 * Math.cos(angle), y + .041 + .057 * Math.sin(angle), .179];
      }), .012);
    }
  }
  b.box(darkWood, -.097, .292, .184, .65, .022, .024);
  for (let i=0; i<20; i++) b.box(darkWood, -.415 + i*.033, .28, .185, .012, .057, .015);
  for (let i = 0; i < 4; i++) b.box(stone, -.11, .040 + i * .011, .29 - i * .018, .30, .011, .04);
  b.box(stone, -.11, .078, .235, .31, .024, .12);
  return b.finish();
}

function luding() {
  const b = builder('luding');
  b.add(new THREE.CylinderGeometry(.50, .46, .042, 32), water, 0, .027, 0);
  for (const side of [-1, 1]) {
    const x = side * .363;
    b.box(rock, x, .074, 0, .275, .075, .49, side * .14);
    b.box(stone, x, .127, 0, .217, .138, .235);
    for (const dx of [-.082, .082]) {
      for (const z of [-.079, .079]) b.box(darkWood, x + dx, .257, z, .029, .145, .026);
    }
    b.roof(x, .322, 0, .25, .254, .089);
  }
  for (const z of [-.065, -.036, 0, .036, .065]) {
    const arc = Array.from({length: 9}, (_, i) => {
      const t = i / 8, sag = .058 * 4 * t * (1 - t);
      return [(t - .5) * .65, .204 + (Math.abs(z) > .06 ? .053 : 0) - sag, z];
    });
    b.tube(darkWood, arc, .009);
  }
  for (let i = -4; i <= 4; i++) {
    const x = i * .061;
    b.box(beam, x, .150 + .055 * (x / .33) ** 2, 0, .041, .019, .112);
  }
  return b.finish();
}

function songpan() {
  const b = builder('songpan');
  b.add(new THREE.CylinderGeometry(.50, .46, .075, 32), peat, 0, .043, 0);
  const river = [];
  for (let i = 0; i <= 18; i++) {
    const z = (i / 18 - .5) * .89;
    river.push([Math.sin(z * 14) * .116, .092, z]);
  }
  b.tube(water, river, .037);
  for (let i = 0; i < 27; i++) {
    const angle = i * 2.39996;
    const distance = .11 + .32 * ((i * 7 % 27) / 26);
    const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
    if (Math.abs(x - Math.sin(z * 14) * .116) < .074) continue;
    b.add(new THREE.IcosahedronGeometry(.09, 1).scale(1.1, .31, .71), i % 4 ? grass : peat, x, .093, z, angle);
    if (i % 3 === 0) b.add(new THREE.ConeGeometry(.021, .075, 5), grass, x, .143, z);
  }
  return b.finish();
}

export function makeOverviewLandmarks() {
  const group = new THREE.Group();
  group.name = 'Long March overview landmark scale models';
  group.add(yudu(), makeZunyiHall(), luding(), songpan());
  return group;
}
