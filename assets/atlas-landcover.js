import * as THREE from './vendor/three.module.min.js';

const endpoint = 'https://mapproxy.terrascope.be/mapproxy/service';
const size = 640;

function makeCover(coverValues) {
  const texture = new THREE.DataTexture(coverValues, size, size, THREE.RedFormat);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return { width: size, height: size, coverValues, texture };
}

export function cropAtlasLandCover(image, sourceBounds, bounds) {
  const [west, north, east, south] = sourceBounds;
  const [left, top, right, bottom] = bounds;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const x = (left - west) * image.width / (east - west);
  const z = (top - north) * image.height / (south - north);
  context.drawImage(image, x, z, (right - left) * image.width / (east - west),
    (bottom - top) * image.height / (south - north), 0, 0, size, size);
  const imageData = context.getImageData(0, 0, size, size).data;
  return makeCover(Uint8Array.from({ length: size * size }, (_, i) => imageData[i * 4] > 178 ? 180 : 0));
}

export async function loadAtlasLandCover(bounds, origin, signal) {
  const [west, north, east, south] = bounds;
  const [x, z] = origin;
  const bbox = [west + x, -south - z, east + x, -north - z].map(km => (km * 1000).toFixed(2));
  const query = new URLSearchParams({
    service: 'WMS', version: '1.1.1', request: 'GetMap',
    layers: 'esa-worldcover-map-10m-2021-v2_map', styles: '', srs: 'EPSG:3857',
    bbox: bbox.join(','), width: size, height: size, format: 'image/png'
  });
  const response = await fetch(endpoint + '?' + query, { signal });
  if (!response.ok) throw new Error('WorldCover HTTP ' + response.status);
  const image = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none' });
  try {
    if (image.width !== size || image.height !== size) throw new Error('Unexpected WorldCover dimensions');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const map = context.getImageData(0, 0, size, size).data;
    const coverValues = new Uint8Array(size * size);
    for (let i = 0; i < coverValues.length; i++) {
      const index = i * 4;
      const r = map[index], g = map[index + 1], b = map[index + 2];
      // Terrascope's WorldCover map draws tree cover dark green. Exclude
      // mixed pixels near boundaries so crowns stay off fields and water.
      if (map[index + 3] < 250 || r > 18 || b > 18 || g < 58 || g > 120) continue;
      coverValues[i] = 215;
    }
    return makeCover(coverValues);
  } finally {
    image.close();
  }
}
