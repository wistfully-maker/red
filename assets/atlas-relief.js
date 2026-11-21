import * as THREE from './vendor/three.module.min.js';
import { clamp, mix, smooth } from './geo.js';

const worldWidth = 40075.016686;
const earthRadius = 6378.137;
const tilePixels = 256;
const shadowSamples = [2, 5, 12, 25];
const endpoint = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';

function areaAt(view, origin, aspect) {
  const width = view.distance * Math.max(1.25, aspect * .87);
  const zoom = clamp(Math.floor(Math.log2(worldWidth * 2 / width)), 8, 12);
  const span = worldWidth / 2 ** zoom;
  const x = Math.floor((view.x + origin[0] + worldWidth / 2) / span);
  const z = Math.floor((view.z + origin[1] + worldWidth / 2) / span);
  return { zoom, span, x, z, key: [zoom, x, z].join('/') };
}

function elevation(grid, x, z) {
  const col = clamp(x, 0, grid.size - 1);
  const row = clamp(z, 0, grid.size - 1);
  const a = Math.floor(col), b = Math.floor(row);
  const c = Math.min(a + 1, grid.size - 1), d = Math.min(b + 1, grid.size - 1);
  return mix(mix(grid.values[b * grid.size + a], grid.values[b * grid.size + c], col - a),
    mix(grid.values[d * grid.size + a], grid.values[d * grid.size + c], col - a), row - b);
}

function makeMesh(area, origin, grid, material, parentHeight, previousHeight, sun, compact) {
  const [ox, oz] = origin;
  const left = (area.x - 1) * area.span - worldWidth / 2 - ox;
  const top = (area.z - 1) * area.span - worldWidth / 2 - oz;
  const width = area.span * 3;
  const bounds = [left, top, left + width, top + width];
  const columns = compact ? 144 : 256;
  const rows = columns;
  const geometry = new THREE.PlaneGeometry(width, width, columns, rows);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(left + width / 2, 0, top + width / 2);
  const vertices = geometry.attributes.position;
  const stride = columns + 1;
  const horizontal = Math.hypot(sun.x, sun.z);
  const cell = width / columns;
  const valueAt = (x, z) => {
    const u = (x - left) / width, v = (z - top) / width;
    const meters = elevation(grid, u * grid.size - .5, v * grid.size - .5);
    const edge = smooth(clamp(Math.min(u, v, 1 - u, 1 - v) / .16, 0, 1));
    const height = Math.max(0, meters) * .001 * Math.cosh((z + oz) / earthRadius);
    return mix(parentHeight(x, z) + .003, height, edge);
  };
  const lighting = new Float32Array(vertices.count * 2);
  const startingHeight = new Float32Array(vertices.count);
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i);
    const edge = Math.min(x - left, z - top, bounds[2] - x, bounds[3] - z);
    const height = parentHeight(x, z);
    startingHeight[i] = mix(height, previousHeight(x, z), smooth(clamp(edge / (width * .14), 0, 1))) + .003;
    vertices.setY(i, valueAt(x, z));
  }
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i), y = vertices.getY(i);
    let shadow = 0;
    for (const n of shadowSamples) {
      const distance = n * cell;
      const sx = x + sun.x * distance / horizontal;
      const sz = z + sun.z * distance / horizontal;
      if (sx < left || sx > bounds[2] || sz < top || sz > bounds[3]) break;
      shadow = Math.max(shadow, smooth(clamp((valueAt(sx, sz) - y - sun.y * distance / horizontal) / (.24 * distance), 0, 1)));
    }
    const leftIndex = i % stride === 0 ? i : i - 1;
    const rightIndex = i % stride === columns ? i : i + 1;
    const around = (vertices.getY(leftIndex) + vertices.getY(rightIndex) +
      vertices.getY(Math.max(0, i - stride)) + vertices.getY(Math.min(vertices.count - 1, i + stride))) / 4;
    lighting[i * 2] = 1 - shadow;
    lighting[i * 2 + 1] = 1 - clamp((around - y) / (cell * .24), 0, .56);
  }
  geometry.computeVertexNormals();
  geometry.setAttribute('startingHeight', new THREE.BufferAttribute(startingHeight, 1));
  geometry.setAttribute('relief', new THREE.BufferAttribute(lighting, 2));
  geometry.computeBoundingSphere();
  return { mesh: new THREE.Mesh(geometry, material), bounds, surface: { columns, rows, vertices }, startingHeight, zoom: area.zoom };
}

export class AtlasRelief {
  constructor(origin, parentHeight, sampleSurface, material, sun, onChange) {
    this.origin = origin;
    this.parentHeight = parentHeight;
    this.sampleSurface = sampleSurface;
    this.material = material;
    this.sun = sun;
    this.onChange = onChange;
    this.tiles = new Map();
  }

  update(view, aspect, active, compact, now) {
    if (!active || view.distance > 135) {
      this.wanted = null;
      this.pending?.abort();
      this.pending = null;
      if (this.current) this.replace(null);
      return;
    }
    const area = areaAt(view, this.origin, aspect);
    const columns = compact ? 144 : 256;
    area.key += '/' + columns;
    // Keep the current mosaic while the view remains in its well sampled interior.
    if (this.current?.zoom === area.zoom && this.current.surface.columns === columns) {
      const [west, north, east, south] = this.current.bounds;
      const inset = area.span * .72;
      if (view.x > west + inset && view.x < east - inset && view.z > north + inset && view.z < south - inset) {
        this.wanted = null;
        this.pending?.abort();
        this.pending = null;
        return;
      }
    }
    if (this.wanted?.key !== area.key) {
      this.wanted = area;
      this.changedAt = now;
      this.pending?.abort();
      this.pending = null;
    }
    if (!this.pending && now - this.changedAt >= .23 && performance.now() >= (this.wanted.retryAt || 0)) {
      this.load(this.wanted, compact);
    }
  }

  replace(patch) {
    const previous = this.current;
    this.current = patch;
    this.onChange(patch, previous);
    previous?.mesh.geometry.dispose();
    previous?.mesh.children.forEach(child => {
      child.geometry.dispose();
      child.material.dispose();
    });
  }

  animate(dt, reducedMotion) {
    if (!this.current) return;
    const transition = this.material.uniforms.reliefTransition;
    transition.value = reducedMotion ? 1 : Math.min(1, transition.value + dt * 2.4);
  }

  async tile(zoom, x, z, signal) {
    const key = [zoom, x, z].join('/');
    const cached = this.tiles.get(key);
    if (cached) {
      this.tiles.delete(key);
      this.tiles.set(key, cached);
      return cached;
    }
    const response = await fetch(endpoint + key + '.png', { signal });
    if (!response.ok) throw new Error('Terrain tile HTTP ' + response.status);
    const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none' });
    if (bitmap.width !== tilePixels || bitmap.height !== tilePixels) {
      bitmap.close();
      throw new Error('Unexpected terrain tile dimensions');
    }
    if (!this.tileContext) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = tilePixels;
      this.tileContext = canvas.getContext('2d', { willReadFrequently: true });
    }
    const context = this.tileContext;
    context.clearRect(0, 0, tilePixels, tilePixels);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const rgba = context.getImageData(0, 0, tilePixels, tilePixels).data;
    const meters = new Float32Array(tilePixels * tilePixels);
    for (let i = 0; i < meters.length; i++) {
      meters[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768;
    }
    this.tiles.set(key, meters);
    if (this.tiles.size > 36) this.tiles.delete(this.tiles.keys().next().value);
    return meters;
  }

  async load(area, compact) {
    const controller = new AbortController();
    this.pending = controller;
    const timeout = setTimeout(() => controller.abort(), 16000);
    try {
      const tiles = await Promise.all(Array.from({ length: 9 }, (_, i) =>
        this.tile(area.zoom, area.x + i % 3 - 1, area.z + Math.floor(i / 3) - 1, controller.signal)));
      if (controller.signal.aborted || this.wanted?.key !== area.key) return;
      const size = tilePixels * 3;
      const values = new Float32Array(size * size);
      for (const [i, tile] of tiles.entries()) {
        for (let row = 0; row < tilePixels; row++) {
          const offset = (Math.floor(i / 3) * tilePixels + row) * size + i % 3 * tilePixels;
          values.set(tile.subarray(row * tilePixels, (row + 1) * tilePixels), offset);
        }
      }
      const previous = this.current;
      const progress = this.material.uniforms.reliefTransition.value;
      const previousHeight = (x, z) => {
        if (previous && x >= previous.bounds[0] && x <= previous.bounds[2] && z >= previous.bounds[1] && z <= previous.bounds[3]) {
          return this.sampleSurface(previous, x, z, progress) - .003;
        }
        return this.parentHeight(x, z);
      };
      const mesh = makeMesh(area, this.origin, { size, values }, this.material, this.parentHeight, previousHeight, this.sun, compact);
      this.material.uniforms.reliefTransition.value = 0;
      this.replace(mesh);
    } catch {
      if (this.pending === controller) {
        area.retryAt = performance.now() + 4000;
        controller.abort();
      }
    } finally {
      clearTimeout(timeout);
      if (this.pending === controller) this.pending = null;
    }
  }
}
