const DEG = Math.PI / 180;
const RADIUS = 6378.137;

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

export function mercator([lat, lon]) {
  return [RADIUS * lon * DEG, -RADIUS * Math.asinh(Math.tan(lat * DEG))];
}

export function geographic(x, z) {
  return [Math.atan(Math.sinh(-z / RADIUS)) / DEG, x / RADIUS / DEG];
}
