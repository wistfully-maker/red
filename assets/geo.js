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

export function sampleGrid(grid, u, v) {
  const col = clamp(u, 0, 1) * (grid.width - 1);
  const row = clamp(v, 0, 1) * (grid.height - 1);
  const x = Math.floor(col);
  const y = Math.floor(row);
  const right = Math.min(x + 1, grid.width - 1);
  const bottom = Math.min(y + 1, grid.height - 1);
  return mix(
    mix(grid.values[y * grid.width + x], grid.values[y * grid.width + right], col - x),
    mix(grid.values[bottom * grid.width + x], grid.values[bottom * grid.width + right], col - x),
    row - y
  );
}
