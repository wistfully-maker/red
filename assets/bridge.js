import * as THREE from './vendor/three.module.min.js';

const span = 101.67;
const width = 3;
const sag = t => -5.7 * 4 * t * (1 - t);
const railPositions = [
  ...Array.from({ length: 9 }, (_, i) => [width * (i / 8 - .5), 0]),
  ...[-1, 1].flatMap(side => [[side * width / 2, 1], [side * width / 2, .55]])
];

function box(group, material, x, y, z, w, h, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function tiledRoof() {
  const positions = [];
  const colors = [];
  const indices = [];
  const tile = new THREE.Color();
  const corners = [[-6.4, -5.4], [6.4, -5.4], [6.4, 5.4], [-6.4, 5.4]];
  const ridge = [[0, -2.85], [0, -2.85], [0, 2.85], [0, 2.85]];
  const strips = 32;
  const rows = 11;
  for (let side = 0; side < 4; side++) {
    const start = positions.length / 3;
    const end = (side + 1) % 4;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      for (let col = 0; col <= strips; col++) {
        const u = col / strips;
        const edgeX = THREE.MathUtils.lerp(corners[side][0], corners[end][0], u);
        const edgeZ = THREE.MathUtils.lerp(corners[side][1], corners[end][1], u);
        const ridgeZ = THREE.MathUtils.lerp(ridge[side][1], ridge[end][1], u);
        const corner = Math.abs(u * 2 - 1) ** 7 * (1 - t) ** 3;
        const seam = col % 2 ? .04 : -.018;
        positions.push(edgeX * (1 - t), 6.28 + 3.03 * t ** 1.43 + corner * .56 + seam,
          THREE.MathUtils.lerp(edgeZ, ridgeZ, t));
        tile.setHSL(.12 + (col % 7) * .004, .11 + (col % 3) * .022, .166 + (col % 5) * .017);
        colors.push(tile.r, tile.g, tile.b);
        if (row < rows && col < strips) {
          const a = start + row * (strips + 1) + col;
          const b = a + strips + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

function makePavilion(materials, side) {
  const pavilion = new THREE.Group();
  const { stone, mortar, timber, beam, ridge } = materials;
  // Stone platforms, timber posts, and upturned eaves are documented;
  // the joinery and coursing below give a readable schematic at this scale.
  box(pavilion, mortar, 0, -11.48, 0, 12.2, 23, 10.4);
  for (let row = 0; row < 17; row++) {
    const y = -.65 - row * 1.1;
    for (let col = 0; col < 6; col++) {
      const z = (col - 2.5) * 1.67 + (row % 2 ? .14 : -.14);
      box(pavilion, stone[(row + col) % stone.length], -side * 6.13, y, z, .27, 1.01, 1.57);
    }
    for (const z of [-5.23, 5.23]) {
      for (let col = 0; col < 6; col++) {
        box(pavilion, stone[(row + col + 1) % stone.length], (col - 2.5) * 2.0, y, z, 1.89, 1.01, .25);
      }
    }
  }
  box(pavilion, stone[0], side * 5.8, -1.65, 0, 7.3, 2.7, 7.6);
  box(pavilion, stone[1], side * 8.6, -2.86, 0, 5.1, 1.7, 5.9);
  box(pavilion, stone[1], 0, .09, 0, 12.5, .24, 10.8);
  for (const x of [-4.1, 4.1]) {
    for (const z of [-3.35, -1.88, 1.88, 3.35]) {
      box(pavilion, stone[0], x, .22, z, .92, .40, .92);
      box(pavilion, timber, x, 2.85, z, .53, 5.0, .55);
      box(pavilion, beam, x, 5.1, z, 1.03, .34, .9);
    }
  }
  for (const x of [-4.35, 4.35]) box(pavilion, beam, x, 5.53, 0, .67, .66, 8.9);
  for (const z of [-3.68, 3.68]) {
    box(pavilion, timber, 0, 5.92, z, 10.12, .63, .61);
    box(pavilion, timber, 0, 2.3, z, 7.8, .33, .33);
    for (let col = 0; col < 10; col++) box(pavilion, beam, (col - 4.5) * .74, 1.25, z, .17, 1.95, .19);
  }
  pavilion.add(tiledRoof());
  box(pavilion, ridge, 0, 9.42, 0, .36, .28, 6.65);
  for (const z of [-3.32, 3.32]) box(pavilion, ridge, 0, 9.61, z, .4, .65, .45);
  pavilion.position.x = side * (span / 2 + 5.6);
  return pavilion;
}

function linkedIron(material) {
  const sections = 228;
  const geometry = new THREE.TorusGeometry(1, .2, 5, 9);
  const mesh = new THREE.InstancedMesh(geometry, material, railPositions.length * sections);
  const link = new THREE.Object3D();
  let instance = 0;
  for (const [z, height] of railPositions) {
    for (let i = 0; i < sections; i++) {
      const t = (i + .5) / sections;
      link.position.set(span * (t - .5), sag(t) + height, z);
      link.scale.set(.278, .114, .115);
      link.rotation.set(i % 2 ? Math.PI / 2 : 0, 0, 0);
      link.updateMatrix();
      mesh.setMatrixAt(instance++, link.matrix);
    }
  }
  return mesh;
}

export function makeLudingBridge() {
  const bridge = new THREE.Group();
  bridge.scale.setScalar(.001155);
  bridge.rotation.y = -.04;
  const modern = new THREE.Group();
  const historical = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: '#625849', roughness: .51, metalness: .32 });
  const outline = new THREE.MeshLambertMaterial({ color: '#9a8268' });
  const oak = ['#76533a', '#967452', '#846145'].map(color => new THREE.MeshLambertMaterial({ color }));
  const stone = ['#817769', '#a59781', '#958778'].map(color => new THREE.MeshLambertMaterial({ color }));
  const materials = {
    stone,
    mortar: new THREE.MeshLambertMaterial({ color: '#534c41' }),
    timber: new THREE.MeshLambertMaterial({ color: '#542d22' }),
    beam: new THREE.MeshLambertMaterial({ color: '#744432' }),
    ridge: new THREE.MeshLambertMaterial({ color: '#302b26' })
  };
  for (const [z, height] of railPositions) {
    const points = Array.from({ length: 33 }, (_, i) => {
      const t = i / 32;
      return new THREE.Vector3(span * (t - .5), sag(t) + height, z);
    });
    bridge.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, .071, 6), outline));
  }
  for (const side of [-1, 1]) {
    historical.add(makePavilion(materials, side));
    box(modern, stone[1], side * span / 2, -2.5, 0, 6, 5, 6);
  }
  const boards = 172;
  const board = new THREE.BoxGeometry(span / boards * .965, .12, width);
  for (let i = 0; i < boards; i++) {
    const t = (i + .5) / boards;
    const plank = new THREE.Mesh(board, oak[i % oak.length]);
    plank.position.set(span * (t - .5), sag(t) + .10, 0);
    modern.add(plank);
    // A few boards by the east end illustrate the break in the deck.
    if (t > .92) historical.add(plank.clone());
  }
  historical.add(linkedIron(iron));
  historical.visible = false;
  bridge.add(modern, historical);
  bridge.userData = { modern, historical };
  return bridge;
}
