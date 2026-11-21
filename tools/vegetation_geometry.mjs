import * as THREE from '../assets/vendor/three.module.min.js';

let treeForms;
let foliageForms;

function foliageCards(tiers, seed) {
  const vertices = [], normals = [], uv = [], colors = [];
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const conifer = tiers.length === 4;
  for (const [height, extent, count] of tiers) {
    for (let i = 0; i < count; i++) {
      const bearing = (i + random() * .65) * Math.PI * 2 / count;
      const radius = extent * (.47 + random() * .46);
      const x = Math.cos(bearing) * radius;
      const z = Math.sin(bearing) * radius;
      const y = height + (random() - .5) * (conifer ? .14 : .36);
      const width = extent * (.42 + random() * .25);
      const tall = extent * (.42 + random() * .37);
      const rotation = bearing + (random() - .5) * 1.9;
      const tilt = (random() - .5) * .95;
      const horizontal = new THREE.Vector3(Math.cos(rotation), 0, Math.sin(rotation));
      const vertical = new THREE.Vector3(-horizontal.z * tilt, 1, horizontal.x * tilt).normalize();
      const outward = new THREE.Vector3(x * .72, .37 + random() * .37, z * .72).normalize();
      const shade = .69 + random() * .43;
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]]) {
        const s = (u - .5) * width * 2, t = (v - .5) * tall * 2;
        vertices.push(x + s * horizontal.x + t * vertical.x, y + t * vertical.y, z + s * horizontal.z + t * vertical.z);
        normals.push(outward.x, outward.y, outward.z);
        uv.push(u, v);
        colors.push(shade, shade, shade);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

export function foliageGeometries() {
  foliageForms ??= [
    foliageCards([[.87, .54, 6], [1.14, .70, 9], [1.42, .61, 8], [1.67, .34, 5], [1.84, .18, 3]], 2917),
    foliageCards([[.73, .55, 9], [1.06, .48, 8], [1.38, .36, 7], [1.70, .23, 6]], 7443),
    foliageCards([[.49, .61, 6], [.72, .70, 7], [.99, .42, 5]], 2249)
  ];
  return foliageForms;
}

export function treeGeometries() {
  if (treeForms) return treeForms;
  const round = () => new THREE.IcosahedronGeometry(1, 1);
  const cone = () => new THREE.ConeGeometry(1, 2, 7, 1, true).toNonIndexed();
  const trunk = () => new THREE.CylinderGeometry(.062, .105, 1.07, 5, 1).toNonIndexed();
  const forms = [
    [[round, -.26, .93, .08, .56, .52, .52], [round, .32, 1.01, -.07, .54, .51, .51], [round, 0, 1.39, .03, .55, .60, .54]],
    [[cone, 0, .86, 0, .64, .46, .61], [cone, -.05, 1.26, 0, .51, .51, .49], [cone, .06, 1.65, .02, .32, .50, .31]],
    [[round, -.23, .52, 0, .52, .44, .53], [round, .25, .63, .11, .59, .55, .52], [round, -.03, .98, -.13, .48, .49, .47]]
  ];
  treeForms = forms.map((crown, index) => {
    const positions = [];
    const colors = [];
    const parts = index === 2 ? crown : [[trunk, 0, .47, 0, 1, 1, 1], ...crown];
    for (const [shape, x, y, z, sx, sy, sz] of parts) {
      const core = shape === trunk ? 1 : .80;
      const geometry = shape().scale(sx * core, sy * core, sz * core).translate(x, y, z);
      const vertices = geometry.attributes.position.array;
      for (const value of vertices) positions.push(value);
      for (let i = 0; i < vertices.length / 3; i++) {
        const shade = .78 + .16 * Math.sin(vertices[i * 3] * 9 + vertices[i * 3 + 2] * 7);
        if (shape === trunk) colors.push(.65 * shade, .35 * shade, .18 * shade);
        else colors.push(shade, shade, shade);
      }
      geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  });
  return treeForms;
}

