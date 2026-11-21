import * as THREE from './vendor/three.module.min.js';
import { smooth } from './geo.js';

const imageryEndpoint = 'https://tiles.maps.eox.at/map';
const nativeTexelKm = .012;
const maximumDistance = 450;
const requestDelay = 180;

function areaFor(view, aspect, portrait, displayHeight) {
  const size = portrait ? 1200 : 1600;
  const minimumSpan = Math.ceil(size * nativeTexelKm / 4) * 4;
  // Stay ahead of the next zoom step even on a high-density screen.
  const coverage = Math.max(1.35, aspect * .92);
  const nextZoom = size * .87 / displayHeight;
  const span = Math.max(minimumSpan, 2 ** Math.floor(Math.log2(view.distance * Math.min(coverage, nextZoom))));
  const step = span / 3;
  const x = Math.round(view.x / step) * step;
  const z = Math.round(view.z / step) * step;
  return { key: [span, x, z, size].join('/'), bounds: [x - span / 2, z - span / 2, x + span / 2, z + span / 2], span, size };
}

function covers(area, view) {
  const [west, north, east, south] = area.bounds;
  const inset = area.span * .16;
  return view.x >= west + inset && view.x <= east - inset &&
    view.z >= north + inset && view.z <= south - inset;
}

function imageryUrl(area, origin) {
  const [west, north, east, south] = area.bounds;
  const [x, z] = origin;
  const bbox = [west + x, -south - z, east + x, -north - z].map(km => (km * 1000).toFixed(2));
  const url = new URL(imageryEndpoint);
  url.search = new URLSearchParams({
    service: 'WMS', version: '1.1.1', request: 'GetMap', layers: 's2cloudless-2024_3857',
    styles: '', srs: 'EPSG:3857', bbox: bbox.join(','), width: area.size, height: area.size, format: 'image/jpeg'
  });
  return url.href;
}

export class AtlasImagery {
  constructor(origin, fallback, anisotropy) {
    this.origin = origin;
    this.anisotropy = anisotropy;
    this.cache = new Map();
    this.failures = new Map();
    this.uniforms = {
      atlasPhoto: { value: fallback },
      atlasPhotoBounds: { value: new THREE.Vector4() },
      atlasPhotoOpacity: { value: 0 },
      previousAtlasPhoto: { value: fallback },
      previousAtlasBounds: { value: new THREE.Vector4() },
      previousAtlasOpacity: { value: 0 }
    };
  }

  update(view, goal, aspect, compact, displayHeight, active, dt) {
    if (!active || goal.distance > maximumDistance) {
      this.wanted = null;
      clearTimeout(this.timer);
      this.pending?.controller.abort();
    } else {
      const area = areaFor(goal, aspect, compact, displayHeight);
      if (this.wanted !== area.key) {
        this.wanted = area.key;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.load(area), requestDelay);
      } else if (this.failures.has(area.key) && performance.now() >= this.failures.get(area.key)) {
        this.load(area);
      }
    }
    const strength = active ? 1 - THREE.MathUtils.smoothstep(view.distance, maximumDistance, maximumDistance * 1.45) : 0;
    this.blend = Math.min(1, (this.blend ?? 1) + dt * 3.5);
    const fade = smooth(this.blend);
    this.uniforms.atlasPhotoOpacity.value = strength * fade;
    this.uniforms.previousAtlasOpacity.value = this.previous ? strength * (1 - fade) : 0;
    if (this.blend === 1) this.previous = null;
  }

  texelAt(view) {
    const area = this.current;
    return area && covers(area, view) ? area.span / area.size : Infinity;
  }

  loadingFiner(view) {
    return Boolean(this.pending && covers(this.pending.area, view) &&
      this.pending.area.span / this.pending.area.size < this.texelAt(view));
  }

  select(area) {
    if (area === this.current) return;
    this.previous = this.current;
    if (this.previous) {
      this.uniforms.previousAtlasPhoto.value = this.previous.texture;
      this.uniforms.previousAtlasBounds.value.fromArray(this.previous.bounds);
    }
    this.current = area;
    this.blend = 0;
    this.uniforms.atlasPhoto.value = area.texture;
    this.uniforms.atlasPhotoBounds.value.fromArray(area.bounds);
  }

  async load(area) {
    const cached = this.cache.get(area.key);
    if (cached) {
      this.cache.delete(area.key);
      this.cache.set(area.key, cached);
      this.select(cached);
      return;
    }
    if (this.pending?.key === area.key || performance.now() < (this.failures.get(area.key) || 0)) return;
    this.pending?.controller.abort();
    const controller = new AbortController();
    this.pending = { key: area.key, area, controller };
    // A detailed mosaic can take longer on a cold imagery-service cache.
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(imageryUrl(area, this.origin), { signal: controller.signal });
      if (!response.ok) throw new Error(`Imagery HTTP ${response.status}`);
      const blob = await response.blob();
      // ImageBitmap uploads skip WebGL's flipY flag, so orient it at decode time.
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
      if (controller.signal.aborted || this.wanted !== area.key) {
        bitmap.close();
        return;
      }
      if (bitmap.width !== area.size || bitmap.height !== area.size) {
        bitmap.close();
        throw new Error('Unexpected imagery dimensions');
      }
      const texture = new THREE.Texture(bitmap);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.anisotropy;
      texture.needsUpdate = true;
      const ready = { ...area, texture };
      this.cache.set(area.key, ready);
      this.failures.delete(area.key);
      this.select(ready);
      for (const [key, retired] of this.cache) {
        if (this.cache.size <= 4) break;
        if (retired === this.current || retired === this.previous) continue;
        retired.texture.dispose();
        retired.texture.image.close();
        this.cache.delete(key);
      }
    } catch {
      if (this.wanted === area.key) this.failures.set(area.key, performance.now() + 18000);
      if (this.failures.size > 12) this.failures.delete(this.failures.keys().next().value);
    } finally {
      clearTimeout(timeout);
      if (this.pending?.controller === controller) this.pending = null;
    }
  }
}
