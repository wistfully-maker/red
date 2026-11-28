export const terrainVertex = /* glsl */ `
  attribute vec2 relief;
  varying vec2 vUv;
  varying vec2 vRelief;
  varying vec3 vGround;
  varying vec3 vSlope;
  uniform float terrainScale;
  #ifdef MORPH_RELIEF
    attribute float startingHeight;
    uniform float reliefTransition;
  #endif

  void main() {
    vUv = uv;
    vRelief = relief;
    vSlope = normalize(mat3(modelMatrix) * vec3(normal.x * terrainScale, normal.y, normal.z * terrainScale));
    vec3 point = position;
    #ifdef MORPH_RELIEF
      point.y = mix(startingHeight, point.y, smoothstep(0.0, 1.0, reliefTransition));
    #endif
    vGround = (modelMatrix * vec4(point, 1.0)).xyz;
    vec3 visibleGround = vec3(vGround.x, vGround.y * terrainScale, vGround.z);
    // Subtract the camera in view space before projecting. Combining the
    // projection/view matrices first loses near-scene precision across the
    // kilometre-wide atlas and disagrees with the buildings' projection.
    vec4 eyePosition = viewMatrix * vec4(visibleGround, 1.0);
    gl_Position = projectionMatrix * eyePosition;
  }
`;

export const terrainFragment = /* glsl */ `
  uniform float museumRelief;
  uniform sampler2D photo;
  uniform sampler2D parentPhoto;
  uniform vec4 parentBounds;
  uniform vec4 cut;
  uniform float hasCut;
  uniform vec4 fineCut;
  uniform float hasFineCut;
  uniform float usePhotoBounds;
  uniform vec4 photoBounds;
  uniform sampler2D outsidePhoto;
  uniform vec4 outsideBounds;
  uniform float hasParent;
  uniform float haze;
  uniform float valleyAtmosphere;
  uniform float valleyFloor;
  uniform float exposure;
  uniform float atlas;
  uniform float atlasCameraDistance;
  uniform vec4 landmarkShadows[9];
  uniform float detail;
  uniform float time;
  uniform float history;
  uniform vec2 bridgeCenter;
  uniform vec3 sunDirection;
  uniform float hasForestCover;
  uniform float forestStrength;
  uniform sampler2D forestCover;
  uniform sampler2D forestShadows;
  uniform float hasForestShadows;
  uniform float texturedSurface;
  uniform sampler2D rockColor;
  uniform sampler2D rockNormal;
  uniform sampler2D mossColor;
  uniform sampler2D mossNormal;
  uniform sampler2D atlasMask;
  uniform vec4 atlasBounds;
  uniform sampler2D panoramaRelief;
  uniform float hasPanoramaRelief;
  uniform sampler2D panoramaForest;
  uniform float hasPanoramaForest;
  uniform sampler2D atlasPhoto;
  uniform vec4 atlasPhotoBounds;
  uniform float atlasPhotoOpacity;
  uniform sampler2D previousAtlasPhoto;
  uniform vec4 previousAtlasBounds;
  uniform float previousAtlasOpacity;
  uniform sampler2D bridgeShadow;
  uniform mat4 bridgeShadowMatrix;
  uniform float bridgeShadowAmount;
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

  float valleyAerosol(vec3 ground, float range) {
    if (valleyAtmosphere < .001) return 0.0;
    vec3 ray = ground - cameraPosition;
    float lowAir = 0.0;
    for (int i = 0; i < 4; i++) {
      vec3 p = cameraPosition + ray * ((float(i) + .5) * .25);
      float floorHeight = valleyFloor + .055 * sin((p.z - bridgeCenter.y) * 1.2);
      float layer = exp(-max(0.0, p.y - floorHeight) * 5.6);
      float margin = abs(p.x - bridgeCenter.x);
      float corridor = 1.0 - smoothstep(.25, 2.1, margin);
      float drift = terrainNoise((p.xz - bridgeCenter) * vec2(1.1, .46) + vec2(time * .024, -time * .012));
      lowAir += layer * corridor * (.49 + drift * .67);
    }
    return (1.0 - exp(-max(0.0, range - .16) * lowAir * .25 * .72)) * valleyAtmosphere;
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

  vec2 imageUv(vec4 bounds) {
    return (vGround.xz - bounds.xy) / max(vec2(.001), bounds.zw - bounds.xy);
  }

  float imageEdge(vec2 uv) {
    vec2 inset = min(uv, 1.0 - uv);
    return smoothstep(.014, .115, min(inset.x, inset.y));
  }

  bool inside(vec4 bounds) {
    return all(greaterThanEqual(vGround.xz, bounds.xy)) && all(lessThanEqual(vGround.xz, bounds.zw));
  }

  float bridgeOcclusion() {
    if (bridgeShadowAmount < .001 || distance(vGround.xz, bridgeCenter) > .25) return 0.0;
    vec3 uv = (bridgeShadowMatrix * vec4(vGround, 1.0)).xyz;
    if (any(lessThan(uv, vec3(.0))) || any(greaterThan(uv, vec3(1.0)))) return 0.0;
    const vec4 depthScale = vec4(255.0 / 256.0, 255.0 / 65536.0, 255.0 / 16777216.0, 1.0 / 16777216.0);
    float blocked = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 offset = vec2(float(x), float(y)) * .0013;
        float depth = dot(textureLod(bridgeShadow, uv.xy + offset, 0.0), depthScale);
        blocked += step(depth + .002, uv.z);
      }
    }
    return blocked / 9.0 * bridgeShadowAmount;
  }

  void main() {
    if ((hasCut > .5 && inside(cut)) || (hasFineCut > .5 && inside(fineCut))) discard;
    vec2 baseUv = usePhotoBounds > .5 ? imageUv(photoBounds) : vec2(vUv.x, 1.0 - vUv.y);
    vec3 ink = texture2D(photo, vec2(baseUv.x, 1.0 - baseUv.y)).rgb;
    if (usePhotoBounds > .5 && !inside(photoBounds)) {
      vec2 outside = imageUv(outsideBounds);
      ink = texture2D(outsidePhoto, vec2(outside.x, 1.0 - outside.y)).rgb;
    }
    if (hasParent > 0.5) {
      vec2 parentUv = (vGround.xz - parentBounds.xy) / (parentBounds.zw - parentBounds.xy);
      vec2 edges = min(vUv, 1.0 - vUv);
      vec3 below = texture2D(parentPhoto, vec2(parentUv.x, 1.0 - parentUv.y)).rgb;
      ink = mix(below, ink, smoothstep(0.0, 0.085, min(edges.x, edges.y)));
    }
    if (atlasPhotoOpacity + previousAtlasOpacity > .001) {
      vec2 current = imageUv(atlasPhotoBounds);
      vec2 previous = imageUv(previousAtlasBounds);
      float now = imageEdge(current) * atlasPhotoOpacity;
      float before = imageEdge(previous) * previousAtlasOpacity;
      ink = ink * (1.0 - now - before) +
        texture2D(atlasPhoto, vec2(current.x, 1.0 - current.y)).rgb * now +
        texture2D(previousAtlasPhoto, vec2(previous.x, 1.0 - previous.y)).rgb * before;
    }
    vec3 museumColor = ink;
    if(museumRelief>.001){
      vec3 n=normalize(vSlope);
      float h=max(0.,vGround.y), slope=1.-n.y;
      float planted=terrainNoise(vGround.xz*.026)*.52+terrainNoise(vGround.xz*.11)*.28+terrainNoise(vGround.xz*.004)*.20;
      vec3 low=mix(vec3(.124,.160,.080),vec3(.273,.277,.145),smoothstep(.32,.71,planted));
      vec3 earth=mix(low,vec3(.354,.282,.171),smoothstep(.95,3.4,h)*.82);
      earth=mix(earth,vec3(.37,.39,.34),smoothstep(.18,.72,slope)*.75);
      earth=mix(earth,vec3(.79,.82,.76),smoothstep(3.55,6.6,h+.55*n.y+.28*planted));
      float light=.48+.73*max(0.,dot(n,normalize(vec3(-.68,.75,-.42))));
      float occ=mix(.57,1.,clamp(vRelief.x*vRelief.y,0.,1.));
      float band=h/.25;float stepSize=max(.019,fwidth(band));
      float contour=(1.-smoothstep(0.,stepSize*.76,abs(fract(band+.5)-.5)))*(1.-smoothstep(.33,.7,stepSize));
      float luminance=dot(ink,vec3(.2126,.7152,.0722));
      vec3 photographed=mix(vec3(luminance),ink,.88);
      vec3 surface=mix(earth,photographed*1.30,.83);
      vec3 printColor=surface*(.64+.50*light)*mix(1.,occ,.60)*(1.-.057*contour);
      if(h<.004){
        vec3 coastal=photographed*.91+vec3(.008,.024,.030);
        printColor=mix(coastal,printColor,smoothstep(.0002,.004,h));
      }
      museumColor=printColor;
    }
    float era = history * (1.0 - smoothstep(.24, .98, distance(vGround.xz, bridgeCenter)));
    if (era > 0.001) {
      vec2 surface = mat2(.84, .54, -.54, .84) * vGround.xz;
      float valley = .56 * terrainNoise(surface * 21.0) + .44 * terrainNoise(surface * 85.0);
      float grit = .46 * terrainNoise(surface * 237.0) + .31 * terrainNoise(surface * 758.0) +
        .23 * terrainNoise(surface * 1900.0);
      float woodland = texture2D(forestCover, vec2(vUv.x, 1.0 - vUv.y)).r;
      float rockyBank = smoothstep(.01, .32, 1.0 - normalize(vSlope).y);
      float cover = smoothstep(.29, .69, woodland * .51 + valley * .49);
      vec3 bank = mix(vec3(.121, .105, .086), vec3(.040, .064, .040), cover);
      bank = mix(bank, vec3(.086, .092, .082), rockyBank * .69);
      bank *= .59 + grit * .86;
      ink = mix(ink, bank, era * .96);
    }
    vec3 normal = normalize(vSlope);
    float slopeLight = clamp(dot(normal, sunDirection), 0.0, 1.0);
    float bright = dot(ink, vec3(0.2126, 0.7152, 0.0722));
    ink = mix(vec3(bright), ink, 1.06) * vec3(1.02, 1.04, 0.98);
    ink = pow(max(ink, vec3(0.0)), vec3(0.86));
    float distanceToEye = distance(cameraPosition, vGround);
    vec2 detailEdges = min(vUv, 1.0 - vUv);
    float detailInterior = hasParent > .5 ? smoothstep(.0, .085, min(detailEdges.x, detailEdges.y)) : 1.0;
    float fine = (1.0 - smoothstep(3.0, 28.0, distanceToEye)) * detailInterior;
    float low = clamp((0.36 - bright) * 3.3, 0.0, 1.0);
    float lightFacing = smoothstep(-.21, .89, dot(normal, sunDirection));
    float terrainShadow = mix(.52, 1.0, vRelief.x) * mix(.69, 1.0, vRelief.y);
    float relief = mix(.51 + lightFacing * .80, .40 + lightFacing * 1.01, atlas);
    relief *= mix(terrainShadow, 1.0, atlas * .29);
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
      if (hasForestShadows > .5 && distanceToEye < 6.0) {
        float shadow = texture2D(forestShadows, vec2(vUv.x, 1.0 - vUv.y)).r;
        relief *= 1.0 - shadow * .46 * (1.0 - smoothstep(1.4, 6.0, distanceToEye)) * (1.0 - era * .84);
      }
      float crownWeight = hasForestCover * forestStrength * fine * (1.0 - water) *
        (1.0 - smoothstep(.008, .030, screenFootprint)) * (1.0 - era * .88) * edgeBlend;
      if (crownWeight > .015) {
        float woodland = texture2D(forestCover, vec2(vUv.x, 1.0 - vUv.y)).r;
        if (woodland > .04) {
          vec2 crowns = mat2(.87, .49, -.49, .87) * vGround.xz * 48.5;
          vec2 variation = vec2(terrainNoise(crowns * .057), terrainNoise(crowns * .061 + 7.9));
          vec2 crown = crownRelief(crowns + variation * 2.2);
          float shade = mix(.66, .88 + crown.y * .80, crown.x);
          ink *= mix(1.0, shade, woodland * crownWeight);
          ink += vec3(.019, .032, .010) * woodland * crownWeight * crown.x * crown.y;
        }
      }
      float surfaceMix = texturedSurface * (1.0 - smoothstep(1.25, 5.8, distanceToEye)) * (1.0 - water);
      if (surfaceMix > .01) {
        vec2 rockUv = mat2(.89, .45, -.45, .89) * vGround.xz * 16.5;
        vec2 mossUv = mat2(.58, -.81, .81, .58) * vGround.xz * 52.0;
        vec3 projectionWeight = pow(abs(normal), vec3(3.0));
        projectionWeight /= max(.001, projectionWeight.x + projectionWeight.y + projectionWeight.z);
        vec2 rockEast = vec2(vGround.z * 16.5, vGround.y * 16.5);
        vec2 rockNorth = vec2(vGround.x * 16.5, vGround.y * 16.5);
        vec3 rockMap = texture2D(rockColor, rockUv).rgb * projectionWeight.y +
          texture2D(rockColor, rockEast).rgb * projectionWeight.x +
          texture2D(rockColor, rockNorth).rgb * projectionWeight.z;
        vec3 mossMap = texture2D(mossColor, mossUv).rgb;
        float cover = clamp(foliage * 1.32 + (broad - .5) * .3, 0.0, 1.0) * (1.0 - rock * .73) * (1.0 - era * .75);
        vec3 material = mix(rockMap, mossMap, cover);
        vec3 rockSlope = (texture2D(rockNormal, rockUv).rgb * projectionWeight.y +
          texture2D(rockNormal, rockEast).rgb * projectionWeight.x +
          texture2D(rockNormal, rockNorth).rgb * projectionWeight.z) * 2.0 - 1.0;
        vec3 mossSlope = texture2D(mossNormal, mossUv).rgb * 2.0 - 1.0;
        vec3 fineSlope = normalize(mix(rockSlope, mossSlope, cover));
        float diffuse = clamp(.78 + dot(fineSlope, vec3(-.46, .58, .43)) * .42, .40, 1.27);
        float materialLight = dot(material, vec3(.2126, .7152, .0722));
        float tone = mix(clamp(bright, .035, .36), .12, .40);
        vec3 sceneTint = clamp(ink / max(bright, .035), vec3(.62), vec3(1.53));
        vec3 detailed = material * (.67 * tone / max(materialLight, .064) + .33) * mix(vec3(1.0), sceneTint, .56);
        ink = mix(ink, detailed * diffuse, surfaceMix * mix(.86, .67, era));
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
    ink *= exposure * relief * (1.0 - bridgeOcclusion() * .47) *
      mix(vec3(.86, .95, 1.05), vec3(1.08, 1.02, .90), lightFacing);
    ink += vec3(.012, .018, .019) * (1.0 - lightFacing);
    float blue = max(ink.b - ink.r, 0.0);
    ink += vec3(0.01, 0.04, 0.025) * blue;
    float valleyAir = 1.0 + (1.0 - vRelief.y) * .48;
    float airPath = max(0.0, distanceToEye - 1.1);
    float mist = (1.0 - exp(-airPath * haze * valleyAir)) * .73;
    ink = mix(ink, vec3(.165, .235, .254), mist * (1.0 - atlas * .67));
    float aerosol = valleyAerosol(vGround, distanceToEye);
    float towardLight = pow(max(0.0, dot(normalize(vGround - cameraPosition), sunDirection)), 3.0);
    ink = mix(ink, mix(vec3(.182, .229, .234), vec3(.39, .32, .22), towardLight), aerosol * .65);
    if (atlas > 0.001) {
      vec2 uv = (vGround.xz - atlasBounds.xy) / (atlasBounds.zw - atlasBounds.xy);
      vec2 edges = min(uv, 1.0 - uv);
      float rim = smoothstep(0.0, .070, min(edges.x, edges.y));
      float focus = texture2D(atlasMask, uv).r * rim;
      float earth = (.31 + slopeLight * .69) * (.36 + clamp(vGround.y / 5.7, 0.0, 1.0) * .64);
      vec3 surround = vec3(.017, .026, .023) + earth * vec3(.055, .072, .063);
      float reliefWeight = hasPanoramaRelief * rim * atlas;
      if (hasPanoramaRelief > .5) {
        vec3 feature = texture2D(panoramaRelief, vec2(uv.x, 1.0 - uv.y)).rgb;
        float sun = (feature.r - .5) * min(feature.b * 2.1, 1.0);
        float ridge = (feature.g - .5) * .40;
        vec2 cloudUv = vGround.xz * vec2(.0031, .0042) + vec2(time * .0031, -time * .0019);
        float cloudShade = smoothstep(.53, .84, terrainNoise(cloudUv) * .74 + terrainNoise(cloudUv * 2.2) * .26);
        float lit = clamp(1.0 + sun * 1.20 + ridge - cloudShade * .12, .56, 1.48);
        vec3 bounced = mix(vec3(.80, .95, 1.11), vec3(1.10, 1.00, .85), smoothstep(-.24, .22, sun));
        vec3 mountain = ink * lit * bounced + vec3(.022, .029, .022) * max(sun, 0.0);
        ink = mix(ink, mountain, reliefWeight * .94);
      }
      float contextFade = mix(.28, .06, focus);
      if (hasPanoramaForest > .5 && rim > .01) {
        float trees = texture2D(panoramaForest, vec2(uv.x, 1.0 - uv.y)).r;
        vec2 canopyPosition = vGround.xz * 1.35;
        float canopyWeight = 1.0 - smoothstep(.47, 1.34, length(fwidth(canopyPosition)));
        float groves = terrainNoise(canopyPosition * .71);
        float crowns = terrainNoise(canopyPosition * 2.2 + groves);
        float dapple = (groves - .5) * .20 + (crowns - .5) * canopyWeight * .19;
        ink *= 1.0 + trees * rim * atlas * dapple;
        ink += trees * rim * atlas * max(0.0, dapple) * vec3(.070, .123, .033);
      }
      ink = mix(ink, surround, atlas * contextFade);
      ink = mix(ink, vec3(.068, .100, .105), atlas * .17 *
        smoothstep(.84, 1.35, distanceToEye / max(1.0, atlasCameraDistance)) * (1.0 - earth * .57));
      float landmarkShadow = 0.0;
      for (int i = 0; i < 9; i++) {
        vec4 marker = landmarkShadows[i];
        vec2 offset = (vGround.xz - marker.xy) / max(1.0, marker.z);
        vec2 contact = mat2(.90, .44, -.44, .90) * offset;
        landmarkShadow = max(landmarkShadow, (1.0 - smoothstep(.18, .67, length(contact * vec2(.84, 1.46)))) * marker.w);
      }
      // Preserve the measured land cover and directional hillshade at continental scale.
      ink *= 1.0 - landmarkShadow;
      ink = mix(vec3(dot(ink, vec3(.2126,.7152,.0722))), ink, .91);

    }
    gl_FragColor = vec4(mix(ink, museumColor, clamp(museumRelief, 0.0, 1.0)), 1.0);
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
