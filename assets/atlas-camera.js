import { clamp, mix } from './geo.js';

const radians = Math.PI / 180;
export const ATLAS_MOTION_VERSION='terrain-film-20261127c';

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

/** Resolve headings on the nearest equivalent turn before interpolating. */
export function nearestBearing(from, to) {
  const turn = Math.PI * 2;
  const delta = ((to.bearing - from.bearing + Math.PI) % turn + turn) % turn - Math.PI;
  return {...to, bearing: from.bearing + delta};
}

const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);

export function sampleAtlasFlight(from, to, progress) {
  if (progress <= 0) return {...from};
  if (progress >= 1) return {...to};
  const t = smoother(clamp(progress, 0, 1));
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const arc = Math.sin(t * Math.PI) ** 2;
  const rise = Math.max(0, length * .36 - Math.max(from.distance, to.distance) * .55);
  const pitch = mix(from.pitch, to.pitch, t);
  return {
    x: mix(from.x, to.x, t), z: mix(from.z, to.z, t),
    bearing: mix(from.bearing, to.bearing, t),
    distance: Math.exp(mix(Math.log(Math.max(.001, from.distance)), Math.log(Math.max(.001, to.distance)), t)) + rise * arc,
    pitch: mix(pitch, Math.max(pitch, Math.min(1.18, pitch + .26)), clamp(rise / 250, 0, 1) * arc)
  };
}

/** Stretch time during rendering stalls instead of skipping a large camera step. */
export function advanceAtlasFlight(from,to,duration,elapsed,dt){
  const previous=sampleAtlasFlight(from,to,elapsed/duration);
  let next=Math.min(duration,elapsed+Math.max(0,Math.min(dt,.04)));
  const allowed=view=>Math.abs(Math.log(view.distance/previous.distance))<=.075 &&
    Math.abs(view.bearing-previous.bearing)<=.045 && Math.abs(view.pitch-previous.pitch)<=.035;
  if(!allowed(sampleAtlasFlight(from,to,next/duration))){
    let low=elapsed,high=next;
    for(let n=0;n<12;n++){
      const middle=(low+high)/2;
      if(allowed(sampleAtlasFlight(from,to,middle/duration)))low=middle;else high=middle;
    }
    next=low;
  }
  return {view:sampleAtlasFlight(from,to,next/duration),elapsed:next,progress:next/duration};
}

/** Analytic critically damped following keeps velocity continuous across inputs. */
export function stepAtlasCamera(view, goal, velocity = {}, dt = .016, reducedMotion = false) {
  const target = nearestBearing(view, goal);
  const keys = ['x', 'z', 'pitch', 'bearing', 'distance'];
  if (reducedMotion) return {view: {...target}, velocity: Object.fromEntries(keys.map(key => [key, 0]))};
  const next = {...view}, speed = {...velocity};
  const time = clamp(dt, 0, .1), omega = 12, decay = Math.exp(-omega * time);
  for (const key of keys) {
    const logarithmic = key === 'distance';
    const current = logarithmic ? Math.log(Math.max(.001, view[key])) : view[key];
    const destination = logarithmic ? Math.log(Math.max(.001, target[key])) : target[key];
    const error = current - destination;
    const temporary = ((speed[key] || 0) + omega * error) * time;
    const value = destination + (error + temporary) * decay;
    speed[key] = ((speed[key] || 0) - omega * temporary) * decay;
    next[key] = logarithmic ? Math.exp(value) : value;
  }
  return {view: next, velocity: speed};
}
