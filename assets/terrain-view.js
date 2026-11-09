import * as THREE from './vendor/three.module.min.js';
import { clamp, geographic, mercator, mix, sampleGrid, smooth } from './geo.js';
import { terrainVertex, terrainFragment, cloudVertex, cloudFragment } from './terrain-shaders.js';
import { makeLudingBridge } from './bridge.js';
import { fitAtlas, imageryZoomLimit, keepGroundInView } from './atlas-camera.js';
import { canopyCoverage, makeForest } from './forest.js';
import { loadGroundFeatures } from './ground-features.js';
import { makeJourneyRoute } from './journey-route.js';

const root = new URL('./terrain/', import.meta.url);
const materialsRoot = new URL('./materials/', import.meta.url);
const noMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 720px)');
const lerpKeys = ['x', 'z', 'pitch', 'bearing'];
const mercatorWidth = mercator([0, 360])[0];
const sunDirection = new THREE.Vector3(-.78, .49, -.39).normalize();
const eye = new THREE.Vector3();
const projected = new THREE.Vector3();

async function readGrid(name) {
  const img = new Image();
  img.src = new URL(name + '.png', root).href;
  await img.decode();
  const { naturalWidth: width, naturalHeight: height } = img;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(img, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) {
    values[i] = Math.max(0, pixels[i * 4] * 256 + pixels[i * 4 + 1] - 512);
  }
  return { width, height, values };
}

async function readCover(name) {
  const image = new Image();
  image.src = new URL(name + '-forest.png', root).href;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

function groundIn(patch, x, z) {
  const [left, top, right, bottom] = patch.bounds;
  return sampleGrid(patch.grid, (x - left) / (right - left), (z - top) / (bottom - top));
}

function surfaceHeight(patch, x, z) {
  const [left, top, right, bottom] = patch.bounds;
  const { columns, rows, vertices } = patch.surface;
  const column = clamp((x - left) / (right - left), 0, 1) * columns;
  const row = clamp((z - top) / (bottom - top), 0, 1) * rows;
  const i = Math.min(Math.floor(column), columns - 1);
  const j = Math.min(Math.floor(row), rows - 1);
  const u = column - i;
  const v = row - j;
  const a = j * (columns + 1) + i;
  const b = a + columns + 1;
  const topLeft = vertices.getY(a);
  const topRight = vertices.getY(a + 1);
  const bottomLeft = vertices.getY(b);
  const bottomRight = vertices.getY(b + 1);
  // PlaneGeometry splits each cell along the top-right to bottom-left diagonal.
  return u + v <= 1 ?
    topLeft + u * (topRight - topLeft) + v * (bottomLeft - topLeft) :
    bottomRight + (1 - u) * (bottomLeft - bottomRight) + (1 - v) * (topRight - bottomRight);
}

function contains(patch, x, z) {
  if (!patch) return false;
  const [left, top, right, bottom] = patch.bounds;
  return x >= left && x <= right && z >= top && z <= bottom;
}

function edgeWeight(bounds, x, z) {
  const [left, top, right, bottom] = bounds;
  const u = (x - left) / (right - left);
  const v = (z - top) / (bottom - top);
  return smooth(clamp(Math.min(u, v, 1 - u, 1 - v) / .085, 0, 1));
}

function cutInto(parent, child) {
  const uniforms = parent.mesh.material.uniforms;
  uniforms.hasCut.value = child ? 1 : 0;
  if (child) {
    const [left, top, right, bottom] = child.bounds;
    const inset = Math.min(right - left, bottom - top) * .009;
    uniforms.cut.value.set(left + inset, top + inset, right - inset, bottom - inset);
  }
}

function skirtFor(surface, columns, rows) {
  const { position, normal, uv, relief } = surface.attributes;
  const positions = [];
  const normals = [];
  const uvs = [];
  const light = [];
  const stride = columns + 1;
  function addSegment(a, b) {
    for (const [index, down] of [[a, 0], [a, .22], [b, 0], [b, 0], [a, .22], [b, .22]]) {
      positions.push(position.getX(index), position.getY(index) - down, position.getZ(index));
      normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      uvs.push(uv.getX(index), uv.getY(index));
      light.push(relief.getX(index), relief.getY(index));
    }
  }
  for (let x = 0; x < columns; x++) {
    addSegment(x, x + 1);
    addSegment(rows * stride + x, rows * stride + x + 1);
  }
  for (let y = 0; y < rows; y++) {
    addSegment(y * stride, (y + 1) * stride);
    addSegment(y * stride + columns, (y + 1) * stride + columns);
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  skirt.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  skirt.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  skirt.setAttribute('relief', new THREE.Float32BufferAttribute(light, 2));
  return skirt;
}

function reliefLighting(patch) {
  const { columns, rows, vertices } = patch.surface;
  const [west, north, east, south] = patch.bounds;
  const cell = Math.min((east - west) / columns, (south - north) / rows);
  const horizontal = Math.hypot(sunDirection.x, sunDirection.z);
  const bearingX = sunDirection.x / horizontal;
  const bearingZ = sunDirection.z / horizontal;
  const slope = sunDirection.y / horizontal;
  const samples = [1.5, 3.5, 7, 14, 28, 53].map(scale => scale * cell);
  const lighting = new Float32Array(vertices.count * 2);
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i);
    const y = vertices.getY(i);
    const z = vertices.getZ(i);
    let shadow = 0;
    for (const step of samples) {
      const nx = x + bearingX * step;
      const nz = z + bearingZ * step;
      if (!contains(patch, nx, nz)) break;
      const altitude = surfaceHeight(patch, nx, nz) - y;
      shadow = Math.max(shadow, smooth(clamp((altitude - step * slope) / (step * .23 + .012), 0, 1)));
    }
    const surround = (
      surfaceHeight(patch, x - cell * 3, z) + surfaceHeight(patch, x + cell * 3, z) +
      surfaceHeight(patch, x, z - cell * 3) + surfaceHeight(patch, x, z + cell * 3)
    ) / 4;
    lighting[i * 2] = 1 - shadow;
    lighting[i * 2 + 1] = 1 - clamp((surround - y) / (cell * 1.1 + .018), 0, .58);
  }
  return new THREE.BufferAttribute(lighting, 2);
}

export class TerrainView {
  constructor(container, onFrame) {
    this.container = container;
    this.onFrame = onFrame;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor('#242e2a');
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, compact.matches ? 1.2 : 1.55));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#e9eddd', '#626f4e', 1.45));
    const sun = new THREE.DirectionalLight('#ffe4c0', 1.5);
    sun.position.copy(sunDirection);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(43, 1, .012, 9500);
    this.clock = new THREE.Clock();
    this.textureLoader = new THREE.TextureLoader();
    this.patches = new Map();
    this.patchUse = 0;
    this.loading = new Map();
    this.beacon = this.makeBeacon();
    this.bridge = makeLudingBridge();
    this.scene.add(this.beacon, this.bridge);
    this.clouds = [];
    this.focus = 'luding';
    this.mode = 'home';
    this.historyAmount = 0;
    this.size = { width: 0, height: 0 };
    this.pointers = new Map();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.bindInput();
  }

  async start(route) {
    const textures = this.loadSurfaceMaterials();
    const manifestResponse = await fetch(new URL('manifest.json', root));
    if (!manifestResponse.ok) throw new Error('Terrain manifest unavailable');
    this.data = await manifestResponse.json();
    this.origin = mercator(this.data.origin);
    this.points = Object.fromEntries(
      Object.entries(this.data.stations).map(([id, geo]) => [id, this.world(geo)])
    );
    this.surfaceMaterials = await textures;
    this.atlasMask = this.makeAtlasMask(route);
    this.base = await this.loadPatch('route');
    this.base.mesh.visible = true;
    this.region = await this.loadPatch('corridor');
    this.region.mesh.visible = true;
    cutInto(this.base, this.region);
    const [luding, near] = await Promise.all([
      this.loadPatch('luding'),
      this.loadPatch('luding-near')
    ]);
    this.applyLocal(luding, near);
    const bridge = this.points.luding;
    const bankHeight = Math.max(this.height(bridge.x - .0587, bridge.z), this.height(bridge.x + .0587, bridge.z));
    this.bridge.position.set(bridge.x, bankHeight + .0035, bridge.z);
    this.routeInk = makeJourneyRoute(route, this.points, (x, z) => this.height(x, z));
    this.scene.add(this.routeInk);
    this.view = this.openingView();
    this.goal = { ...this.view };
    this.setClouds(luding, 'luding');
    this.draw(0);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  world(geo) {
    const [x, z] = mercator(geo);
    return { x: x - this.origin[0], z: z - this.origin[1] };
  }

  async loadSurfaceMaterials() {
    const files = ['rock-color', 'rock-normal', 'moss-color', 'moss-normal'];
    try {
      return await Promise.all(files.map(async (name, index) => {
        const texture = await this.textureLoader.loadAsync(new URL(name + '.jpg', materialsRoot).href);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = index % 2 ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        return texture;
      }));
    } catch (error) {
      console.warn('地表材质未加载', error.message);
      return null;
    }
  }

  localBounds(bounds) {
    return bounds.map((value, i) => value - this.origin[i % 2]);
  }

  makeAtlasMask(route) {
    const points = Object.values(this.points);
    const bounds = this.localBounds(this.data.regions.corridor.bounds);
    const [west, north, east, south] = bounds;
    const segments = route.slice(1).map((id, index) => [this.points[route[index]], this.points[id]]);
    const size = 224;
    const values = new Uint8Array(size * size);
    for (let j = 0; j < size; j++) {
      const z = mix(north, south, (j + .5) / size);
      for (let i = 0; i < size; i++) {
        const x = mix(west, east, (i + .5) / size);
        let min = Infinity;
        for (const point of points) min = Math.min(min, (x - point.x) ** 2 + (z - point.z) ** 2);
        for (const [from, to] of segments) {
          const dx = to.x - from.x;
          const dz = to.z - from.z;
          const t = clamp(((x - from.x) * dx + (z - from.z) * dz) / (dx * dx + dz * dz), 0, 1);
          min = Math.min(min, (x - mix(from.x, to.x, t)) ** 2 + (z - mix(from.z, to.z, t)) ** 2);
        }
        values[j * size + i] = Math.round((1 - smooth(clamp((Math.sqrt(min) - 115) / 390, 0, 1))) * 255);
      }
    }
    const texture = new THREE.DataTexture(values, size, size, THREE.RedFormat);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return { texture, bounds: new THREE.Vector4().fromArray(bounds) };
  }

  async loadPatch(name) {
    if (this.patches.has(name)) {
      const patch = this.patches.get(name);
      patch.used = ++this.patchUse;
      return patch;
    }
    if (this.loading.has(name)) return this.loading.get(name);
    const promise = this.buildPatch(name);
    this.loading.set(name, promise);
    try {
      const patch = await promise;
      patch.used = ++this.patchUse;
      this.patches.set(name, patch);
      return patch;
    } finally {
      this.loading.delete(name);
    }
  }

  async buildPatch(name) {
    const data = this.data.regions[name];
    if (!data) throw new Error('Unknown terrain region ' + name);
    const image = compact.matches && data.mobileTexture ? data.mobileTexture : name + '.webp';
    const [grid, photo, cover] = await Promise.all([
      readGrid(name), this.textureLoader.loadAsync(new URL(image, root).href),
      data.forest ? readCover(name) : null
    ]);
    if (name === 'corridor') {
      const maximum = Math.min(this.renderer.capabilities.maxTextureSize, compact.matches ? 4096 : 6144);
      if (photo.image.width > maximum) {
        const resized = document.createElement('canvas');
        resized.width = maximum;
        resized.height = Math.round(maximum * photo.image.height / photo.image.width);
        const context = resized.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(photo.image, 0, 0, resized.width, resized.height);
        photo.image = resized;
        photo.needsUpdate = true;
      }
    }
    photo.colorSpace = THREE.SRGBColorSpace;
    photo.anisotropy = Math.min(name.endsWith('-near') ? 16 : 8, this.renderer.capabilities.getMaxAnisotropy());
    const bounds = this.localBounds(data.bounds);
    const [left, top, right, bottom] = bounds;
    const patch = { name, grid, photo, bounds, range: data.range };
    const near = name.endsWith('-near');
    const canopy = near ? canopyCoverage(photo.image, cover) : null;
    patch.canopy = canopy?.texture;
    const rasterSpacing = Math.max((right - left) / photo.image.width, (bottom - top) / photo.image.height);
    const nativeSpacing = near ? .010 * Math.cosh((data.bounds[1] + data.bounds[3]) / 12756.274) :
      mercatorWidth / (256 * 2 ** (data.photoZoom || data.zoom));
    patch.texelKm = Math.max(rasterSpacing, nativeSpacing);
    const parent = name.endsWith('-near') ?
      await this.loadPatch(name.slice(0, -5)) : this.region || this.base;
    patch.parent = parent;
    const density = name === 'corridor' ? (compact.matches ? .39 : .60) :
      name === 'route' ? .51 : compact.matches ? (near ? .76 : .61) : 1;
    const columns = Math.round((grid.width - 1) * density);
    const rows = Math.round((grid.height - 1) * density);
    const geometry = new THREE.PlaneGeometry(
      right - left, bottom - top, columns, rows
    );
    geometry.rotateX(-Math.PI / 2);
    geometry.translate((left + right) / 2, 0, (top + bottom) / 2);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      position.setY(i, this.patchElevation(patch, position.getX(i), position.getZ(i)));
    }
    patch.surface = { columns, rows, vertices: position };
    geometry.computeVertexNormals();
    geometry.setAttribute('relief', reliefLighting(patch));
    geometry.computeBoundingSphere();
    const material = new THREE.ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      polygonOffset: Boolean(parent),
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -5,
      uniforms: {
        photo: { value: photo }, parentPhoto: { value: parent?.photo || photo },
        parentBounds: { value: new THREE.Vector4().fromArray(parent?.bounds || bounds) },
        hasParent: { value: parent ? 1 : 0 }, hasCut: { value: 0 }, cut: { value: new THREE.Vector4() },
        haze: { value: .025 }, exposure: { value: name === 'huahu' ? 1.26 : 1 },
        atlas: { value: 0 }, atlasMask: { value: this.atlasMask.texture }, atlasBounds: { value: this.atlasMask.bounds },
        detail: { value: parent && name !== 'corridor' ? 1 : 0 }, time: { value: 0 },
        sunDirection: { value: sunDirection },
        forestCover: { value: patch.canopy || photo }, hasForestCover: { value: patch.canopy ? 1 : 0 },
        texturedSurface: { value: this.surfaceMaterials && name.endsWith('-near') ? 1 : 0 },
        rockColor: { value: this.surfaceMaterials?.[0] || photo }, rockNormal: { value: this.surfaceMaterials?.[1] || photo },
        mossColor: { value: this.surfaceMaterials?.[2] || photo }, mossNormal: { value: this.surfaceMaterials?.[3] || photo },
        history: { value: 0 }, bridgeCenter: { value: new THREE.Vector2(this.points.luding.x, this.points.luding.z) }
      }
    });
    patch.mesh = new THREE.Mesh(geometry, material);
    if (parent) {
      const borderMaterial = material.clone();
      borderMaterial.uniforms = material.uniforms;
      borderMaterial.side = THREE.DoubleSide;
      patch.mesh.add(new THREE.Mesh(skirtFor(geometry, columns, rows), borderMaterial));
    }
    patch.forest = makeForest(patch, (x, z) => surfaceHeight(patch, x, z), compact.matches, canopy);
    if (patch.forest) {
      patch.forest.visible = false;
      patch.forest.material.uniforms.bridgeCenter.value.copy(material.uniforms.bridgeCenter.value);
      patch.mesh.add(patch.forest);
    }
    patch.mesh.visible = false;
    this.scene.add(patch.mesh);
    if (name.endsWith('-near')) {
      loadGroundFeatures(name.slice(0, -5), this.origin, (x, z) => surfaceHeight(patch, x, z), data.buildings).then(features => {
        if (patch.disposed) {
          this.disposeMesh(features);
          return;
        }
        features.visible = false;
        patch.features = features;
        patch.mesh.add(features);
      }).catch(error => console.warn('近景地物未加载', error.message));
    }
    return patch;
  }

  disposeMesh(group) {
    group.traverse(object => {
      object.geometry?.dispose();
      object.material?.dispose();
      if (object.isInstancedMesh) object.dispose();
    });
  }

  trimSceneCache() {
    const permanent = new Set(['route', 'corridor', 'luding', 'luding-near']);
    const groups = [...this.patches.values()].filter(patch => !patch.name.endsWith('-near') && !permanent.has(patch.name));
    const unused = groups.filter(patch => patch !== this.local && !this.loading.has(patch.name + '-near'))
      .sort((a, b) => a.used - b.used);
    let remaining = groups.length;
    for (const patch of unused) {
      if (remaining <= 4) break;
      for (const key of [patch.name + '-near', patch.name]) {
        const retired = this.patches.get(key);
        if (!retired) continue;
        retired.disposed = true;
        this.scene.remove(retired.mesh);
        this.disposeMesh(retired.mesh);
        retired.photo.dispose();
        retired.canopy?.dispose();
        this.patches.delete(key);
      }
      remaining--;
    }
  }

  patchElevation(patch, x, z) {
    const actual = groundIn(patch, x, z) * .001 * Math.cosh((z + this.origin[1]) / 6378.137);
    if (!patch.parent) return actual;
    const weight = edgeWeight(patch.bounds, x, z);
    return mix(surfaceHeight(patch.parent, x, z) + .003, actual, weight);
  }

  height(x, z) {
    const patch = [this.near, this.local, this.region].find(area => contains(area, x, z)) || this.base;
    return surfaceHeight(patch, x, z);
  }

  applyLocal(patch, near = null) {
    this.applyNear(null);
    if (this.local) {
      this.local.mesh.visible = false;
      cutInto(this.local, null);
    }
    this.local = patch;
    cutInto(this.region, patch);
    if (!patch) return;
    patch.mesh.visible = true;
    this.applyNear(near);
  }

  applyNear(near) {
    if (this.near) this.near.mesh.visible = false;
    this.near = near;
    if (this.local) cutInto(this.local, near);
    if (near) near.mesh.visible = true;
    if (near) this.trimSceneCache();
  }

  openingView() {
    const point = this.points.luding;
    return { ...point, x: point.x - .75, z: point.z - 1.65, distance: compact.matches ? 10.5 : 13.6, pitch: .61, bearing: .19 };
  }

  overviewView() {
    const portrait = this.camera.aspect < .83;
    return keepGroundInView(
      fitAtlas(Object.values(this.points), this.camera.aspect, this.camera.fov, portrait, this.size.height),
      this.base.bounds, this.camera.aspect, this.camera.fov
    );
  }

  stationView(id, feature) {
    const point = feature.center ? this.world(feature.center) : this.points[id];
    const detail = this.data.regions[(feature.region || id) + '-near'];
    const preset = feature.label || feature.context;
    const distance = detail && !preset ? clamp(feature.distance * .65, 3.8, 8.2) : feature.distance;
    return {
      ...point,
      distance: distance * (compact.matches ? feature.mobileScale || 1.12 : 1),
      pitch: preset ? feature.pitch : Math.min(.75, feature.pitch), bearing: feature.bearing
    };
  }

  async goTo(mode, id, feature, immediate = false) {
    const destination = mode === 'home' ? this.openingView() :
      mode === 'overview' ? this.overviewView() : this.stationView(id, feature);
    const token = this.flightToken = Symbol();
    this.browseRegion = null;
    this.flight = null;
    this.goal = { ...this.view };
    const changedMode = this.mode !== mode;
    this.mode = mode;
    if (changedMode) this.updateResolution();
    this.hasExplored = false;
    this.historical = Boolean(feature?.history);
    this.focus = id || (mode === 'home' ? 'luding' : null);
    const patchName = feature?.region || this.focus;
    this.waitingForTerrain = Boolean(patchName);
    let patch = null;
    let near = null;
    if (patchName) {
      [patch, near] = await Promise.all([
        this.loadPatch(patchName).catch(error => {
          console.warn('无法加载局部地形', patchName, error.message);
          return null;
        }),
        this.loadNear(patchName)
      ]);
    }
    if (this.flightToken !== token) return null;
    this.waitingForTerrain = false;
    this.modelZoom = patch && near ? feature?.modelZoom : null;
    this.modelCenter = this.modelZoom ? { x: destination.x, z: destination.z } : null;
    if (mode === 'station' && !this.modelZoom) {
      const quality = this.textureZoom(near || patch || this.region);
      const entry = feature.label || feature.context ? 1 : 1.44;
      destination.distance = Math.max(destination.distance, quality * entry);
    }
    const finishRegion = () => {
      if (this.flightToken !== token) return;
      this.applyLocal(patch, near);
      this.setClouds(patch, patchName);
    };
    if (noMotion.matches || immediate) {
      this.view = { ...destination };
      this.goal = { ...destination };
      finishRegion();
      return patch;
    }
    const distance = Math.hypot(this.view.x - destination.x, this.view.z - destination.z);
    const duration = mode === 'overview' ? 2.25 : clamp(1.35 + distance / 1700, 1.35, 2.55);
    this.flight = {
      from: { ...this.view }, to: destination, length: distance, duration,
      start: this.clock.getElapsedTime(), onPass: finishRegion, distanceTravelled: 0
    };
    return patch;
  }

  updateFlight(time, dt) {
    if (!this.flight) {
      const ease = noMotion.matches ? 1 : 1 - Math.exp(-dt * 11);
      for (const key of [...lerpKeys, 'distance']) this.view[key] = mix(this.view[key], this.goal[key], ease);
      return;
    }
    const { from, to, duration, length, onPass } = this.flight;
    const progress = clamp((time - this.flight.start) / duration, 0, 1);
    const t = smooth(progress);
    const lifting = to.distance > from.distance * 5;
    const landing = from.distance > to.distance * 5;
    const movement = lifting ? smooth(clamp((progress - .16) / .84, 0, 1)) :
      landing ? smooth(clamp(progress / .81, 0, 1)) : t;
    const altitude = lifting ? 1 - (1 - t) ** 1.55 : landing ? t ** 1.55 : t;
    const arc = Math.sin(t * Math.PI);
    const rise = Math.max(0, length * .95 - Math.max(from.distance, to.distance));
    for (const key of lerpKeys) this.view[key] = mix(from[key], to[key], movement);
    this.view.distance = Math.exp(mix(Math.log(from.distance), Math.log(to.distance), altitude)) + rise * arc ** 2;
    this.view.pitch = mix(this.view.pitch, 1.29, clamp(rise / 130, 0, 1) * arc);
    if (this.flight.distanceTravelled < .55 && t >= .55) onPass();
    this.flight.distanceTravelled = t;
    if (progress === 1) {
      this.view = { ...to };
      this.goal = { ...to };
      this.flight = null;
    }
  }

  makeBeacon() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.76, 1, 64),
      new THREE.MeshBasicMaterial({ color: '#ffac84', side: THREE.DoubleSide, transparent: true, opacity: .85 })
    );
    ring.rotation.x = -Math.PI / 2;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(.3, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#ffc59c' })
    );
    group.add(ring, dot);
    return group;
  }

  setClouds(patch, id) {
    for (const cloud of this.clouds) {
      this.scene.remove(cloud);
      cloud.geometry.dispose();
      cloud.material.dispose();
    }
    this.clouds = [];
    if (!patch) return;
    const [left, top, right, bottom] = patch.bounds;
    const offsets = id === 'luding' ?
      [[-.23, -.16, 1.3, .41], [.20, -.22, 1.92, .47], [.28, .18, 1.0, .34], [-.22, .22, 1.22, .25], [.08, -.34, 2.1, .38]] :
      [[-.24, -.24, 1.12, .24], [.23, -.17, 1.4, .29], [.15, .26, .98, .21]];
    offsets.forEach(([dx, dz, height, density], i) => {
      const x = (left + right) / 2 + dx * (right - left);
      const z = (top + bottom) / 2 + dz * (bottom - top);
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(10 + i % 3 * 2.5, 6 + i % 2 * 2.5), new THREE.ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        uniforms: { time: { value: 0 }, seed: { value: i * 6.173 + 13 }, density: { value: density } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide
      }));
      cloud.rotation.x = -Math.PI / 2;
      cloud.rotation.z = i * .72;
      cloud.position.set(x, this.height(x, z) + height, z);
      cloud.userData.startX = x;
      this.clouds.push(cloud);
      this.scene.add(cloud);
    });
  }

  updateResolution() {
    const { width, height } = this.size;
    if (!width || !height) return;
    const pixelBudget = Math.sqrt(6_400_000 / (width * height));
    this.displayRatio = Math.min(devicePixelRatio, compact.matches ? 1.6 : 2, pixelBudget);
    const antialias = compact.matches ? 1.22 : this.mode === 'overview' ? 1.44 : 1.28;
    this.renderer.setPixelRatio(Math.min(Math.max(this.displayRatio, antialias), pixelBudget));
    this.renderer.setSize(width, height);
  }

  resize() {
    this.size = { width: this.container.clientWidth, height: this.container.clientHeight };
    const { width, height } = this.size;
    if (!width || !height) return;
    this.updateResolution();
    this.camera.aspect = width / height;
    this.camera.fov = compact.matches ? 50 : 43;
    this.camera.updateProjectionMatrix();
    if (this.view && this.mode === 'overview' && !this.hasExplored) {
      const frame = this.overviewView();
      if (this.flight) this.flight.to = frame;
      else this.view = this.goal = frame;
    } else if (this.view && this.mode !== 'home' && !this.flight && !this.waitingForTerrain) {
      this.goal.distance = Math.max(this.goal.distance, this.zoomMinimum());
    }
  }

  frame() {
    if (document.hidden) return;
    const time = this.clock.getElapsedTime();
    const dt = this.lastFrame === undefined ? .033 : Math.min(.1, time - this.lastFrame);
    if (compact.matches && dt < .027) return;
    this.lastFrame = time;
    this.updateFlight(time, dt);
    this.draw(time, dt);
  }

  draw(time, dt = .033) {
    if (this.mode !== 'home') {
      this.view = keepGroundInView(this.view, this.base.bounds, this.camera.aspect, this.camera.fov);
    }
    const { x, z, pitch, bearing, distance } = this.view;
    const calm = noMotion.matches ? 0 : time;
    const orbit = this.mode === 'home' && !this.flight ? .105 * Math.sin(calm * .21) : 0;
    const radial = Math.cos(pitch) * distance;
    const y = this.height(x, z);
    const cx = x + Math.sin(bearing + orbit) * radial;
    const cz = z + Math.cos(bearing + orbit) * radial;
    const cy = Math.max(y + Math.sin(pitch) * distance, this.height(cx, cz) + Math.max(.09, distance * .013));
    this.camera.near = Math.max(.012, distance / 950);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(x, y + .014, z);
    this.camera.updateMatrixWorld();
    const clarity = 1 - .34 * smooth(clamp((distance - 50) / 200, 0, 1)) *
      (1 - smooth(clamp((distance - 540) / 1050, 0, 1)));
    const haze = clamp(.0125 / Math.max(1, distance / 24), .000023, .0125) * clarity *
      (this.mode === 'overview' ? .77 : 1);
    const atlas = smooth(clamp((distance - 170) / 770, 0, 1));
    const history = this.historical ? 1 - smooth(clamp((distance - .65) / 2.6, 0, 1)) : 0;
    this.historyAmount = mix(this.historyAmount, history, noMotion.matches ? 1 : 1 - Math.exp(-dt * 7));
    for (const patch of [this.base, this.region, this.local, this.near]) {
      if (!patch) continue;
      patch.mesh.material.uniforms.haze.value = haze;
      patch.mesh.material.uniforms.atlas.value = atlas;
      patch.mesh.material.uniforms.time.value = calm;
      patch.mesh.material.uniforms.history.value = this.historyAmount;
      if (patch.forest) {
        patch.forest.visible = distance < 26;
        patch.forest.material.uniforms.history.value = this.historyAmount;
      }
      if (patch.features) {
        patch.features.visible = !this.historical && distance < 9;
        patch.features.userData.time.value = calm;
      }
    }
    for (const cloud of this.clouds) {
      cloud.material.uniforms.time.value = calm;
      cloud.position.x = cloud.userData.startX + Math.sin(calm * .11) * 1.4;
      cloud.visible = distance < 110;
    }
    this.routeInk.visible = this.mode !== 'home' && distance > 55;
    if (this.routeInk.visible) {
      const uniforms = this.routeInk.material.uniforms;
      uniforms.viewport.value.set(this.size.width, this.size.height);
      uniforms.reached.value = this.routeInk.userData.orders.get(this.focus) ?? -1;
    }
    this.bridge.visible = this.local?.name === 'luding' && distance < 3.0;
    this.bridge.userData.historical.visible = this.historyAmount > .48;
    this.bridge.userData.modern.visible = !this.bridge.userData.historical.visible;
    this.beacon.visible = this.mode === 'station' && Boolean(this.focus) && distance < 105 && !this.bridge.visible;
    if (this.beacon.visible) {
      const point = this.points[this.focus];
      const radius = Math.max(.006, distance * .009) * (1 + Math.sin(calm * 1.7) * .10);
      this.beacon.position.set(point.x, this.height(point.x, point.z) + .032, point.z);
      this.beacon.scale.setScalar(radius);
    }
    this.renderer.render(this.scene, this.camera);
    this.onFrame(this);
  }

  screen(id) {
    const point = this.points[id];
    const altitude = this.routeInk.visible ? this.height(point.x, point.z) + 5.5 : undefined;
    return this.screenPoint(point, altitude);
  }

  screenPoint({ x, z }, y = this.height(x, z) + Math.max(.007, Math.min(.1, this.view.distance * .016), this.view.distance * .0045)) {
    eye.set(x, y, z).applyMatrix4(this.camera.matrixWorldInverse);
    if (eye.z >= -.02) return null;
    projected.set(x, y, z).project(this.camera);
    if (Math.abs(projected.x) > 1.02 || Math.abs(projected.y) > 1.02) return null;
    return {
      x: (projected.x + 1) * this.size.width / 2,
      y: (1 - projected.y) * this.size.height / 2
    };
  }

  center() {
    return geographic(this.view.x + this.origin[0], this.view.z + this.origin[1]);
  }

  stopFlight() {
    if (!this.flight) return;
    this.flight.onPass();
    this.flight = null;
    this.goal = { ...this.view };
  }

  loadNear(name) {
    const key = name + '-near';
    if (!this.data.regions[key]) return Promise.resolve(null);
    return this.loadPatch(key).catch(error => {
      console.warn('无法加载精细地形', key, error.message);
      return null;
    });
  }

  textureZoom(patch) {
    const budget = patch === this.region ? 2.12 : 2.45;
    return imageryZoomLimit(patch.texelKm, this.size.height * this.displayRatio, this.camera.fov, budget);
  }

  zoomMinimum() {
    const { x, z } = this.goal;
    if (this.modelZoom && contains(this.near, x, z)) return this.modelZoom;
    const surface = [this.near, this.local].find(patch => contains(patch, x, z)) || this.region;
    return this.textureZoom(surface);
  }

  atZoomLimit() {
    if (!this.goal || this.flight || this.waitingForTerrain) return false;
    const limit = this.zoomMinimum();
    return this.goal.distance <= limit * 1.001 && this.view.distance <= limit * 1.025;
  }

  browseLocalTerrain() {
    if (this.mode !== 'overview' || this.goal.distance > this.textureZoom(this.region) * 1.23) return;
    const { x, z } = this.goal;
    let closest;
    let distance = 26;
    for (const [id, point] of Object.entries(this.points)) {
      const gap = Math.hypot(x - point.x, z - point.z);
      if (gap < distance) {
        closest = id;
        distance = gap;
      }
    }
    if (!closest || this.browseRegion === closest) return;
    this.browseRegion = closest;
    const token = this.flightToken;
    Promise.all([this.loadPatch(closest), this.loadNear(closest)]).then(([patch, near]) => {
      if (this.flightToken !== token || this.browseRegion !== closest) return;
      this.applyLocal(patch, near);
      this.setClouds(patch, closest);
    }).catch(() => {
      if (this.browseRegion === closest) this.browseRegion = null;
    });
  }

  zoom(factor, pointer) {
    if (!this.goal || this.mode === 'home' || this.waitingForTerrain) return;
    this.stopFlight();
    this.hasExplored = true;
    const previousDistance = this.goal.distance;
    const limit = this.zoomMinimum();
    const nextDistance = clamp(previousDistance * factor, limit, this.overviewView().distance * 1.16);
    if (Math.abs(nextDistance - previousDistance) < previousDistance * .0001) {
      this.browseLocalTerrain();
      return;
    }
    if (pointer && this.mode === 'overview' && nextDistance < previousDistance && previousDistance > 35) {
      const cursor = new THREE.Vector3(pointer.x, pointer.y, .3).unproject(this.camera).sub(this.camera.position);
      const travel = (this.height(this.goal.x, this.goal.z) - this.camera.position.y) / cursor.y;
      if (travel > 0 && travel * cursor.length() < this.view.distance * 2.8) {
        const [left, top, right, bottom] = this.region.bounds;
        const approach = 1 - nextDistance / previousDistance;
        this.goal.x = clamp(mix(this.goal.x, this.camera.position.x + cursor.x * travel, approach), left + 45, right - 45);
        this.goal.z = clamp(mix(this.goal.z, this.camera.position.z + cursor.z * travel, approach), top + 45, bottom - 45);
      }
    }
    this.goal.distance = Math.max(nextDistance, this.zoomMinimum());
    if (this.goal.distance > 18) {
      this.goal.pitch = mix(.72, 1.40, clamp(Math.log(this.goal.distance / 12) / 4.5, 0, 1));
    } else if (!this.historical && this.goal.distance < 3.2 && this.goal.distance < previousDistance) {
      const descent = Math.log(previousDistance / this.goal.distance);
      if (this.goal.pitch > .47) this.goal.pitch = Math.max(.47, this.goal.pitch - descent * .064);
    }
    this.goal = keepGroundInView(this.goal, this.base.bounds, this.camera.aspect, this.camera.fov);
    this.browseLocalTerrain();
  }

  orbit(dx, dy) {
    if (!this.goal || this.mode === 'home' || this.waitingForTerrain) return;
    this.stopFlight();
    this.hasExplored = true;
    this.goal.bearing += dx * .005;
    this.goal.pitch = clamp(this.goal.pitch - dy * .004, .26, 1.51);
    this.goal = keepGroundInView(this.goal, this.base.bounds, this.camera.aspect, this.camera.fov);
  }

  pan(dx, dy) {
    if (!this.goal || this.mode === 'home' || this.waitingForTerrain) return;
    this.stopFlight();
    this.hasExplored = true;
    const { bearing, distance } = this.goal;
    const scale = distance / this.size.height * .77;
    const x = this.goal.x + (-dx * Math.cos(bearing) - dy * Math.sin(bearing)) * scale;
    const z = this.goal.z + (dx * Math.sin(bearing) - dy * Math.cos(bearing)) * scale;
    if (this.modelCenter && distance < this.textureZoom(this.near)) {
      const { x: mx, z: mz } = this.modelCenter;
      this.goal.x = clamp(x, mx - .30, mx + .30);
      this.goal.z = clamp(z, mz - .30, mz + .30);
      return;
    }
    const frame = this.near && distance < this.textureZoom(this.local) ? this.near :
      this.local && distance < this.textureZoom(this.region) ? this.local : this.region;
    const inset = frame === this.region ? 45 : frame === this.near ? .85 : 2.7;
    const [left, top, right, bottom] = frame.bounds;
    this.goal.x = clamp(x, left + inset, right - inset);
    this.goal.z = clamp(z, top + inset, bottom - inset);
    this.goal = keepGroundInView(this.goal, this.base.bounds, this.camera.aspect, this.camera.fov);
    this.browseLocalTerrain();
  }

  bindInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.container.addEventListener('wheel', event => {
      if (this.mode === 'home') return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      this.zoom(Math.exp(clamp(event.deltaY * .0014, -.55, .55)), {
        x: (event.clientX - rect.left) / rect.width * 2 - 1,
        y: 1 - (event.clientY - rect.top) / rect.height * 2
      });
    }, { passive: false });
    canvas.addEventListener('pointerdown', event => {
      if (this.mode === 'home' || this.pointers.size === 2) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      this.container.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', event => {
      const old = this.pointers.get(event.pointerId);
      if (!old) return;
      const next = { x: event.clientX, y: event.clientY };
      const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const start = Math.hypot(old.x - other.x, old.y - other.y);
        const end = Math.hypot(next.x - other.x, next.y - other.y);
        if (start > 6 && end > 6) this.zoom(start / end);
      } else if (event.shiftKey || event.buttons === 2) {
        this.orbit(next.x - old.x, next.y - old.y);
      } else {
        this.pan(next.x - old.x, next.y - old.y);
      }
      this.pointers.set(event.pointerId, next);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, event => {
        this.pointers.delete(event.pointerId);
        if (!this.pointers.size) this.container.classList.remove('dragging');
      });
    }
    this.container.addEventListener('keydown', event => {
      if (event.target !== this.container || this.mode === 'home') return;
      const offset = { ArrowLeft: [65, 0], ArrowRight: [-65, 0], ArrowUp: [0, 65], ArrowDown: [0, -65] }[event.key];
      if (offset) {
        event.preventDefault();
        if (event.shiftKey) this.orbit(...offset);
        else this.pan(...offset);
      } else if (['+', '=', '-'].includes(event.key)) {
        event.preventDefault();
        this.zoom(event.key === '-' ? 1.3 : 1 / 1.3);
      }
    });
  }
}
