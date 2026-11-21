import * as THREE from './vendor/three.module.min.js';
import { clamp, smooth } from './geo.js';
import { loadModel } from './scene-models.js?v=living-atlas-2';

// Stable priority prevents crowded snow-mountain/river stations from becoming
// a pile of icons. Less prominent dioramas enter as the visitor zooms closer.
const landmarks = [
  ['yudu', 90, .20], ['zunyi', 104, -.26], ['luding', 108, -.14],
  ['songpan', 92, .13], ['wuqi', 94, -.24], ['huining', 96, -.26],
  ['jiaoping', 90, .13], ['xiangjiang', 88, .15], ['jiajin', 96, .18]
];

export async function loadOverviewMiniatures(scene) {
  const root = await loadModel('valley-landmarks','living-atlas-2');
  const models = new Map();
  for (const [id, pixels, bearing] of landmarks) {
    const model = root.getObjectByName(id);
    if (!model) continue;
    model.visible = false;
    model.userData = { ...model.userData, pixels, bearing };
    model.traverse(mesh => { if (mesh.isMesh) mesh.material.envMapIntensity = .20; });
    scene.add(model);
    models.set(id, model);
  }
  return models;
}

export function updateOverviewMiniatures(view, distance, compact, sunDirection) {
  const show = view.mode === 'overview' && distance > 30;
  const entrance = smooth(clamp((distance - 30) / 72, 0, 1));
  const unitsPerPixel = 2 * Math.tan(THREE.MathUtils.degToRad(view.camera.fov) / 2) * distance / view.size.height;
  const accepted = [];
  view.landmarkShadows.forEach(shadow => shadow.set(0, 0, 1, 0));
  let index = 0;
  for (const [id, model] of view.overviewLandmarks) {
    model.visible = show;
    if (!show) continue;
    const point = view.points[id];
    const perspective = 1 - .40 * smooth(clamp((distance-430)/1000,0,1));
    const pixels = model.userData.pixels * (compact ? .64 : 1) * perspective;
    const scale = unitsPerPixel * pixels / 1.20 * entrance;
    const { x, z } = point;
    model.position.set(x, view.height(x, z) * view.terrainScale + scale * .012, z);
    model.scale.setScalar(scale);
    model.rotation.y = model.userData.bearing;
    // Screen-space placement is only used for occlusion selection. Geographic
    // coordinates and the journey line remain at their original locations.
    const screen = view.screenPoint(point, model.position.y + scale * .15);
    const radius = pixels * (compact ? .40 : .42) * entrance;
    if (!screen || accepted.some(a => Math.hypot(a.x - screen.x, a.y - screen.y) < a.radius + radius)) {
      model.visible = false;
      continue;
    }
    accepted.push({ ...screen, radius });
    if (index < view.landmarkShadows.length) {
      view.landmarkShadows[index++].set(x - sunDirection.x * scale * .17, z - sunDirection.z * scale * .17,
        scale * .90, .46 * entrance);
    }
  }
}

export function overviewMiniatureScreen(view, id) {
  const model = view.overviewLandmarks.get(id);
  if (!model?.visible) return null;
  const { x, y, z } = model.position;
  // Labels sit below the sculpted foreground, preserving roof and cliff silhouettes.
  return view.screenPoint({ x, z }, y - model.scale.y * .15);
}
