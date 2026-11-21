import { clamp, mix } from './geo.js';

const radians = Math.PI / 180;

function tangent(fov) {
  return Math.tan(fov * radians / 2);
}

export function imageryZoomLimit(texelKm, renderHeight, fov, pixelsPerTexel) {
  return texelKm * renderHeight / (2 * tangent(fov) * pixelsPerTexel);
}

export function fitAtlas(points, aspect, fov, portrait, viewportHeight) {
  const bearing = portrait ? .20 : -.38;
  const pitch = portrait ? 1.19 : .80;
  const c = Math.cos(bearing);
  const s = Math.sin(bearing);
  const plane = points.map(({ x, z }) => [x * c - z * s, x * s + z * c]);
  const left = Math.min(...plane.map(point => point[0]));
  const right = Math.max(...plane.map(point => point[0]));
  const top = Math.min(...plane.map(point => point[1]));
  const bottom = Math.max(...plane.map(point => point[1]));
  const tanY = tangent(fov);
  const tanX = tanY * aspect;
  const paddingX = portrait ? .77 : .86;
  const topInset = Math.min(portrait ? 112 : 150, viewportHeight * .18);
  const bottomInset = Math.min(portrait ? 85 : 82, viewportHeight * .14);
  const paddingY = Math.min(portrait ? .75 : .81, 1 - (topInset + bottomInset) / viewportHeight);
  const centerY = (bottomInset - topInset) / viewportHeight;
  let across = (left + right) / 2;
  let along = (top + bottom) / 2;
  let distance = Math.max((right - left) / (2 * tanX * paddingX), (bottom - top) / (2 * tanY * paddingY));

  // Fit the projected station bounds, allowing space for the map title and chapter strip.
  for (let pass = 0; pass < 4; pass++) {
    const projected = plane.map(([x, z]) => {
      const depth = distance - (z - along) * Math.cos(pitch);
      return [(x - across) / (depth * tanX), -(z - along) * Math.sin(pitch) / (depth * tanY)];
    });
    const minX = Math.min(...projected.map(point => point[0]));
    const maxX = Math.max(...projected.map(point => point[0]));
    const minY = Math.min(...projected.map(point => point[1]));
    const maxY = Math.max(...projected.map(point => point[1]));
    across += (minX + maxX) / 2 * distance * tanX;
    along -= ((minY + maxY) / 2 - centerY) * distance * tanY / Math.sin(pitch);
    distance *= clamp(Math.max((maxX - minX) / (2 * paddingX), (maxY - minY) / (2 * paddingY)), .82, 1.32);
  }
  return { x: across * c + along * s, z: -across * s + along * c, distance, pitch, bearing };
}

function groundFootprint(pitch, bearing, distance, aspect, fov) {
  const tanY = tangent(fov);
  const tanX = tanY * aspect;
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const sb = Math.sin(bearing);
  const cb = Math.cos(bearing);
  const x = [];
  const z = [];
  for (const u of [-tanX, tanX]) {
    for (const v of [-tanY, tanY]) {
      const length = (sp * distance + 11) / (sp - v * cp);
      const along = cp * distance - length * (cp + v * sp);
      x.push(along * sb + length * u * cb);
      z.push(along * cb - length * u * sb);
    }
  }
  return [Math.min(...x), Math.min(...z), Math.max(...x), Math.max(...z)];
}

export function keepGroundInView(view, bounds, aspect, fov) {
  if (view.distance < 80) return view;
  const [west, north, east, south] = bounds;
  const minPitch = mix(.69, .79, clamp((view.distance - 80) / 2300, 0, 1));
  const pitch = Math.max(view.pitch, Math.min(minPitch, 1.38));
  let distance = view.distance;
  let area = groundFootprint(pitch, view.bearing, distance, aspect, fov);
  const ratio = Math.max((area[2] - area[0]) / (east - west - 12), (area[3] - area[1]) / (south - north - 12));
  if (ratio > 1) {
    distance *= .98 / ratio;
    area = groundFootprint(pitch, view.bearing, distance, aspect, fov);
  }
  return {
    ...view, pitch, distance,
    x: clamp(view.x, west - area[0], east - area[2]),
    z: clamp(view.z, north - area[1], south - area[3])
  };
}
