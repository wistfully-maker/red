import { readdir, readFile, writeFile } from 'node:fs/promises';
import { MeshoptEncoder } from './vendor/meshopt_encoder.mjs';

await MeshoptEncoder.ready;
const root = new URL('../assets/models/', import.meta.url);
const requested = process.argv.slice(2);
const files = requested.length ? requested.map(name => name + '.glb') : await readdir(root);
const elementCount = { SCALAR: 1, VEC2: 2, VEC3: 3 };
const componentBytes = { 5120: 1, 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const extension = 'EXT_meshopt_compression';

function padding(length) {
  return (4 - length % 4) % 4;
}

for (const file of files.filter(name => name.endsWith('.glb'))) {
  const path = new URL(file, root);
  const input = await readFile(path);
  const jsonLength = input.readUInt32LE(12);
  const model = JSON.parse(input.toString('utf8', 20, 20 + jsonLength));
  if (model.asset.generator !== 'Long March terrain baker' || model.extensionsUsed.includes(extension)) continue;
  const bin = input.subarray(28 + jsonLength);
  const chunks = [];
  let packedLength = 0;
  for (const accessor of model.accessors) {
    const view = model.bufferViews[accessor.bufferView];
    const mode = view.target === 34963 ? 'TRIANGLES' : 'ATTRIBUTES';
    const stride = view.byteStride || componentBytes[accessor.componentType] * elementCount[accessor.type];
    const original = bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
    const compressed = MeshoptEncoder.encodeGltfBuffer(original, accessor.count, stride, mode);
    view.buffer = 1;
    view.extensions = { [extension]: {
      buffer: 0, byteOffset: packedLength, byteLength: compressed.byteLength, byteStride: stride, count: accessor.count, mode
    } };
    const pad = padding(compressed.byteLength);
    chunks.push(compressed, Buffer.alloc(pad));
    packedLength += compressed.byteLength + pad;
  }
  model.extensionsUsed.push(extension);
  model.extensionsRequired.push(extension);
  model.buffers = [
    { byteLength: packedLength },
    { byteLength: bin.byteLength, extensions: { [extension]: { fallback: true } } }
  ];
  const json = JSON.stringify(model);
  const jsonBytes = Buffer.from(json + ' '.repeat(padding(Buffer.byteLength(json))));
  const header = Buffer.alloc(20);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonBytes.byteLength + packedLength, 8);
  header.writeUInt32LE(jsonBytes.byteLength, 12);
  header.write('JSON', 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(packedLength);
  binHeader.write('BIN\0', 4);
  await writeFile(path, Buffer.concat([header, jsonBytes, binHeader, ...chunks]));
  console.log(file + ': ' + packedLength.toLocaleString() + ' compressed bytes');
}
