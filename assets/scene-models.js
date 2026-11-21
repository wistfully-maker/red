import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.js';

const models = new URL('./models/', import.meta.url);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export function loadModel(name, revision) {
  const url=new URL(name + '.glb', models);
  if (revision) url.searchParams.set('v',revision);
  return loader.loadAsync(url.href).then(model => model.scene);
}

export async function loadLudingBridge() {
  const bridge = await loadModel('luding-bridge');
  const modern = bridge.getObjectByName('modern');
  const historical = bridge.getObjectByName('historical');
  if (!modern || !historical) throw new Error('Luding bridge is missing an era');
  bridge.userData = { modern, historical };
  bridge.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  historical.visible = false;
  bridge.visible = false;
  return bridge;
}

let vegetation;

export function loadVegetation() {
  vegetation ??= loadModel('vegetation').then(scene =>
    ['broadleaf', 'conifer', 'scrub'].map(name => {
      const form = scene.getObjectByName(name);
      const foliage = scene.getObjectByName(name + '_foliage');
      if (!form?.isMesh || !foliage?.isMesh) throw new Error('Missing vegetation form ' + name);
      return { body: form.geometry, foliage: foliage.geometry };
    }));
  return vegetation;
}
