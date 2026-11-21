import * as THREE from './vendor/three.module.min.js';

const routeVertex = /* glsl */ `
  attribute vec3 previous;
  attribute vec3 following;
  attribute float side;
  attribute float stationOrder;
  uniform vec2 viewport;
  uniform float terrainScale;
  varying float edge;
  varying float order;

  vec2 toScreen(vec4 point) {
    return point.xy / max(abs(point.w), .01) * viewport;
  }

  vec4 projectRoute(vec3 point) {
    // The marker clearance stays constant while the terrain relief changes.
    point.y = (point.y - 5.5) * terrainScale + 5.5;
    return projectionMatrix * modelViewMatrix * vec4(point, 1.0);
  }

  void main() {
    vec4 point = projectRoute(position);
    vec4 before = projectRoute(previous);
    vec4 after = projectRoute(following);
    vec2 direction = toScreen(after) - toScreen(before);
    vec2 tangent = direction / max(length(direction), .01);
    vec2 outward = vec2(-tangent.y, tangent.x);
    point.xy += outward * side * 3.4 / viewport * point.w;
    gl_Position = point;
    edge = side;
    order = stationOrder;
  }
`;

const routeFragment = /* glsl */ `
  uniform vec3 paper;
  uniform vec3 shadow;
  uniform float reached;
  uniform float opacity;
  varying float edge;
  varying float order;

  void main() {
    float border = abs(edge);
    float outline = 1.0 - smoothstep(.69, 1.0, border);
    float ink = 1.0 - smoothstep(.33, .69, border);
    float passed = 1.0 - smoothstep(reached - .08, reached + .08, order);
    float strength = reached < 0.0 ? .98 : mix(.60, .98, passed);
    gl_FragColor = vec4(mix(shadow, paper, ink), opacity * outline * mix(.32, strength, ink));
    #include <colorspace_fragment>
  }
`;

export function makeJourneyRoute(ids, points, heightAt, waypoints) {
  const orders = new Map(Object.keys(points).map((id, index) => [id, index]));
  const samples = [];
  for (let i = 1; i < ids.length; i++) {
    const from = ids[i - 1];
    const to = ids[i];
    const legs = [points[from], ...(waypoints[from] || []), points[to]];
    const lengths = legs.slice(1).map((b, index) => Math.hypot(b.x - legs[index].x, b.z - legs[index].z));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let traversed = 0;
    for (const [index, length] of lengths.entries()) {
      const a = legs[index], b = legs[index + 1];
      const steps = Math.max(1, Math.ceil(length / 6));
      for (let j = 0; j < steps; j++) {
        const ratio = j / steps;
        const x = THREE.MathUtils.lerp(a.x, b.x, ratio);
        const z = THREE.MathUtils.lerp(a.z, b.z, ratio);
        const progress = total ? (traversed + ratio * length) / total : 0;
        samples.push({ position: [x, heightAt(x, z) + 5.5, z], order: THREE.MathUtils.lerp(orders.get(from), orders.get(to), progress) });
      }
      traversed += length;
    }
  }
  const end = ids.at(-1);
  const last = points[end];
  samples.push({ position: [last.x, heightAt(last.x, last.z) + 5.5, last.z], order: orders.get(end) });

  const vertices = [];
  const before = [];
  const after = [];
  const sides = [];
  const stations = [];
  const triangles = [];
  for (const [i, sample] of samples.entries()) {
    for (const side of [-1, 1]) {
      vertices.push(...sample.position);
      before.push(...samples[Math.max(0, i - 1)].position);
      after.push(...samples[Math.min(samples.length - 1, i + 1)].position);
      sides.push(side);
      stations.push(sample.order);
    }
    if (i < samples.length - 1) {
      const k = i * 2;
      triangles.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(triangles);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('previous', new THREE.Float32BufferAttribute(before, 3));
  geometry.setAttribute('following', new THREE.Float32BufferAttribute(after, 3));
  geometry.setAttribute('side', new THREE.Float32BufferAttribute(sides, 1));
  geometry.setAttribute('stationOrder', new THREE.Float32BufferAttribute(stations, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: routeVertex, fragmentShader: routeFragment, transparent: true, depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      viewport: { value: new THREE.Vector2(1, 1) },
      terrainScale: { value: 1 },
      reached: { value: -1 },
      opacity: { value: 1 },
      paper: { value: new THREE.Color('#b82e2e') },
      shadow: { value: new THREE.Color('#f5f1e8') }
    }
  });
  const route = new THREE.Mesh(geometry, material);
  route.frustumCulled = false;
  route.userData.orders = orders;
  return route;
}
