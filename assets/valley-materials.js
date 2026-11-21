import * as THREE from './vendor/three.module.min.js';
import {finishBridgeSurface} from './bridge-materials.js?v=cinema-20261121';

const textures = new Map();
const root = new URL('./valley/', import.meta.url);
const textureLoader = new THREE.TextureLoader();

function texture(name, mirrored = false) {
  if (!textures.has(name)) {
    const url = new URL(name + '.webp', root);
    textures.set(name, textureLoader.loadAsync(url.href).then(tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.wrapS = tex.wrapT = mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
      tex.anisotropy = 8;
      return tex;
    }).catch(error => { textures.delete(name); throw error; }));
  }
  return textures.get(name);
}

const surfaces = {
  gorge_schist:['cliff','#b6b5a4',2.4],wet_schist:['cliff','#7e8880',2.2],schist_seam:['cliff','#8f9084',2.4],
  timber: ['elm', '#b3a18b', 2.8], wood: ['elm', '#eed1a7', 3.3], tile: ['tile','#c5c9bd',4.2],
  tilerib: ['tile','#aaa99d',3.2], lightstone: ['chisel','#dedace',1.5], stone: ['wall','#c0baac',3.5],
  plaster: ['lime','#dad1ba',4.1], rock: ['cliff','#b6b0a0',3.7], sand: ['flagstone','#d7bd92',2.5],
  earth: ['lime','#ad8c60',4.7], paper: ['lime','#c8bea9',3.5],paving:['flagstone','#c4c1b7',1.7],
  greybrick:['greybrick','#ced2cf',2.65], dressed_stone:['chisel','#e1ded5',1.2],
  chestnut:['elm','#a7715f',1.35],
  boat_oak:['field-oak','#e0be99',2.2], deckplank:['field-oak','#d4b69c',2.1],
  plankwall:['elm','#ac9478',1.3],limewash:['lime','#e5ded2',2.4],
  hillstone:['wall','#b5ada4',2.2], reedmat:['field-reed','#e8d1a1',1.2],
  coatblue:['field-cotton','#b9cad7',.34],coatslate:['field-cotton','#a2aca9',.34],
  coatlight:['field-canvas','#c7b6a3',.32],coatumber:['field-canvas','#9d826a',.36],
  trousers:['field-cotton','#8f989c',.28],capblue:['field-cotton','#b0bbcb',.26],
  bag:['field-canvas','#cfb08a',.24],bagflap:['field-canvas','#be9c71',.24],
  straw:['field-reed','#c3ad86',.30]
};
const solid = { mulecoat:'#705b43',muzzle:'#584a3b',fieldgrass:'#6d8246', firedclay:'#936b50',ink:'#46433a',packedearth:'#a09169',cropgreen:'#829052',cropgold:'#a49958',sailcloth:'#c9b99a',lampglass:'#e9d3a0',clockface:'#dfcca6', red:'#963c29', recess:'#282622', iron:'#494a44', water:'#456f65', snow:'#edf2eb',
  ripple:'#a1b1a3', cloth:'#7e7c6d',sedge:'#847440',skin:'#b69b7d',cotton:'#6b7469',uniform:'#434c48',
  amber_glass:'#8a7966',smoke_glass:'#515e5c',blue_glass:'#536b75',
  capbrim:'#424f5c',wraps:'#8d887c',sole:'#3d3832',shoe:'#4c4d47',hemp:'#a18b65',
  tarred:'#554335',elmtool:'#94764e',clay:'#987051',seam:'#677079',buttons:'#413a32',
  hair:'#282421',sealred:'#aa392b',book:'#a38254',pages:'#dcd0ae',brass:'#b79850',
  leather:'#685039',pencil:'#60482c' };

const urbanPlates=new Set(['zunyi','liping','hadapu','baxi','huining','jiangtai','chishui','dawei']);
const surveyCache=new Map();
function acquireSurvey(id) {
  let entry=surveyCache.get(id);
  if(!entry){
    const url=urbanPlates.has(id)?new URL('./cinema/ground/'+id+'.webp',import.meta.url):new URL(id+'.webp',root);
    entry={users:0,promise:textureLoader.loadAsync(url.href).then(t=>{
      t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.anisotropy=8;return t;
    })};surveyCache.set(id,entry);
  }
  entry.users++;
  return entry.promise.then(map=>({map,release(){
    if(--entry.users===0){surveyCache.delete(id);map.dispose();}
  }})).catch(e=>{if(surveyCache.get(id)===entry)surveyCache.delete(id);throw e;});
}
export async function landscapeMaterial(name, clock, sceneData={}) {
  if(name==='bridge_plank'){
    const map=await texture('field-oak',true);
    return new THREE.MeshStandardMaterial({map,color:'#b4ada3',roughness:.83,bumpMap:map,bumpScale:.007});
  }
  if(name==='jade_water'||name==='silt_water'){
    const plate=sceneData.surveyPlate||'gan';
    const [water,survey,bank]=await Promise.all([texture('river-ripples',true),acquireSurvey(plate),plate==='dadu-wide'?acquireSurvey('dadu'):null]);
    const mat=new THREE.MeshStandardMaterial({color:name==='silt_water'?'#877e56':'#508579',roughness:.35,metalness:.055});
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{surveyPlate:{value:survey.map},bankPlate:{value:bank?.map||survey.map},riverDetail:{value:water},flowTime:clock});
      shader.vertexShader='varying vec3 riverPoint; varying vec2 waterSurvey;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nriverPoint=position;waterSurvey=uv;');
      shader.fragmentShader='uniform sampler2D riverDetail,surveyPlate,bankPlate; uniform float flowTime; varying vec3 riverPoint;varying vec2 waterSurvey;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 uvRiver=riverPoint.xz;vec2 drift=flowTime*vec2(.012,.038);
        float r=dot(texture2D(riverDetail,uvRiver*.13+drift).rgb,vec3(.21,.71,.08));
        float q=dot(texture2D(riverDetail,mat2(.85,.52,-.52,.85)*uvRiver*.31-drift*.26).rgb,vec3(.21,.71,.08));
        float large=sin(uvRiver.x*.081+sin(uvRiver.y*.072))*.035;
        vec3 riverImage=texture2D(surveyPlate,clamp(waterSurvey,0.,1.)).rgb;
        ${bank ? `float across=uvRiver.x/56.;
        vec2 reach=vec2(.475+.085*across/sqrt(1.+across*across),.5+uvRiver.y/520.);
        riverImage=mix(texture2D(bankPlate,reach).rgb,riverImage,smoothstep(100.,228.,length(uvRiver)));
        riverImage=mix(vec3(.031,.105,.092),riverImage,.72);` : ''}
        float inPlate=1.-smoothstep(.42,.53,max(abs(waterSurvey.x-.5),abs(waterSurvey.y-.5)));
        diffuseColor.rgb=mix(diffuseColor.rgb,riverImage,inPlate*.90);
        diffuseColor.rgb*=.72+min(1.24,r*4.1+q*2.2)+large;
      `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec2 waves=vec2(cos(uvRiver.x*1.6+uvRiver.y*.73+flowTime*.8),sin(uvRiver.y*1.03-uvRiver.x*.38+flowTime*.52));
        normal=normalize(normal+mat3(viewMatrix)*vec3(waves.x*.065,0.,waves.y*.085));
      `);
    };
    mat.customProgramCacheKey=()=>bank?'dadu-current':'survey-current';
    mat.addEventListener('dispose',survey.release);if(bank)mat.addEventListener('dispose',bank.release);return mat;
  }
  if (name.startsWith('face_')) {
    const map=await texture(name==='face_guide'?'guide-face':'worker-face');
    return new THREE.MeshStandardMaterial({map,color:'#fff4ec',roughness:.86});
  }
  if (name.startsWith('ground_')) {
    const plate=sceneData.surveyPlate||name.split('__')[1]||'town';
    const [rock,soil,water,survey,bank]=await Promise.all([texture('cliff'),texture('bank-shingle',true),
      texture('river-ripples',true),acquireSurvey(plate),plate==='dadu-wide'?acquireSurvey('dadu'):null]);
    const ground=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0});
    ground.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{surveyPlate:{value:survey.map},bankPlate:{value:bank?.map||survey.map},stone:{value:rock},sediment:{value:soil},currentMap:{value:water},airTime:clock});
      shader.vertexShader='attribute vec2 atlasRegistration; varying vec2 plateUv; varying vec3 terrainPoint; varying vec3 groundN; varying float isWater;\n'+
        shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainPoint=position;plateUv=atlasRegistration;groundN=normal;isWater=uv.x;');
      shader.fragmentShader='uniform sampler2D stone,sediment,currentMap,surveyPlate,bankPlate;varying vec2 plateUv;uniform float airTime; varying vec3 terrainPoint; varying vec3 groundN; varying float isWater;\n'+
        shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec3 N=normalize(groundN);vec3 P=terrainPoint;
          vec2 border=min(plateUv,1.-plateUv);
          float edge=smoothstep(.0,.065,min(border.x,border.y));
          vec3 albedo=texture2D(surveyPlate,clamp(plateUv,0.,1.)).rgb;
          ${bank ? 'albedo=mix(texture2D(bankPlate,clamp(vec2(.48,.5)+P.xz/455.,0.,1.)).rgb,albedo,smoothstep(82.,225.,length(P.xz)));' : ''}
          float viewRange=distance(cameraPosition,P);
          float registered=edge*mix(.38,.94,smoothstep(8.,88.,viewRange))*smoothstep(.20,.80,abs(N.y));
          diffuseColor.rgb=mix(diffuseColor.rgb,albedo*1.13,registered);
          vec2 st=abs(N.y)>.64?P.xz:(abs(N.x)>abs(N.z)?P.zy:P.xy);
          float cliffAmount=smoothstep(.13,.65,1.-abs(N.y));
          vec3 grit=texture2D(sediment,st*.37).rgb;
          vec3 bedding=texture2D(stone,st*.145+vec2(.28,.61)).rgb;
          float variation=dot(grit,vec3(.22,.69,.09));
          diffuseColor.rgb*=.72+min(1.3,variation*3.)*.56;
          diffuseColor.rgb=mix(diffuseColor.rgb,bedding*.84,cliffAmount*.76);
          if(isWater>.01){
            vec2 drift=vec2(.016,.048)*airTime;
            vec3 current=texture2D(currentMap,P.xz*.085+drift).rgb*.6+
              texture2D(currentMap,mat2(.90,-.435,.435,.90)*P.xz*.193+drift*.63).rgb*.4;
            float surface=dot(current,vec3(.21,.70,.09));
            diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*(.65+surface*3.7)+current*.16,smoothstep(.08,.92,isWater));
          }
        `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.91,.36,isWater);');
    };
    ground.addEventListener('dispose',survey.release);if(bank)ground.addEventListener('dispose',bank.release);
    ground.customProgramCacheKey=()=>bank?'gorge-survey-film':'survey-film';
    return ground;
  }
  const spec=surfaces[name];
  const iron=/^iron(?:_|$)/.test(name);
  const mat=new THREE.MeshStandardMaterial({color:spec?.[1] || (iron?solid.iron:solid[name]) || '#a49679',roughness:name==='water'?.32:iron?.63:.87,
    side:THREE.DoubleSide,metalness:iron?.42:0});
  if (name.endsWith('_glass')) { mat.roughness=.23;mat.metalness=.07; }
  if(iron)finishBridgeSurface(mat,'iron');
  if (!spec) return mat;
  const map=await texture(spec[0]);
  mat.onBeforeCompile = shader => {
    shader.uniforms.scanned = {value:map};
    shader.uniforms.materialSpan = {value:spec[2]};
    shader.vertexShader = 'varying vec3 surfacePoint; varying vec3 faceAxis;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nsurfacePoint=position;faceAxis=abs(normal);');
    shader.fragmentShader = 'uniform sampler2D scanned; uniform float materialSpan; varying vec3 surfacePoint; varying vec3 faceAxis;\n' +
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 uvWall = faceAxis.y>=max(faceAxis.x,faceAxis.z) ? surfacePoint.xz :
          (faceAxis.x>faceAxis.z ? surfacePoint.zy : surfacePoint.xy);
        ${name==='tile' ? 'uvWall=faceAxis.x>faceAxis.z ? surfacePoint.zx : surfacePoint.xz;' : ''}
        vec3 patina=texture2D(scanned,uvWall/materialSpan).rgb;
        diffuseColor.rgb*=mix(vec3(.83),patina*1.48,.92);
      `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 screenX=dFdx(-vViewPosition),screenY=dFdy(-vViewPosition);
        vec3 tangentX=cross(screenY,normal),tangentY=cross(normal,screenX);
        float area=dot(screenX,tangentX);
        float grainHeight=.019*dot(patina,vec3(.21,.72,.07));
        if(abs(area)>1e-9) normal=normalize(abs(area)*normal-sign(area)*
          (dFdx(grainHeight)*tangentX+dFdy(grainHeight)*tangentY));
      `);
  };
  mat.customProgramCacheKey=()=>name==='tile' ? 'surveyTile' : 'surveySurface';
  return mat;
}

