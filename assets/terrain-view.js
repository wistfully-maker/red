import * as THREE from './vendor/three.module.min.js';
import {ExhibitFilm} from './exhibit-film.js?v=cinema-20261121';
import { clamp, geographic, mercator, mix, smooth } from './geo.js';
import { terrainVertex, terrainFragment, cloudVertex, cloudFragment } from './terrain-shaders.js?v=cinema-20261121';
import { fitAtlas, imageryZoomLimit, keepGroundInView } from './atlas-camera.js?v=cinema-20261121';
import { canopyCoverage, makeAtlasForest, makeForest, updateForest } from './forest.js';
import { loadGroundFeatures } from './ground-features.js?v=first-person-atlas';
import { makeJourneyRoute } from './journey-route.js?v=print-atlas-20261118';
import { journeyWaypoints } from './journey-waypoints.js';
import { AtlasImagery } from './atlas-imagery.js?v=cinema-20261121';
import { AtlasRelief } from './atlas-relief.js';
import { cropAtlasLandCover, loadAtlasLandCover } from './atlas-landcover.js?v=first-person-atlas';
import { loadLudingBridge, loadModel, loadVegetation } from './scene-models.js';
import { KTX2Loader } from './vendor/KTX2Loader.js';
import { makeValleyEnvironment, shadeBridge } from './bridge-materials.js?v=cinema-20261121';
import { loadOverviewMiniatures, updateOverviewMiniatures, overviewMiniatureScreen } from './overview-landmarks.js?v=cinema-20261121';

const root = new URL('./terrain/', import.meta.url);
const materialsRoot = new URL('./materials/', import.meta.url);
const noMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 720px)');
const lerpKeys = ['x', 'z', 'pitch', 'bearing'];
const mercatorWidth = mercator([0, 360])[0];
const sunDirection = new THREE.Vector3(-.78, .49, -.39).normalize();
const eye = new THREE.Vector3();
const projected = new THREE.Vector3();

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

function surfaceHeight(patch, x, z, transition = 1) {
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
  const values = patch.startingHeight;
  const height = index => values && transition < 1 ? mix(values[index], vertices.getY(index), smooth(transition)) : vertices.getY(index);
  const topLeft = height(a);
  const topRight = height(a + 1);
  const bottomLeft = height(b);
  const bottomRight = height(b + 1);
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

function cutInto(parent, child) {
  const uniforms = parent.mesh.material.uniforms;
  uniforms.hasCut.value = child ? 1 : 0;
  if (child) {
    const [left, top, right, bottom] = child.bounds;
    const inset = Math.min(right - left, bottom - top) * .009;
    uniforms.cut.value.set(left + inset, top + inset, right - inset, bottom - inset);
  }
}

function fineTerrainCut(patch, child) {
  const uniforms = patch.mesh.material.uniforms;
  uniforms.hasFineCut.value = child ? 1 : 0;
  if (!child) return;
  const [west, north, east, south] = child.bounds;
  const inset = (east - west) * .006;
  uniforms.fineCut.value.set(west + inset, north + inset, east - inset, south - inset);
}

function skirtFor(surface, columns, rows) {
  const { position, normal, uv, relief } = surface.attributes;
  const positions = [];
  const normals = [];
  const uvs = [];
  const light = [];
  const startingHeight = surface.attributes.startingHeight;
  const starting = [];
  const stride = columns + 1;
  function addSegment(a, b) {
    for (const [index, down] of [[a, 0], [a, .22], [b, 0], [b, 0], [a, .22], [b, .22]]) {
      positions.push(position.getX(index), position.getY(index) - down, position.getZ(index));
      normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      uvs.push(uv.getX(index), uv.getY(index));
      light.push(relief.getX(index), relief.getY(index));
      if (startingHeight) starting.push(startingHeight.getX(index) - down);
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
  if (startingHeight) skirt.setAttribute('startingHeight', new THREE.Float32BufferAttribute(starting, 1));
  return skirt;
}

export class TerrainView {
  constructor(container, onFrame) {
    this.container = container;
    this.onFrame = onFrame;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor('#242e2a');
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, compact.matches ? 1.2 : 1.55));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.film=new ExhibitFilm(this.renderer);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#d7e3e5', '#61634e', .87));
    const sun = new THREE.DirectionalLight('#ffe2b9', 2.03);
    sun.position.copy(sunDirection);
    this.sun = sun;
    this.scene.add(sun, sun.target);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -.18, right: .18, top: .18, bottom: -.18, near: .05, far: .95 });
    sun.shadow.camera.updateProjectionMatrix();
    this.bridgeLight = {
      bridgeShadow: { value: null },
      bridgeShadowMatrix: { value: new THREE.Matrix4() },
      bridgeShadowAmount: { value: 0 }
    };
    this.camera = new THREE.PerspectiveCamera(43, 1, .012, 9500);
    this.clock = new THREE.Clock();
    this.textureLoader = new THREE.TextureLoader();
    this.compressedLoader = new KTX2Loader()
      .setTranscoderPath(new URL('./vendor/', import.meta.url).href)
      .setWorkerLimit(1)
      .detectSupport(this.renderer);
    this.patches = new Map();
    this.patchUse = 0;
    this.loading = new Map();
    this.beacon = this.makeBeacon();
    this.scene.add(this.beacon);
    this.clouds = [];
    this.focus = 'luding';
    this.mode = 'home';
    this.historyAmount = 0;
    this.landmarkShadows = Array.from({ length: 9 }, () => new THREE.Vector4());
    this.size = { width: 0, height: 0 };
    this.pointers = new Map();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.bindInput();
  }

  async start(route) {
    const [manifestResponse, textures, bridgeModel, vegetation, crownMap] = await Promise.all([
      fetch(new URL('manifest.json', root)), this.loadSurfaceMaterials(), loadLudingBridge(), loadVegetation(),
      this.textureLoader.loadAsync(new URL('canopy.png', materialsRoot).href)
    ]);
    if (!manifestResponse.ok) throw new Error('Terrain manifest unavailable');
    this.data = await manifestResponse.json();
    this.origin = mercator(this.data.origin);
    this.points = Object.fromEntries(
      Object.entries(this.data.stations).map(([id, geo]) => [id, this.world(geo)])
    );
    const waypoints = Object.fromEntries(Object.entries(journeyWaypoints).map(([id, locations]) =>
      [id, locations.map(location => this.world(location))]));
    this.panoramaPoints = [...Object.values(this.points), ...route.flatMap(id => waypoints[id] || [])];
    this.surfaceMaterials = textures;
    this.bridge = bridgeModel;
    shadeBridge(bridgeModel);
    this.vegetation = vegetation;
    this.crownMap = crownMap;
    this.scene.add(this.bridge);
    this.atlasMask = this.makeAtlasMask(route, waypoints);
    this.base = await this.loadPatch('route');
    this.base.mesh.visible = true;
    this.region = await this.loadPatch('corridor');
    this.region.mesh.visible = true;
    this.atlasImagery = new AtlasImagery(this.origin, this.region.photo, this.renderer.capabilities.getMaxAnisotropy());
    Object.assign(this.region.mesh.material.uniforms, this.atlasImagery.uniforms);
    Object.assign(this.base.mesh.material.uniforms, this.atlasImagery.uniforms);
    cutInto(this.base, this.region);
    const fineMaterial = this.region.mesh.material.clone();
    fineMaterial.uniforms = {
      ...this.region.mesh.material.uniforms,
      hasParent: { value: 0 }, hasCut: { value: 0 }, cut: { value: new THREE.Vector4() },
      hasFineCut: { value: 0 }, detail: { value: 1 }, usePhotoBounds: { value: 1 },
      reliefTransition: { value: 1 },
      forestCover: { value: this.region.photo }, hasForestCover: { value: 0 }, forestStrength: { value: 0 },
      photoBounds: { value: new THREE.Vector4().fromArray(this.region.bounds) },
      outsidePhoto: { value: this.base.photo }, outsideBounds: { value: new THREE.Vector4().fromArray(this.base.bounds) }
    };
    fineMaterial.defines = { MORPH_RELIEF: 1 };
    const coarseHeight = (x, z) => surfaceHeight(contains(this.region, x, z) ? this.region : this.base, x, z);
    const swapRelief = (patch, previous) => {
      if (previous) {
        previous.coverRequest?.abort();
        previous.coverage?.texture.dispose();
        if (previous.forest) {
          previous.mesh.remove(previous.forest);
          this.disposeMesh(previous.forest);
        }
        this.scene.remove(previous.mesh);
      }
      fineMaterial.uniforms.forestCover.value = this.region.photo;
      fineMaterial.uniforms.hasForestCover.value = 0;
      fineMaterial.uniforms.forestStrength.value = 0;
      fineTerrainCut(this.region, patch);
      fineTerrainCut(this.base, patch);
      if (patch) {
        cutInto(patch, this.local);
        const skirtMaterial = patch.mesh.material.clone();
        skirtMaterial.uniforms = patch.mesh.material.uniforms;
        skirtMaterial.side = THREE.DoubleSide;
        const { columns, rows } = patch.surface;
        patch.mesh.add(new THREE.Mesh(skirtFor(patch.mesh.geometry, columns, rows), skirtMaterial));
        this.scene.add(patch.mesh);
        if (patch.zoom >= 11) this.loadOverviewForest(patch);
      }
    };
    this.atlasRelief = new AtlasRelief(this.origin, coarseHeight, surfaceHeight, fineMaterial, sunDirection, swapRelief);
    const [luding, near] = await Promise.all([
      this.loadPatch('luding'),
      this.loadPatch('luding-near')
    ]);
    this.applyLocal(luding, near);
    loadModel('luding-banks').then(banks => {
      banks.visible = false;
      banks.traverse(object => {
        if (!object.isMesh) return;
        object.receiveShadow = true;
      });
      near.mesh.add(banks);
      this.historicalBanks = banks;
    }).catch(error => console.warn('河岸模型未加载', error.message));
    const bridge = this.points.luding;
    const bankHeight = Math.max(this.height(bridge.x - .0587, bridge.z), this.height(bridge.x + .0587, bridge.z));
    this.bridge.position.set(bridge.x, bankHeight + .0035, bridge.z);
    this.valleyFloor = this.height(bridge.x, bridge.z) + .05;
    this.sun.target.position.copy(this.bridge.position);
    this.sun.position.copy(this.sun.target.position).addScaledVector(sunDirection, .54);
    this.routeInk = makeJourneyRoute(route, this.points, (x, z) => this.height(x, z), waypoints);
    this.scene.add(this.routeInk);
    const waterways=await loadModel('atlas-watercourses','survey-1');
    this.waterways=waterways.children[0];
    this.waterways.material=new THREE.ShaderMaterial({
      uniforms:{elevation:{value:1}},
      vertexShader:'uniform float elevation; void main(){vec3 p=position;p.y*=elevation;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader:'void main(){gl_FragColor=vec4(.047,.135,.147,.90);\n#include <colorspace_fragment>\n}',
      side:THREE.DoubleSide,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4
    });
    this.waterways.frustumCulled=false;this.scene.add(this.waterways);
    this.overviewLandmarks = new Map();
    loadOverviewMiniatures(this.scene).then(models => {
      this.overviewLandmarks = models;
    }).catch(error => console.warn('全线地标模型未加载', error.message));
    loadModel('zunyi-hall').then(model => {
      model.visible = false;
      this.scene.add(model);
      this.zunyiHall = model;
    }).catch(error => console.warn('遵义会址模型未加载', error.message));
    this.view = this.openingView();
    this.goal = { ...this.view };
    this.setClouds(luding, 'luding');
    this.draw(0);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  async loadOverviewForest(patch) {
    const controller = new AbortController();
    patch.coverRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 6500);
    let coverage;
    try {
      coverage = await loadAtlasLandCover(patch.bounds, this.origin, controller.signal);
    } catch {
      const fallback = this.region.mesh.material.uniforms;
      if (this.atlasRelief.current === patch && fallback.hasPanoramaForest.value) {
        coverage = cropAtlasLandCover(fallback.panoramaForest.value.image, this.region.bounds, patch.bounds);
      }
    } finally {
      clearTimeout(timeout);
    }
    if (!coverage) return;
    if (this.atlasRelief.current !== patch) {
      coverage.texture.dispose();
      return;
    }
    patch.coverage = coverage;
    const uniforms = patch.mesh.material.uniforms;
    patch.forest = makeAtlasForest(patch, coverage, surfaceHeight, this.crownMap, compact.matches, uniforms, sunDirection);
    uniforms.forestCover.value = coverage.texture;
    uniforms.hasForestCover.value = 1;
    if (patch.forest) patch.mesh.add(patch.forest);
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

  makeAtlasMask(route, waypoints) {
    const points = Object.values(this.points);
    const bounds = this.localBounds(this.data.regions.corridor.bounds);
    const [west, north, east, south] = bounds;
    const routePoints = route.flatMap(id => [this.points[id], ...(waypoints[id] || [])]);
    const segments = routePoints.slice(1).map((point, index) => [routePoints[index], point]);
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
    const regional=name==='corridor'||name==='route';
    const compressed=name==='luding'||name==='luding-near';
    const source=()=>this.textureLoader.loadAsync(new URL(image,root).href);
    const sentinel=()=>this.compressedLoader.loadAsync(new URL(image.replace(/\.webp$/,'.ktx2'),root).href).catch(source);
    const panorama=()=>{
      const file=compact.matches?'corridor-mobile.ktx2':'corridor.ktx2';
      return this.compressedLoader.loadAsync(new URL(file,root).href).catch(source);
    };
    const [model,photo,cover,forestImage,panoramaForest,panoramaRelief]=await Promise.all([
      loadModel(name,regional?'native-relief-1':undefined),name==='corridor'?panorama():compressed?sentinel():source(),
      data.forest?readCover(name):null,compressed&&name.endsWith('-near')?source():null,
      name==='corridor'?this.textureLoader.loadAsync(new URL('corridor-forest-mask.png',root).href).catch(()=>null):null,
      name==='corridor'?this.textureLoader.loadAsync(new URL('corridor-relief.png',root).href).catch(()=>null):null
    ]);
    photo.colorSpace = THREE.SRGBColorSpace;
    photo.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const bounds = this.localBounds(data.bounds);
    const [left, top, right, bottom] = bounds;
    const patch = { name, photo, bounds, range: data.range };
    if (panoramaRelief) panoramaRelief.anisotropy = photo.anisotropy;
    const near = name.endsWith('-near');
    const canopy = near ? canopyCoverage(forestImage?.image || photo.image, cover) : null;
    forestImage?.dispose();
    patch.canopy = canopy?.texture;
    const rasterSpacing = Math.max((right - left) / photo.image.width, (bottom - top) / photo.image.height);
    const nativeSpacing = near ? .010 * Math.cosh((data.bounds[1] + data.bounds[3]) / 12756.274) :
      mercatorWidth / (256 * 2 ** (data.photoZoom || data.zoom));
    patch.texelKm = regional ? nativeSpacing : Math.max(rasterSpacing, nativeSpacing);
    const parent = name.endsWith('-near') ?
      await this.loadPatch(name.slice(0, -5)) : this.region || this.base;
    const surface = model.children[0];
    const { columns, rows } = surface.userData;
    const geometry = surface.geometry;
    const { position, uv, _relief } = geometry.attributes;
    geometry.setAttribute('relief', _relief);
    geometry.deleteAttribute('_relief');
    // The shader also uses standard Three.js textures uploaded with a flipped image.
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    patch.surface = { columns, rows, vertices: position };
    geometry.computeBoundingSphere();
    const material = new THREE.ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      polygonOffset: Boolean(parent),
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -5,
      uniforms: {
        museumRelief:{value:0},
        ...this.bridgeLight,
        photo: { value: photo }, parentPhoto: { value: parent?.photo || photo },
        parentBounds: { value: new THREE.Vector4().fromArray(parent?.bounds || bounds) },
        hasParent: { value: parent ? 1 : 0 }, hasCut: { value: 0 }, cut: { value: new THREE.Vector4() },
        hasFineCut: { value: 0 }, fineCut: { value: new THREE.Vector4() },
        usePhotoBounds: { value: 0 }, photoBounds: { value: new THREE.Vector4() },
        outsidePhoto: { value: photo }, outsideBounds: { value: new THREE.Vector4() },
        haze: { value: .025 }, valleyAtmosphere: { value: 0 }, valleyFloor: { value: 0 }, terrainScale: { value: 1 },
        exposure: { value: name === 'huahu' ? 1.26 : 1 },
        atlas: { value: 0 }, atlasCameraDistance: { value: 1 },
        landmarkShadows: { value: this.landmarkShadows },
        atlasMask: { value: this.atlasMask.texture }, atlasBounds: { value: this.atlasMask.bounds },
        hasPanoramaRelief: { value: panoramaRelief ? 1 : 0 }, panoramaRelief: { value: panoramaRelief || photo },
        hasPanoramaForest: { value: panoramaForest ? 1 : 0 }, panoramaForest: { value: panoramaForest || photo },
        atlasPhoto: { value: photo }, atlasPhotoBounds: { value: new THREE.Vector4() }, atlasPhotoOpacity: { value: 0 },
        previousAtlasPhoto: { value: photo }, previousAtlasBounds: { value: new THREE.Vector4() }, previousAtlasOpacity: { value: 0 },
        detail: { value: parent && name !== 'corridor' ? 1 : 0 }, time: { value: 0 },
        sunDirection: { value: sunDirection },
        forestCover: { value: patch.canopy || photo }, hasForestCover: { value: patch.canopy ? 1 : 0 }, forestStrength: { value: 1 },
        forestShadows: { value: photo }, hasForestShadows: { value: 0 },
        texturedSurface: { value: this.surfaceMaterials && name.endsWith('-near') ? 1 : 0 },
        rockColor: { value: this.surfaceMaterials?.[0] || photo }, rockNormal: { value: this.surfaceMaterials?.[1] || photo },
        mossColor: { value: this.surfaceMaterials?.[2] || photo }, mossNormal: { value: this.surfaceMaterials?.[3] || photo },
        history: { value: 0 }, bridgeCenter: { value: new THREE.Vector2(this.points.luding.x, this.points.luding.z) }
      }
    });
    patch.mesh = new THREE.Mesh(geometry, material);
    // The vertex shader raises distant relief beyond the original GLB bounds.
    patch.mesh.frustumCulled = false;
    if (parent) {
      const borderMaterial = material.clone();
      borderMaterial.uniforms = material.uniforms;
      borderMaterial.side = THREE.DoubleSide;
      patch.mesh.add(new THREE.Mesh(skirtFor(geometry, columns, rows), borderMaterial));
    }
    patch.forest = makeForest(patch, (x, z) => surfaceHeight(patch, x, z), compact.matches, canopy,
      sunDirection, material.uniforms.bridgeCenter.value, this.vegetation, this.crownMap);
    if (patch.forest) {
      material.uniforms.forestShadows.value = patch.forest.userData.shadowMap;
      material.uniforms.hasForestShadows.value = 1;
      patch.forest.visible = false;
      patch.mesh.add(patch.forest);
    }
    patch.mesh.visible = false;
    this.scene.add(patch.mesh);
    if (name.endsWith('-near')) {
      const area = name.slice(0, -5);
      const landmark = area === 'zunyi' ? this.points.zunyi : null;
      loadGroundFeatures(area, this.origin, (x, z) => surfaceHeight(patch, x, z), data.buildings, sunDirection, landmark).then(features => {
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
    const materials = new Set();
    group.traverse(object => {
      object.userData.shoreMap?.dispose();
      object.userData.shadowMap?.dispose();
      if (!object.userData.sharedGeometry) object.geometry?.dispose();
      if (object.material) materials.add(object.material);
      if (object.isInstancedMesh) object.dispose();
    });
    for (const material of materials) material.dispose();
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

  height(x, z) {
    const patch = [this.near, this.local, this.atlasRelief?.current, this.region].find(area => contains(area, x, z)) || this.base;
    const transition = patch.startingHeight ? this.atlasRelief.material.uniforms.reliefTransition.value : 1;
    return surfaceHeight(patch, x, z, transition);
  }

  applyLocal(patch, near = null) {
    this.applyNear(null);
    if (this.local) {
      this.local.mesh.visible = false;
      cutInto(this.local, null);
    }
    this.local = patch;
    cutInto(this.region, patch);
    if (this.atlasRelief.current) cutInto(this.atlasRelief.current, patch);
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
      fitAtlas(this.panoramaPoints, this.camera.aspect, this.camera.fov, portrait, this.size.height),
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
    this.queuedAtlasZoom = false;
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
    const pixelBudget = Math.sqrt((this.mode === 'overview' && !compact.matches ? 7_400_000 : 6_400_000) / (width * height));
    this.displayRatio = Math.min(devicePixelRatio || 1, compact.matches ? 1.6 : 2, pixelBudget);
    const antialias = compact.matches ? 1.22 : this.mode === 'overview' ? 1.58 : 1.28;
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
    if (document.hidden || this.suspended) return;
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
    const atlas = smooth(clamp((distance - 170) / 770, 0, 1));
    this.terrainScale = 1 + atlas * 15;
    if(this.waterways){
      this.waterways.visible=this.mode==='overview'&&distance>110;
      this.waterways.material.uniforms.elevation.value=this.terrainScale;
    }
    this.atlasRelief.update(this.goal, this.camera.aspect,
      this.mode === 'overview' && this.hasExplored && !this.flight && contains(this.region, x, z), compact.matches, time);
    this.atlasRelief.animate(dt, noMotion.matches);
    const reliefPatch = this.atlasRelief.current;
    if(reliefPatch)reliefPatch.mesh.material.uniforms.museumRelief.value=this.mode==='overview'?1:0;
    if (reliefPatch?.coverage) {
      const strength = reliefPatch.mesh.material.uniforms.forestStrength;
      strength.value = noMotion.matches ? 1 : Math.min(1, strength.value + dt * 1.8);
      if (reliefPatch.forest) {
        const fade = 1 - smooth(clamp((distance - 11) / 14, 0, 1));
        reliefPatch.forest.material.uniforms.forestBlend.value = strength.value * fade;
        reliefPatch.forest.visible = fade > .01;
      }
    }
    const idleOverview = this.mode === 'overview' && !this.hasExplored && !this.flight;
    const orbit = this.mode === 'home' && !this.flight ? .105 * Math.sin(calm * .21) :
      idleOverview ? .038 * Math.sin(calm * .14) : 0;
    const radial = Math.cos(pitch) * distance;
    const y = this.height(x, z) * this.terrainScale;
    const cx = x + Math.sin(bearing + orbit) * radial;
    const cz = z + Math.cos(bearing + orbit) * radial;
    const cy = Math.max(y + Math.sin(pitch) * distance, this.height(cx, cz) * this.terrainScale + Math.max(.09, distance * .013));
    this.camera.near = Math.max(.012, distance / 950);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(x, y + .014, z);
    this.camera.updateMatrixWorld();
    this.updateOverviewLandmarks(distance);
    if (this.zunyiHall) {
      const point = this.points.zunyi;
      this.zunyiHall.visible = this.local?.name === 'zunyi' && distance < .48;
      if (this.zunyiHall.visible) {
        this.zunyiHall.position.set(point.x, this.height(point.x, point.z) - .0005, point.z);
        this.zunyiHall.scale.set(.032, .026, .032);
        this.zunyiHall.rotation.y = -.34;
      }
    }
    const clarity = 1 - .34 * smooth(clamp((distance - 50) / 200, 0, 1)) *
      (1 - smooth(clamp((distance - 540) / 1050, 0, 1)));
    const haze = clamp(.0125 / Math.max(1, distance / 24), .000023, .0125) * clarity *
      (this.mode === 'overview' ? .77 : 1);
    this.atlasImagery.update(this.view, this.goal, this.camera.aspect, compact.matches, this.size.height * this.displayRatio,
      this.mode==='overview' && this.hasExplored && !this.flight, dt);
    if (this.queuedAtlasZoom && !this.refiningImagery()) {
      this.queuedAtlasZoom = false;
      if (this.zoomMinimum() < this.goal.distance * .99) this.zoom(.70);
    }
    const history = this.historical ? 1 - smooth(clamp((distance - .65) / 2.6, 0, 1)) : 0;
    this.historyAmount = mix(this.historyAmount, history, noMotion.matches ? 1 : 1 - Math.exp(-dt * 7));
    const valleyAtmosphere = this.local?.name === 'luding' && this.mode !== 'overview' ?
      (1 - smooth(clamp((distance - 13) / 15, 0, 1))) * (this.historical ? .82 : .69) : 0;
    for (const patch of [this.base, this.region, this.local, this.near]) {
      if (!patch) continue;
      patch.mesh.material.uniforms.museumRelief.value=(this.mode==='overview'||patch===this.base||patch===this.region)?1:0;
      patch.mesh.material.uniforms.haze.value = haze;
      patch.mesh.material.uniforms.valleyAtmosphere.value = valleyAtmosphere;
      patch.mesh.material.uniforms.valleyFloor.value = this.valleyFloor;
      patch.mesh.material.uniforms.atlas.value = atlas;
      patch.mesh.material.uniforms.atlasCameraDistance.value = distance;
      patch.mesh.material.uniforms.terrainScale.value = this.terrainScale;
      patch.mesh.material.uniforms.time.value = calm;
      patch.mesh.material.uniforms.history.value = this.historyAmount;
      if (patch.forest) updateForest(patch.forest, this.camera.position, distance, haze, this.historyAmount);
      if (patch.features) {
        patch.features.visible = distance < 9;
        for (const object of patch.features.children) {
          object.visible = !this.historical || object === patch.features.userData.river;
        }
        patch.features.userData.time.value = calm;
        patch.features.userData.haze.value = haze;
      }
    }
    for (const cloud of this.clouds) {
      cloud.material.uniforms.time.value = calm;
      cloud.position.x = cloud.userData.startX + Math.sin(calm * .11) * 1.4;
      cloud.visible = distance < 110;
    }
    this.routeInk.visible = this.mode !== 'home' && distance > 190;
    if (this.routeInk.visible) {
      const uniforms = this.routeInk.material.uniforms;
      uniforms.viewport.value.set(this.size.width, this.size.height);
      uniforms.terrainScale.value = this.terrainScale;
      uniforms.reached.value = this.routeInk.userData.orders.get(this.focus) ?? -1;
      uniforms.opacity.value = smooth(clamp((distance - 190) / 150, 0, 1));
    }
    const bridgeVisible = this.local?.name === 'luding' && distance < 3.0;
    if (bridgeVisible && !this.scene.environment) {
      this.scene.environment = makeValleyEnvironment(this.renderer, sunDirection);
      this.scene.environmentIntensity = .66;
    }
    const historicalBridge = this.historyAmount > .48;
    if (bridgeVisible && (!this.bridge.visible || this.bridge.userData.historical.visible !== historicalBridge)) {
      this.renderer.shadowMap.needsUpdate = true;
      this.bridgeLight.bridgeShadowAmount.value = 0;
    }
    this.sun.castShadow = bridgeVisible;
    this.bridge.visible = bridgeVisible;
    this.bridge.userData.historical.visible = historicalBridge;
    this.bridge.userData.modern.visible = !this.bridge.userData.historical.visible;
    if (this.historicalBanks) {
      this.historicalBanks.visible = bridgeVisible && historicalBridge && distance < .9;
    }
    this.beacon.visible = this.mode === 'station' && Boolean(this.focus) && distance < 105 &&
      !this.bridge.visible && !this.zunyiHall?.visible;
    if (this.beacon.visible) {
      const point = this.points[this.focus];
      const radius = Math.max(.006, distance * .009) * (1 + Math.sin(calm * 1.7) * .10);
      this.beacon.position.set(point.x, this.height(point.x, point.z) + .032, point.z);
      this.beacon.scale.setScalar(radius);
    }
    this.film.draw(this.scene,this.camera,{span:Math.max(1.7,distance*1.8),floor:y,verticalScale:1,strength:this.mode==='overview'?.65:.85});
    if (bridgeVisible && this.sun.shadow.map) {
      this.bridgeLight.bridgeShadow.value = this.sun.shadow.map.texture;
      this.bridgeLight.bridgeShadowMatrix.value.copy(this.sun.shadow.matrix);
      this.bridgeLight.bridgeShadowAmount.value = 1 - smooth(clamp((distance - .65) / .95, 0, 1));
    } else {
      this.bridgeLight.bridgeShadowAmount.value = 0;
    }
    this.onFrame(this);
  }

  screen(id) {
    const point = this.points[id];
    const altitude = this.routeInk.visible ? this.height(point.x, point.z) * this.terrainScale + 5.5 : undefined;
    return this.screenPoint(point, altitude);
  }

  updateOverviewLandmarks(distance) {
    updateOverviewMiniatures(this, distance, compact.matches, sunDirection);
  }

  overviewLandmarkScreen(id) {
    return overviewMiniatureScreen(this, id);
  }

  screenPoint({ x, z }, y = this.height(x, z) * this.terrainScale + Math.max(.007, Math.min(.1, this.view.distance * .016), this.view.distance * .0045)) {
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
    if (surface === this.region && this.mode === 'overview') {
      const texel = Math.min(surface.texelKm, this.atlasImagery.texelAt(this.goal));
      return imageryZoomLimit(texel, this.size.height * this.displayRatio, this.camera.fov, 1.95);
    }
    return this.textureZoom(surface);
  }

  atZoomLimit() {
    if (!this.goal || this.flight || this.waitingForTerrain) return false;
    const limit = this.zoomMinimum();
    return this.goal.distance <= limit * 1.001 && this.view.distance <= limit * 1.025;
  }

  canEnterLuding() {
    if(!this.goal||this.waitingForTerrain||this.local?.name!=='luding')return false;
    const point=this.points.luding;
    return (this.mode==='overview'||this.focus==='luding')&&Math.hypot(this.goal.x-point.x,this.goal.z-point.z)<2;
  }

  refiningImagery() {
    return this.mode === 'overview' && this.goal && this.atlasImagery.loadingFiner(this.goal);
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
    if (factor > 1) this.queuedAtlasZoom = false;
    this.hasExplored = true;
    const previousDistance = this.goal.distance;
    const limit = this.zoomMinimum();
    const nextDistance = clamp(previousDistance * factor, limit, this.overviewView().distance * 1.16);
    if (Math.abs(nextDistance - previousDistance) < previousDistance * .0001) {
      if(factor<1&&this.canEnterLuding()&&this.atZoomLimit()){
        this.container.dispatchEvent(new Event('luding-arrival'));return;
      }
      if (factor < 1 && this.refiningImagery()) this.queuedAtlasZoom = true;
      this.browseLocalTerrain();
      return;
    }
    if (pointer && this.mode === 'overview' && nextDistance < previousDistance && previousDistance > 35) {
      const cursor = new THREE.Vector3(pointer.x, pointer.y, .3).unproject(this.camera).sub(this.camera.position);
      const travel = (this.height(this.goal.x, this.goal.z) * this.terrainScale - this.camera.position.y) / cursor.y;
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
    this.queuedAtlasZoom = false;
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
    const inset = frame === this.region ? 25 : frame === this.near ? .85 : 2.7;
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
