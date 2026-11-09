export const terrainVertex = /* glsl */ `
  attribute vec2 relief;
  varying vec2 vUv;
  varying vec2 vRelief;
  varying vec3 vGround;
  varying vec3 vSlope;

  void main() {
    vUv = uv;
    vRelief = relief;
    vSlope = normalize(mat3(modelMatrix) * normal);
    vGround = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vGround, 1.0);
  }
`;

export const terrainFragment = /* glsl */ `
  uniform sampler2D photo;
  uniform sampler2D parentPhoto;
  uniform vec4 parentBounds;
  uniform vec4 cut;
  uniform float hasCut;
  uniform float hasParent;
  uniform float haze;
  uniform float exposure;
  uniform float atlas;
  uniform float detail;
  uniform float time;
  uniform float history;
  uniform vec2 bridgeCenter;
  uniform vec3 sunDirection;
  uniform float hasForestCover;
  uniform sampler2D forestCover;
  uniform float texturedSurface;
  uniform sampler2D rockColor;
  uniform sampler2D rockNormal;
  uniform sampler2D mossColor;
  uniform sampler2D mossNormal;
  uniform sampler2D atlasMask;
  uniform vec4 atlasBounds;
  varying vec2 vUv;
  varying vec2 vRelief;
  varying vec3 vGround;
  varying vec3 vSlope;

  float grain(vec2 p) {
    return fract(sin(dot(p, vec2(41.7, 289.1))) * 43758.5453);
  }

  float terrainNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 t = f * f * (3.0 - 2.0 * f);
    return mix(mix(grain(i), grain(i + vec2(1.0, 0.0)), t.x),
      mix(grain(i + vec2(0.0, 1.0)), grain(i + vec2(1.0)), t.x), t.y);
  }

  vec2 crownRelief(vec2 p) {
    vec2 cell = floor(p - .5);
    vec2 local = p - cell;
    float nearest = 10.0;
    vec2 crown = vec2(0.0);
    for (int z = 0; z <= 1; z++) {
      for (int x = 0; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(z));
        vec2 at = cell + neighbor;
        vec3 seed = fract(at.xyx * vec3(.1031, .1030, .0973));
        seed += dot(seed, seed.yzx + 33.33);
        vec2 random = fract((seed.xx + seed.yz) * seed.zy);
        vec2 center = random * .49 + .255;
        float radius = .35 + fract(random.x * 7.09 + random.y) * .26;
        vec2 delta = (local - neighbor - center) / radius;
        float distance = dot(delta, delta);
        if (distance < nearest) {
          nearest = distance;
          crown = delta;
        }
      }
    }
    float cover = 1.0 - smoothstep(.64, 1.26, nearest);
    vec3 leafSlope = normalize(vec3(crown.x, sqrt(max(.035, 1.0 - nearest)), crown.y));
    float sun = max(0.0, dot(leafSlope, sunDirection));
    return vec2(cover, sun);
  }

  void main() {
    if (hasCut > 0.5 && vGround.x >= cut.x && vGround.z >= cut.y && vGround.x <= cut.z && vGround.z <= cut.w) discard;
    vec3 ink = texture2D(photo, vUv).rgb;
    if (hasParent > 0.5) {
      vec2 parentUv = (vGround.xz - parentBounds.xy) / (parentBounds.zw - parentBounds.xy);
      vec2 edges = min(vUv, 1.0 - vUv);
      vec3 below = texture2D(parentPhoto, vec2(parentUv.x, 1.0 - parentUv.y)).rgb;
      ink = mix(below, ink, smoothstep(0.0, 0.085, min(edges.x, edges.y)));
    }
    float era = history * (1.0 - smoothstep(.24, .98, distance(vGround.xz, bridgeCenter)));
    if (era > 0.001) {
      float river = smoothstep(.006, .024, ink.b - ink.r) * smoothstep(.83, .975, normalize(vSlope).y);
      vec2 surface = mat2(.84, .54, -.54, .84) * vGround.xz;
      float valley = .64 * terrainNoise(surface * 21.0) + .36 * terrainNoise(surface * 85.0);
      float grit = .57 * terrainNoise(surface * 237.0) + .43 * terrainNoise(surface * 758.0);
      float scrub = smoothstep(.24, .75, valley);
      vec3 bank = mix(vec3(.158, .127, .085), vec3(.065, .102, .049), scrub);
      bank *= .65 + grit * .68;
      float ripple = terrainNoise(vec2(vGround.x * 171.0, vGround.z * 123.0 - time * .49));
      float flash = pow(.5 + .5 * sin(vGround.z * 351.0 + ripple * 3.7 - time * 2.9), 5.0);
      vec3 current = mix(vec3(.020, .057, .058), vec3(.092, .150, .133), ripple * .76 + flash * .24);
      ink = mix(ink, mix(bank, current, river), era * .98);
    }
    vec3 normal = normalize(vSlope);
    float slopeLight = clamp(dot(normal, sunDirection), 0.0, 1.0);
    float bright = dot(ink, vec3(0.2126, 0.7152, 0.0722));
    ink = mix(vec3(bright), ink, 1.06) * vec3(1.02, 1.04, 0.98);
    ink = pow(max(ink, vec3(0.0)), vec3(0.86));
    float distanceToEye = distance(cameraPosition, vGround);
    float fine = 1.0 - smoothstep(3.0, 28.0, distanceToEye);
    float low = clamp((0.36 - bright) * 3.3, 0.0, 1.0);
    float terrainShadow = mix(.56, 1.0, vRelief.x) * mix(.72, 1.0, vRelief.y);
    float relief = mix(.44 + slopeLight * .92, .35 + slopeLight * 1.10, atlas);
    relief *= mix(terrainShadow, 1.0, atlas * .40);
    if (detail > 0.5 && fine > 0.0) {
      vec2 p = vGround.xz * vec2(105.0, 112.0);
      float broad = terrainNoise(p);
      float grit = terrainNoise(p * 2.17 + vec2(7.3, 18.5));
      float rock = smoothstep(0.08, 0.50, 1.0 - normal.y);
      float foliage = smoothstep(0.003, 0.035, ink.g - ink.r) * low;
      relief += fine * ((broad - 0.5) * 0.28 + (grit - 0.5) * 0.13) * max(rock, foliage);
      float water = smoothstep(0.008, 0.034, ink.b - ink.r) * smoothstep(0.88, 0.994, normal.y);
      water *= 1.0 - smoothstep(0.19, 0.32, bright);
      vec2 derivatives = fwidth(vGround.xz);
      float screenFootprint = max(derivatives.x, derivatives.y);
      vec2 patchEdges = min(vUv, 1.0 - vUv);
      float edgeBlend = smoothstep(.025, .13, min(patchEdges.x, patchEdges.y));
      float crownWeight = hasForestCover * fine * (1.0 - water) *
        (1.0 - smoothstep(.008, .030, screenFootprint)) * (1.0 - era * .88) * edgeBlend;
      if (crownWeight > .015) {
        float woodland = texture2D(forestCover, vec2(vUv.x, 1.0 - vUv.y)).r;
        if (woodland > .04) {
          vec2 crowns = mat2(.87, .49, -.49, .87) * vGround.xz * 48.5;
          vec2 variation = vec2(terrainNoise(crowns * .057), terrainNoise(crowns * .061 + 7.9));
          vec2 crown = crownRelief(crowns + variation * 2.2);
          float shade = mix(.70, .93 + crown.y * .78, crown.x);
          ink *= mix(1.0, shade, woodland * crownWeight);
          ink += vec3(.019, .032, .010) * woodland * crownWeight * crown.x * crown.y;
        }
      }
      float surfaceMix = texturedSurface * (1.0 - smoothstep(1.25, 5.8, distanceToEye)) * (1.0 - water);
      if (surfaceMix > .01) {
        vec2 rockUv = mat2(.89, .45, -.45, .89) * vGround.xz * 16.5;
        vec2 mossUv = mat2(.58, -.81, .81, .58) * vGround.xz * 52.0;
        vec2 rockShift = vec2(vGround.y * 11.5, vGround.y * 8.0) * rock;
        vec3 rockMap = texture2D(rockColor, rockUv + rockShift).rgb;
        vec3 mossMap = texture2D(mossColor, mossUv).rgb;
        float cover = clamp(foliage * 1.32 + (broad - .5) * .3, 0.0, 1.0) * (1.0 - rock * .73);
        vec3 material = mix(rockMap, mossMap, cover);
        vec3 rockSlope = texture2D(rockNormal, rockUv + rockShift).rgb * 2.0 - 1.0;
        vec3 mossSlope = texture2D(mossNormal, mossUv).rgb * 2.0 - 1.0;
        vec3 fineSlope = normalize(mix(rockSlope, mossSlope, cover));
        float diffuse = clamp(.78 + dot(fineSlope, vec3(-.46, .58, .43)) * .42, .40, 1.27);
        float materialLight = dot(material, vec3(.2126, .7152, .0722));
        float tone = mix(clamp(bright, .035, .36), .12, .40);
        vec3 sceneTint = clamp(ink / max(bright, .035), vec3(.62), vec3(1.53));
        vec3 detailed = material * (.67 * tone / max(materialLight, .064) + .33) * mix(vec3(1.0), sceneTint, .56);
        ink = mix(ink, detailed * diffuse, surfaceMix * .90);
      }
      float meterDetail = 1.0 - smoothstep(.00045, .0028, screenFootprint);
      if (meterDetail > .01) {
        vec2 surface = mat2(.86, .51, -.51, .86) * vGround.xz;
        float stone = terrainNoise(surface * 630.0) * .66 + terrainNoise(surface * 1370.0) * .34;
        relief += (stone - .48) * meterDetail * (.17 + rock * .22);
      }
      ink = mix(ink, ink * vec3(1.13, 1.00, 0.86), fine * rock * broad * 0.24);
      float current = sin(dot(vGround.xz, vec2(189.0, 265.0)) + broad * 3.5 + time * 2.2);
      float shiver = pow(max(0.0, current), 4.0) * (0.24 + grit * 0.76);
      ink += vec3(0.025, 0.040, 0.042) * water * shiver * fine;
    }
    ink *= exposure * relief;
    ink += vec3(0.018, 0.026, 0.023) * (1.0 - slopeLight);
    float blue = max(ink.b - ink.r, 0.0);
    ink += vec3(0.01, 0.04, 0.025) * blue;
    float valleyAir = 1.0 + (1.0 - vRelief.y) * .24;
    float mist = (1.0 - exp(-distanceToEye * haze * valleyAir)) * 0.76;
    ink = mix(ink, vec3(0.20, 0.27, 0.28), mist);
    if (atlas > 0.001) {
      vec2 uv = (vGround.xz - atlasBounds.xy) / (atlasBounds.zw - atlasBounds.xy);
      vec2 edges = min(uv, 1.0 - uv);
      float focus = texture2D(atlasMask, uv).r * smoothstep(-.035, .115, min(edges.x, edges.y));
      float earth = (.31 + slopeLight * .69) * (.36 + clamp(vGround.y / 5.7, 0.0, 1.0) * .64);
      vec3 surround = vec3(.020, .031, .025) + earth * vec3(.054, .068, .049);
      ink = mix(ink, surround, atlas * (1.0 - focus) * .98);
    }
    gl_FragColor = vec4(ink, 1.0);
    #include <colorspace_fragment>
  }
`;

export const cloudVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const cloudFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float time;
  uniform float seed;
  uniform float density;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float w = 0.53;
    for (int i = 0; i < 5; i++) {
      v += noise(p) * w;
      p = mat2(1.64, 1.23, -1.23, 1.64) * p + 4.6;
      w *= 0.51;
    }
    return v;
  }

  void main() {
    vec2 centered = vUv - 0.5;
    vec2 drift = vec2(time * 0.022, -time * 0.016);
    vec2 p = vUv * vec2(4.4, 2.8) + vec2(seed, seed * 0.79) + drift;
    float envelope = 1.0 - smoothstep(0.10, 0.49, length(centered * vec2(1.0, 1.13)));
    float vapor = smoothstep(0.32, 0.75, fbm(p + fbm(p * 0.74)));
    float shadow = smoothstep(0.24, 0.71, fbm(p + vec2(0.12, 0.30)));
    vec3 color = mix(vec3(0.31, 0.38, 0.40), vec3(0.74, 0.78, 0.76), shadow);
    gl_FragColor = vec4(color, vapor * envelope * density);
    #include <colorspace_fragment>
  }
`;
