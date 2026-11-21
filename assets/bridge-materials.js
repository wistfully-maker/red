import * as THREE from './vendor/three.module.min.js';

const noise = /* glsl */ `
  float surfaceHash(vec3 p) {
    p = fract(p * .3183099 + vec3(.17, .31, .73));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float surfaceNoise(vec3 p) {
    vec3 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(surfaceHash(cell), surfaceHash(cell + vec3(1,0,0)), f.x);
    float b = mix(surfaceHash(cell + vec3(0,1,0)), surfaceHash(cell + vec3(1,1,0)), f.x);
    float c = mix(surfaceHash(cell + vec3(0,0,1)), surfaceHash(cell + vec3(1,0,1)), f.x);
    float d = mix(surfaceHash(cell + vec3(0,1,1)), surfaceHash(cell + vec3(1,1,1)), f.x);
    return mix(mix(a,b,f.y), mix(c,d,f.y), f.z);
  }
  float surfaceDetail(vec3 p) {
    return surfaceNoise(p) * (1.0 - smoothstep(.28, 1.15, length(fwidth(p))));
  }
`;

const surfaces = {
  wood: /* glsl */ `
    vec3 grain = vBridgeLocal * (abs(vBridgeNormal.y) > .78 ? vec3(8.5, 4.0, .32) : vec3(13.0, .83, 11.0));
    float coarse = surfaceNoise(grain * .25);
    float rings = surfaceDetail(grain + coarse * 2.6);
    float wear = surfaceNoise(vBridgeLocal * 1.17);
    diffuseColor.rgb *= .73 + coarse * .24 + rings * .47;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.88, .99, 1.06), wear);
  `,
  stone: /* glsl */ `
    float weather = surfaceNoise(vBridgeLocal * vec3(3.9, 3.3, 4.1));
    float veins = surfaceDetail(vBridgeLocal * vec3(20.0, 8.5, 21.0) + weather * 3.8);
    float flecks = surfaceDetail(vBridgeLocal * 63.0);
    float damp = smoothstep(.31, .77, weather) * (1.0 - smoothstep(-9.5, -1.0, vBridgeLocal.y));
    diffuseColor.rgb *= (.72 + weather * .37 + veins * .26 + flecks * .18);
    diffuseColor.rgb *= mix(vec3(1.0), vec3(.68, .76, .65), damp * .55);
  `,
  tile: /* glsl */ `
    float row = abs(fract(vBridgeLocal.y * 6.6 + surfaceNoise(vBridgeLocal * 2.1) * .21) - .5);
    float scale = length(fwidth(vBridgeLocal)) * 6.6;
    float seam = smoothstep(.35, .48, row) * (1.0 - smoothstep(.12, .68, scale));
    diffuseColor.rgb *= .89 + surfaceNoise(vBridgeLocal * 9.5) * .18 - seam * .21;
  `,
  iron: /* glsl */ `
    float patina = surfaceNoise(vBridgeLocal * 16.5);
    diffuseColor.rgb *= .82 + patina * .37;
    diffuseColor.rgb += vec3(.030, .012, .004) * smoothstep(.55, .83, patina);
  `
};

export function shadeBridge(bridge) {
  const materials = new Set();
  bridge.traverse(mesh => { if (mesh.isMesh) materials.add(mesh.material); });
  for (const material of materials) {
    const name = material.name;
    const surface = name.startsWith('deck') || name.startsWith('timber') ? 'wood' :
      name.startsWith('forged') ? 'iron' : name.startsWith('roof') ? 'tile' : 'stone';
    finishBridgeSurface(material,surface);
  }
}

export function finishBridgeSurface(material,surface) {
  material.envMapIntensity = surface === 'iron' ? .88 : .48;
  if (surface === 'iron') {
    material.metalness = .61;
    material.roughness = .61;
  }
  material.customProgramCacheKey = () => 'bridge-' + surface;
  material.onBeforeCompile = shader => {
    const varyings = 'varying vec3 vBridgeLocal; varying vec3 vBridgeNormal;';
    shader.vertexShader = varyings + '\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec4 surfacePoint = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        surfacePoint = instanceMatrix * surfacePoint;
      #endif
      vBridgeLocal = surfacePoint.xyz;
      vBridgeNormal = normal;
    `);
    shader.fragmentShader = varyings + '\n' + noise + shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n' + surfaces[surface]);
  };
}

export function makeValleyEnvironment(renderer, sun) {
  const width = 128, height = 64;
  const values = new Uint16Array(width * height * 4);
  const sky = new THREE.Color('#8faeb8');
  const horizon = new THREE.Color('#c1c9bd');
  const ground = new THREE.Color('#4d5642');
  const light = new THREE.Color('#ffe8c5');
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const elevation = Math.PI * ((y + .5) / height - .5);
    const h = Math.sin(elevation);
    for (let x = 0; x < width; x++) {
      const angle = 2 * Math.PI * ((x + .5) / width - .5);
      const dot = sun.x * Math.cos(angle) * Math.cos(elevation) + sun.y * h + sun.z * Math.sin(angle) * Math.cos(elevation);
      const glow = Math.max(0, dot) ** 27 * 1.7;
      color.copy(horizon).lerp(h > 0 ? sky : ground, Math.abs(h) ** .43).multiplyScalar(.54);
      const index = (y * width + x) * 4;
      values[index] = THREE.DataUtils.toHalfFloat(color.r + light.r * glow);
      values[index + 1] = THREE.DataUtils.toHalfFloat(color.g + light.g * glow);
      values[index + 2] = THREE.DataUtils.toHalfFloat(color.b + light.b * glow);
      values[index + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const texture = new THREE.DataTexture(values, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(texture);
  texture.dispose();
  generator.dispose();
  return environment.texture;
}
