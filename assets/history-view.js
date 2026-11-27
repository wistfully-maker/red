import * as THREE from './vendor/three.module.min.js';
import { loadModel } from './scene-models.js?v=cinema-20261121';
import { landscapeMaterial } from './valley-materials.js?v=cinema-20261121';
import { plantedGrove } from './green-groves.js?v=cinema-20261121';
import { ExhibitFilm } from './exhibit-film.js?v=luding-final-20261124-6';
import { LudingCurrent } from './luding-current.js?v=luding-final-20261124-6';
import { makeValleyEnvironment } from './bridge-materials.js?v=cinema-20261121';
import { tableaux } from './scene-studies.js?v=cinema-20261121';

// Captions describe the depicted scene, including sites represented by a regional POI.
export const historyScenes = {
  ruijin: ['云石山古寺', '沿石阶上山，观察寺院怎样落在独立的山头上。'],
  yudu: ['于都河浮桥', '并列的木船托起桥板，两岸通过临时浮桥相连。'],
  xiangjiang: ['湘江渡口', '木船停在桂北江岸。场景取材于湘江沿线渡口。'],
  liping: ['翘街上的院落', '沿石板街辨认封火墙、瓦屋和院落的进深。'],
  zunyi: ['遵义会议会址', '环绕主楼，可见两层砖木结构与连续回廊。'],
  chishui: ['土城河埠', '从石阶码头向上看，街屋沿赤水河岸展开。'],
  jiaoping: ['金沙江船渡', '渡船与岩壁间的洞窟，勾勒旧渡口的尺度。'],
  anshun: ['大渡河滩上的渡船', '在卵石滩边，观察船身、河岸和渡口的关系。'],
  luding: ['泸定铁索桥', '转动模型，沿石桥台、桥亭与悬垂铁索观察桥身。'],
  jiajin: ['夹金山雪脊', '行人穿过积雪山脊，山道随垭口折转。'],
  dawei: ['达维会师桥', '片石桥台与圆木梁架起山溪上的通路。'],
  lianghekou: ['两河口关帝庙', '川西山间庙院，呈现两河口会议的环境。'],
  songpan: ['川西北草地', '水洼与草墩相间，队伍穿行于高原湿地。'],
  baxi: ['巴西地区寺院', '取材于九月二日班佑寺会议的寺院场景。'],
  lazikou: ['腊子口峡谷', '溪流从两壁间通过，木桥横跨狭窄河谷。'],
  hadapu: ['哈达铺街市', '街铺、门廊与报纸构成休整途中的集镇一景。'],
  wuqi: ['吴起镇窑院', '窑洞依黄土坡面而开，院落向沟谷展开。'],
  huining: ['西津门', '城墙券洞上托起门楼，标出会宁古城西口。'],
  jiangtai: ['将台堡土城', '夯土堡墙依台地而建，城门通向堡内。']
};

export const detailViews = {
  luding: {label:'桥亭近景',x:49,y:10.75,z:0,distance:22,yaw:.86,pitch:.34},
  zunyi: {label:'回廊近景',x:-1.4,y:3.70,z:2.5,distance:11.3,yaw:-.51,pitch:.20}
};

function hasEmbeddedFinish(material) {
  const data=material.userData;
  return data.ludingFinish||data.fieldFigureFinish||data.nativeLandscapeFinish;
}

function disposeModel(root) {
  if (!root) return;
  const geometries = new Set(), materials = new Set();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    if(mesh.userData.sharedTree){mesh.dispose();return;}
    geometries.add(mesh.geometry);
    for (const material of [].concat(mesh.material)) materials.add(material);
  });
  root.removeFromParent();
  geometries.forEach(geometry => geometry.dispose());
  const nativeMaps=new Set();
  materials.forEach(material=>{
    if(hasEmbeddedFinish(material))for(const item of Object.values(material))if(item?.isTexture)nativeMaps.add(item);
    material.dispose();
  });
  nativeMaps.forEach(t=>t.dispose());
}

function valleyMist(span, clock, density) {
  const mist = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    uniforms:{airTime:clock, density:{value:density}}, transparent:true, depthWrite:false, side:THREE.DoubleSide,
    vertexShader:`varying vec2 p; varying vec2 ground;
      void main(){p=uv; vec4 w=modelMatrix*vec4(position,1.); ground=w.xz;
      gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec2 p; varying vec2 ground; uniform float airTime; uniform float density;
      float hash(vec2 q){return fract(sin(dot(q,vec2(41.3,289.1)))*43758.54);}
      float haze(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec2 q=p*5.+ground*.0007+airTime*vec2(.023,-.013);
        float n=.55*haze(q)+.28*haze(q*2.04)+.17*haze(q*4.14);
        float edge=1.-smoothstep(.21,.52,length(p-.5));
        gl_FragColor=vec4(.83,.87,.83,edge*smoothstep(.32,.75,n)*density);
        #include <colorspace_fragment>
      }`
  });
  const geometry = new THREE.PlaneGeometry(1,1);
  for (const [x,y,z,w,d] of [[-.34,.12,-.21,.85,.49],[.37,.093,.24,.75,.46],[-.27,.074,.39,.52,.30]]) {
    const cloud=new THREE.Mesh(geometry,material);
    cloud.rotation.x=-Math.PI/2;
    cloud.position.set(x*span,y*span,z*span);
    cloud.scale.set(w*span,d*span,1);
    mist.add(cloud);
  }
  return mist;
}

export class HistoryView {
  constructor(stage) {
    this.stage = stage;
    this.camera = new THREE.PerspectiveCamera(42, 1, .08, 2800);
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
    this.renderer.setClearColor(0,0);
    this.film=new ExhibitFilm(this.renderer);
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate=false;
    this.renderer.domElement.setAttribute('aria-hidden','true');
    stage.append(this.renderer.domElement);
    this.skyFill=new THREE.HemisphereLight(0xdce7ed,0x73745d,.82);this.scene.add(this.skyFill);
    this.sun=new THREE.DirectionalLight(0xffe0ac,2.25);
    this.scene.environment=makeValleyEnvironment(this.renderer,new THREE.Vector3(-.82,.48,.27).normalize());
    this.defaultEnvironment=this.scene.environment;
    this.scene.environmentIntensity=.53;
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);
    this.sun.shadow.bias=-.00012;
    this.scene.add(this.sun,this.sun.target);
    this.clock={value:0};
    this.riverClock={value:0};
    this.serial=0;
    this.pointers=new Map();
    this.bindInput();
    new ResizeObserver(()=>this.render()).observe(stage);
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.animate = time => {
      this.frame=0;
      if (!this.needsAnimation()) return;
      const interval=this.walkTransit||this.descent?0:this.walk?(this.width<720?42:32):65;
      if (!this.last || time-this.last>interval) {
        const elapsed=this.last?Math.min(.12,(time-this.last)*.001):0;
        if(!this.reduced.matches)this.clock.value+=elapsed;
        if(this.riverPlaying&&!this.clay)this.riverClock.value+=elapsed;
        this.render();
        this.last=time;
      }
      this.frame=requestAnimationFrame(this.animate);
    };
    document.addEventListener('visibilitychange',()=>this.schedule());
    this.reduced.addEventListener('change',()=>{
      this.last=0;
      if(this.reduced.matches){this.descent=null;this.walkTransit=null;}
      this.render();this.schedule();
    });
  }

  get riverPlaying(){return !!this.current&&!this.reduced.matches;}

  needsAnimation(){
    if(!this.active||!this.model||this.pausedForReading||document.hidden)return false;
    if(!this.current)return !this.reduced.matches;
    return this.riverPlaying&&!this.clay||!this.reduced.matches&&!!(this.descent||this.walkTransit||this.flyover);
  }

  schedule() {
    if (this.needsAnimation()&&!this.frame)
      this.frame=requestAnimationFrame(this.animate);
  }

  pauseForReading(pause){
    this.pausedForReading=pause;
    if(pause){cancelAnimationFrame(this.frame);this.frame=0;this.walkTransit=null;}
    else this.schedule();
  }

  async show(id, flyover=false) {
    const serial=++this.serial;
    this.active=true;
    this.setClay(false);
    this.flyover=flyover;
    if (this.model && this.id===id) {
      const lastView=this.eyeState;
      this.reset();
      if (!flyover && lastView && !this.reduced.matches)
        this.descent={from:lastView,start:performance.now()};
      this.schedule(); return true;
    }
    this.current?.dispose();this.current=null;
    disposeModel(this.model);
    if (this.guideAsset) this.guideAsset.visible=false;
    this.model=null;
    this.renderer.clear();
    const model=await loadModel('landscapes/'+id,'numbered-people-20261128');
    try {
      const mapped=new Map();
      let ground;
      model.traverse(mesh=>{if(mesh.isMesh && mesh.material.name.startsWith('ground_')) ground=mesh;});
      if (!ground) throw Error('Missing continuous terrain');
      const authored=!!ground.userData.authoredLuding;
      if(!authored){
        const registration=ground.geometry.getAttribute('uv1');
        if(!registration) throw Error('Missing registered ground coordinates');
        ground.geometry.setAttribute('atlasRegistration',registration);
      }
      let walk,sky,river;
      if(authored){
        this.riverStudio??=Promise.all([
          fetch(new URL('./luding/walk.json?v=luding-final-20261124-6',import.meta.url)).then(r=>{if(!r.ok)throw Error('历史现场机位未载入');return r.json();}),
          new THREE.TextureLoader().loadAsync(new URL('./luding/surfaces/sky.jpg',import.meta.url).href).then(t=>{
            t.colorSpace=THREE.SRGBColorSpace;t.mapping=THREE.EquirectangularReflectionMapping;return t;})
        ]).catch(error=>{this.riverStudio=null;throw error;});
        [walk,sky]=await this.riverStudio;
      }
      model.traverse(mesh=>{
        if (!mesh.isMesh) return;
        const name=mesh.material.name;
        if (!authored&&!hasEmbeddedFinish(mesh.material)&&!mapped.has(name)) mapped.set(name,landscapeMaterial(name,this.clock,ground.userData));
      });
      const resolved=await Promise.allSettled([...mapped].map(async ([name,value])=>[name,await value]));
      const materials=new Map(resolved.filter(result=>result.status==='fulfilled').map(result=>result.value));
      const failure=resolved.find(result=>result.status==='rejected');
      if (failure) {
        materials.forEach(mat=>mat.dispose());
        throw failure.reason;
      }
      const original=new Set();
      let nearIron=null,farIron=null;
      const guides=[];
      const cutaway=[];
      model.traverse(mesh=>{
        if (!mesh.isMesh) return;
        const name=mesh.material.name;
        if (name==='iron_near') nearIron=mesh;
        if (name==='iron_far') farIron=mesh;
        if (mesh.userData.journalGuide) {mesh.visible=false;guides.push(mesh);}
        if(mesh.userData.roomCut)cutaway.push(mesh);
        if(authored){
          mesh.material.userData.ludingFinish=true;
          if(['riparian_crown','near_leaf','path_verge'].includes(name)){
            mesh.material.alphaTest=name==='riparian_crown'?.39:.34;
            mesh.material.transparent=false;mesh.material.depthWrite=true;
          }
          if(name==='jade_water')river=mesh;
          // The painted face is only millimetres above its backing board.
          // Bias its depth forward so the gold strokes stay intact at close range.
          if(name==='pavilion_sign'||name==='Dadu alluvial verge'){
            mesh.material.polygonOffset=true;
            mesh.material.polygonOffsetFactor=-2;mesh.material.polygonOffsetUnits=-2;
          }
          if(name==='Dadu alluvial verge'){
            // Blender exports the shore's opacity ramp as COLOR_1. Three.js
            // consumes COLOR_0, so use the authored fade for this surface only.
            const fade=mesh.geometry.getAttribute('color_1');
            if(fade)mesh.geometry.setAttribute('color',fade);
            mesh.material.vertexColors=true;mesh.material.transparent=true;
          }
          for(const m of ['map','normalMap','roughnessMap'])if(mesh.material[m])mesh.material[m].anisotropy=8;
        }else if(!hasEmbeddedFinish(mesh.material)){
          original.add(mesh.material);
          mesh.material=materials.get(name);
        }
        mesh.castShadow=mesh!==ground && !mesh.userData.landscapeSurface && name!=='canopy_side' && name!=='jade_water' && !(authored&&['pavilion_sign','Dadu alluvial verge'].includes(name));
        if(mesh.userData.landscapeSurface){
          mesh.material.polygonOffset=true;mesh.material.polygonOffsetFactor=-4;mesh.material.polygonOffsetUnits=-4;
          mesh.material.normalScale?.setScalar(.2);
        }
        mesh.receiveShadow=!mesh.userData.landscapeSurface&&!(authored&&name==='pavilion_sign');
      });
      original.forEach(mat=>mat.dispose());
      const grove=await plantedGrove(ground.userData);
      if(grove)model.add(grove);
      if (this.serial!==serial) { disposeModel(model); return false; }
      this.grove=grove;
      this.model=model; this.id=id;
      this.walk=walk;this.current=river?new LudingCurrent(river,this.riverClock,ground.userData.riverObstacles):null;
      this.localSky=sky;this.walkTransit=null;
      this.scene.background=sky||new THREE.Color(0xb5beb0);
      this.scene.environment=sky||this.defaultEnvironment;
      this.scene.environmentIntensity=sky?.48:.53;this.skyFill.intensity=sky?.44:.82;
      this.sun.intensity=sky?3.45:2.25;this.sun.color.setHex(sky?0xffdfb4:0xffe0ac);
      this.nearIron=nearIron;this.farIron=farIron;
      this.guides=guides;
      this.cutaway=cutaway;
      this.fieldShots={};
      const metadata=ground.userData;
      if(walk)for(const stop of walk.stops)this.fieldShots[stop.id]=this.bridgeEye(stop.metres);
      if(metadata.tableauView){
        const [x,y,z,distance,yaw,pitch]=metadata.tableauView;
        this.fieldShots.tableau={x,y,z,distance,yaw,pitch};
      }
      if(metadata.residentView){
        const [x,y,z,distance,yaw,pitch]=metadata.residentView;
        this.fieldShots.resident={x,y,z,distance,yaw,pitch};
      }
      if (metadata.recorderAnchor) {
        const [x,y,z,turn]=metadata.recorderAnchor;
        this.fieldShots.guide={x,y,z,distance:2.25,yaw:turn+.17,pitch:.16};
      }
      if (metadata.boatView) {
        const [x,y,z]=metadata.boatView;
        this.fieldShots.boat={x,y,z,distance:metadata.hullDimensions[0]*1.60,yaw:.56,pitch:.47};
        const [cx,cy,cz]=metadata.reachCentre;
        this.fieldShots.reach={x:cx,y:cy,z:cz,distance:metadata.riverWidth*1.76,yaw:.11,pitch:1.29,wideReach:true};
      }
      this.shot=ground.userData.framingWidth;
      this.span=ground.userData.plateWidth;
      if(!authored)model.add(valleyMist(this.span,this.clock,['wuqi','huining','jiangtai'].includes(id)?.16:.40));
      this.baseTarget=ground.userData.targetHeight;
      this.scaleData=metadata;
      this.shadowRegion='';
      this.scene.add(model);
      this.scene.fog=null;
      this.reset();
      this.schedule();
      return true;
    } catch (error) {
      disposeModel(model);
      throw error;
    }
  }

  hide() {
    this.active=false;
    if(this.guideAsset)this.guideAsset.visible=false;
    this.serial++;
    cancelAnimationFrame(this.frame);
    this.frame=0;
    this.pointers.clear();
  }

  reset() {
    this.focusPoint=null;
    this.cutaway?.forEach(mesh=>mesh.visible=true);
    this.panX=this.id==='zunyi'?-2.2:0;
    this.panZ=0;
    this.targetY=this.baseTarget;
    this.detail=null;
    this.walkTransit=null;
    if(this.guideAsset)this.guideAsset.visible=false;
    this.guides?.forEach(mesh=>mesh.visible=false);
    this.shadowRegion='';
    this.descent=null;
    this.yaw=this.flyover ? -.37 : ({yudu:.60,luding:.60,hadapu:.69,wuqi:.21}[this.id] ?? .38);
    this.pitch=this.flyover ? .82 : ({luding:.27,songpan:.84,lazikou:.75,jiajin:.68,wuqi:.47}[this.id] ?? .59);
    this.zoom=1;
    this.render();
  }

  inspectDetail(kind='detail') {
    this.focusPoint=null;
    const shot=kind==='detail' ? detailViews[this.id] : this.fieldShots?.[kind];
    if (!shot || !this.active || this.flyover) return;
    const from=this.eyeState;
    const walking=this.walk?.stops.find(s=>s.id===kind);
    const previous=this.detail?.onDeck?this.walkMetres:null;
    this.walkTransit=null;
    this.detail=shot;
    this.cutaway?.forEach(mesh=>mesh.visible=kind!=='tableau');
    if(this.guideAsset)this.guideAsset.visible=false;
    if(kind==='guide') this.placeRecorder();
    this.guides?.forEach(mesh=>mesh.visible=kind==='guide');
    this.shadowRegion='';
    this.panX=shot.x;this.panZ=shot.z;this.targetY=shot.y;
    this.yaw=shot.yaw;this.pitch=shot.pitch;this.zoom=1;
    this.descent=from && !this.reduced.matches ? {from,start:performance.now()} : null;
    if(walking){
      this.descent=null;
      this.walkMetres=walking.metres;
      if(previous!=null&&previous!==walking.metres&&!this.reduced.matches){
        this.walkTransit={start:performance.now(),from:previous,to:walking.metres,duration:Math.min(2400,700+20*Math.abs(previous-walking.metres))};
      }
    }
    this.render();
    this.schedule();
  }

  bridgeEye(metres) {
    const w=this.walk,half=w.span/2,stops=w.stops;
    const b=stops.find(s=>s.metres>metres)||stops.at(-1),a=stops[Math.max(0,stops.indexOf(b)-1)];
    const raw=THREE.MathUtils.clamp((metres-a.metres)/(b.metres-a.metres),0,1),t=raw*raw*(3-2*raw);
    const x=metres-half,eye=w.floorAtCentre+w.sag*(Math.min(half,Math.abs(x))/half)**2+w.eyeHeight,distance=7.5;
    const pitch=THREE.MathUtils.lerp(a.pitch,b.pitch,t);
    const angle=b.yaw-a.yaw, yaw=a.yaw+Math.atan2(Math.sin(angle),Math.cos(angle))*t;
    const z=metres<=stops[1].metres?THREE.MathUtils.lerp(stops[0].z,stops[1].z,t):
      THREE.MathUtils.lerp(stops[1].z,stops.at(-1).z,THREE.MathUtils.smoothstep(metres,w.span,stops.at(-1).metres));
    const reach=distance*Math.cos(pitch);
    return {x:x-reach*Math.sin(yaw),y:eye-distance*Math.sin(pitch),z:z-reach*Math.cos(yaw),eye:[x,eye,z],focus:1/THREE.MathUtils.lerp(1/a.focus,1/b.focus,t),
      distance,yaw,pitch,onDeck:true};
  }

  walkBridge(metres) {
    this.focusPoint=null;
    if(!this.active||this.id!=='luding'||!this.detail?.onDeck)return;
    this.walkTransit=null;this.walkMetres=THREE.MathUtils.clamp(metres,0,this.walk.stops.at(-1).metres);
    const shot=this.bridgeEye(this.walkMetres);
    this.descent=null;this.detail=shot;this.panX=shot.x;this.panZ=shot.z;
    this.targetY=shot.y;this.yaw=shot.yaw;this.pitch=shot.pitch;this.zoom=1;
    this.render();
    this.stage.dispatchEvent(new CustomEvent('walk-position',{detail:this.walkMetres}));
  }

  async placeRecorder() {
    const serial=this.serial;
    try {
      this.guideLoading??=loadModel('journal-recorder','returned-recorder-20261126').then(asset=>{
        asset.traverse(part=>{if(part.isMesh){
          const thin=['paper','ink'].includes(part.userData.journalSurface);
          part.castShadow=!thin&&!part.userData.journalMicrodetail;part.receiveShadow=!thin;
          if(part.userData.journalSurface==='ink'){
            part.material.polygonOffset=true;part.material.polygonOffsetFactor=-1;part.material.polygonOffsetUnits=-1;
          }
        }});
        asset.visible=false;this.scene.add(asset);this.guideAsset=asset;return asset;
      }).catch(error=>{this.guideLoading=null;throw error;});
      const asset=await this.guideLoading;
      if (!this.active || serial!==this.serial || this.detail!==this.fieldShots.guide) return;
      const [x,y,z,angle]=this.scaleData.recorderAnchor;
      asset.position.set(x,y-1.14,z);asset.rotation.y=angle;asset.visible=true;
      if(this.clay)this.shadeClay(asset,true);
      this.shadowRegion='';this.render();
      this.stage.dataset.guide='ready';
    } catch(error) {
      if(serial!==this.serial || this.detail!==this.fieldShots.guide)return;
      this.reset();this.stage.dispatchEvent(new CustomEvent('guide-load-error'));
    }
  }

  shadeClay(root,enabled) {
    if(!root)return;
    this.clayPalette??=new Map();
    root.traverse(mesh=>{
      if(!mesh.isMesh || mesh.material.isShaderMaterial)return;
      if(!enabled){
        if(mesh.userData.originalFinish){mesh.material=mesh.userData.originalFinish;delete mesh.userData.originalFinish;}
        return;
      }
      if(mesh.userData.originalFinish)return;
      const original=mesh.material;
      const foliage=original.alphaTest>0 && original.map;
      const ground=mesh.userData.framingWidth!==undefined;
      const key=foliage?original.map.uuid:ground?'ground':'solid';
      if(!this.clayPalette.has(key)){
        const mat=new THREE.MeshStandardMaterial({color:ground?'#a8a39a':'#d5ccc0',
          side:original.side,roughness:.88,metalness:0});
        if(foliage){
          mat.map=original.map;mat.alphaTest=original.alphaTest;
          mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
            'diffuseColor.a *= texture2D(map,vMapUv).a;');};
        }
        this.clayPalette.set(key,mat);
      }
      mesh.userData.originalFinish=original;mesh.material=this.clayPalette.get(key);
    });
  }

  setClay(enabled) {
    this.clay=enabled;
    this.shadeClay(this.model,enabled);this.shadeClay(this.guideAsset,enabled);
    if(this.model){
      this.model.traverse(o=>{if(o.isMesh&&o.material.isShaderMaterial)o.visible=!enabled;});
      this.scene.background=enabled?new THREE.Color(0xc7c3bb):this.localSky||new THREE.Color(0xb5beb0);
    }
    this.shadowRegion='';this.render();
this.schedule();
  }

  magnify(factor) {
    this.descent=null;
    this.zoom=THREE.MathUtils.clamp(this.zoom*factor,.59,3.5);
    this.render();
  }

  render() {
    if (!this.active || !this.model) return;
    const w=this.stage.clientWidth, h=this.stage.clientHeight;
    if (!w || !h) return;
    if (w!==this.width || h!==this.height) {
      this.width=w; this.height=h;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65, Math.sqrt(3400000/(w*h))));
      this.renderer.setSize(w,h,false);
    }
    const aspect=w/h;
    let distance=(this.flyover ? this.span*.43 : this.shot/(.83*Math.min(1.55,Math.max(.80,aspect))))/this.zoom;
    // The long, narrow bridge needs a diagonal in portrait, with both bridgeheads
    // inside the frame. Blend the authored overview as the stage is resized.
    const bridgeOverview=this.walk&&!this.detail&&!this.flyover;
    const portrait=bridgeOverview?THREE.MathUtils.clamp((1.1-aspect)/.55,0,1):0;
    const mother=bridgeOverview&&this.scaleData.keyframeView;
    const motherBlend=mother&&w>720?THREE.MathUtils.clamp((aspect-.8)/.6,0,1):0;
    this.overviewBlend=motherBlend;
    if(bridgeOverview)distance=(THREE.MathUtils.lerp(140,mother?mother[3]:140,motherBlend)+95*portrait)/this.zoom;
    if (this.detail) distance=this.detail.distance/(this.detail.onDeck?1:this.zoom)*(aspect<.8&&!this.detail.onDeck?(this.detail.wideReach?1.55:1.28):1);
    this.camera.fov=this.detail?.onDeck?(aspect<.8?THREE.MathUtils.lerp(64,49,Math.min(1,aspect/.8)):42)/this.zoom:42;
    if(motherBlend){
      const authored=THREE.MathUtils.degToRad(this.scaleData.keyframeVerticalFov||42);
      // Retain the 1440 × 900 composition in narrower desktop viewports,
      // with four percent of breathing room on either side of the subject.
      const fit=.92*Math.min(1,aspect/1.6);
      const framed=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(authored/2)/fit));
      this.camera.fov=THREE.MathUtils.lerp(42,framed,motherBlend);
    }
    let offsetY=0;
    if(this.detail && this.detail===this.fieldShots?.resident){
      // Keep the checked eye position; widen the lens to clear the lower reading panel.
      this.camera.fov=50;
      offsetY=h*.075;
    }
    if(bridgeOverview && aspect<.8 && h<800){
      const stageTop=this.stage.getBoundingClientRect().top;
      const top=document.querySelector('.scene-title').getBoundingClientRect().bottom-stageTop+20;
      const bottom=Math.min(document.querySelector('.model-foot').getBoundingClientRect().top,
        document.getElementById('modelStatus').getBoundingClientRect().top)-stageTop-24;
      const available=Math.max(h*.2,bottom-top);
      distance=Math.max(distance,55*h/(available*2*Math.tan(this.camera.fov*Math.PI/360))/this.zoom);
      offsetY=h*.5-(top+bottom)*.5;
    }
    if(this.detail?.wideReach && aspect<.85){
      const top=document.querySelector('.scene-title').getBoundingClientRect().bottom+23;
      const bottom=document.querySelector('.model-foot').getBoundingClientRect().top-28;
      const available=Math.max(h*.19,bottom-top);
      const tangent=2*Math.tan(this.camera.fov*Math.PI/360);
      distance=Math.max(distance,this.scaleData.riverWidth*h/(available*tangent)*1.25/this.zoom);
      offsetY=h*.5-(top+bottom)*.5;
    }
    let orbit=this.yaw+portrait*.52+(mother?mother[4]-.60:0)*motherBlend+(this.flyover && !this.reduced.matches ? .055*Math.sin(this.clock.value*.105) : 0);
    let pitch=Math.min(1.46,this.pitch+portrait*.28+(mother?mother[5]-.27:0)*motherBlend);
    let aimX=this.panX,aimY=this.targetY,aimZ=this.panZ;
    if(motherBlend){aimX+=mother[0]*motherBlend;aimY+=(mother[1]-this.baseTarget)*motherBlend;aimZ+=mother[2]*motherBlend;}
    if(this.walkTransit){
      const transit=this.walkTransit,u=Math.min(1,(performance.now()-transit.start)/transit.duration),t=u*u*(3-2*u);
      this.walkMetres=THREE.MathUtils.lerp(transit.from,transit.to,t);
      this.detail=this.bridgeEye(this.walkMetres);
      aimX=this.panX=this.detail.x;aimY=this.targetY=this.detail.y;aimZ=this.panZ=this.detail.z;
      orbit=this.yaw=this.detail.yaw;pitch=this.pitch=this.detail.pitch;
      const halfMetre=Math.round(this.walkMetres*2)/2;
      if(halfMetre!==this.indicatedMetres){
        this.indicatedMetres=halfMetre;this.stage.dispatchEvent(new CustomEvent('walk-position',{detail:halfMetre}));
      }
      if(u===1)this.walkTransit=null;
    }
    if (this.descent) {
      const u=Math.min(1,(performance.now()-this.descent.start)/1700), t=u*u*(3-2*u);
      const [d,p,y,x,height,z]=this.descent.from;
      distance=THREE.MathUtils.lerp(d,distance,t);pitch=THREE.MathUtils.lerp(p,pitch,t);
      orbit=THREE.MathUtils.lerp(y,orbit,t);
      aimX=THREE.MathUtils.lerp(x,aimX,t);aimY=THREE.MathUtils.lerp(height,aimY,t);aimZ=THREE.MathUtils.lerp(z,aimZ,t);
      if (u>=1) this.descent=null;
    }
    this.distance=distance;
    this.eyeState=[distance,pitch,orbit,aimX,aimY,aimZ];
    const closeIron=this.nearIron && distance<72;
    if (this.nearIron) {
      this.nearIron.visible=closeIron;
      if (this.farIron) this.farIron.visible=!closeIron;
    }
    // Fit the sun's depth map to this stretch of the valley. Quantised
    // extents keep the cast shadows steady as the camera glides or pans.
    const reach=2**Math.ceil(Math.log2(Math.max(this.walk?40:6,distance*.82)));
    const cell=reach/8;
    const sx=Math.round(aimX/cell)*cell, sz=Math.round(aimZ/cell)*cell;
    const sy=Math.round(aimY/cell)*cell;
    const region=[reach,sx,sy,sz,Boolean(closeIron)].join('/');
    if (this.shadowRegion!==region) {
      this.shadowRegion=region;
      this.sun.target.position.set(sx,sy,sz);
      if(this.walk)this.sun.position.set(sx-reach*.8,sy+reach*1.7,sz+reach*2.1);
      else this.sun.position.set(sx-reach*2.6,sy+reach*1.74,sz+reach*.94);
      Object.assign(this.sun.shadow.camera,{left:-reach,right:reach,top:reach,bottom:-reach,near:.1,far:reach*7.5});
      this.sun.shadow.normalBias=Math.min(.060,reach*.00047);
      this.sun.shadow.camera.updateProjectionMatrix();
      this.renderer.shadowMap.needsUpdate=true;
    }
    this.camera.aspect=aspect;
    this.camera.near=Math.max(.035,distance/1100);
    this.camera.far=this.span*5.4;
    if (offsetY) this.camera.setViewOffset(w,h,0,offsetY,w,h);
    else if(this.camera.view?.enabled)this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.camera.position.set(aimX+distance*Math.sin(orbit)*Math.cos(pitch),aimY+distance*Math.sin(pitch),
      aimZ+distance*Math.cos(orbit)*Math.cos(pitch));
    this.camera.lookAt(aimX,aimY,aimZ);
    this.camera.updateMatrixWorld();
    this.grove?.userData.update(this.camera,w,h);
    if(this.current&&!this.clay)this.current.update(this.renderer,this.scene,this.camera,w,h);
    const focus=this.walk&&this.detail&&!this.clay?(this.detail.focus||distance):0;
    this.film.draw(this.scene,this.camera,{span:this.walk?445:this.span,clay:this.clay,strength:this.clay?.35:1,focus,focusPoint:this.focusPoint});
    const marker=document.getElementById('objectMarker'), subject=this.fieldShots?.tableau;
    if(marker){
      marker.hidden=!subject||this.flyover||!!this.detail||!!this.descent||this.clay;
      if(!marker.hidden){
        const spot=new THREE.Vector3(subject.x,subject.y+.48,subject.z).project(this.camera);
        marker.hidden=spot.z<0||spot.z>1||Math.abs(spot.x)>.79||Math.abs(spot.y)>.65;
        marker.style.left=((.5+spot.x*.5)*w)+'px';marker.style.top=((.5-spot.y*.5)*h)+'px';
        marker.lastElementChild.textContent=tableaux[this.id][0];
      }
    }
    const markers=document.getElementById('shoreMarks');
    if (markers) {
      markers.hidden=!this.detail?.wideReach;
      if (!markers.hidden) {
        const centre=this.scaleData.reachCentre[2];
        const ends=[centre+this.scaleData.riverWidth/2,centre-this.scaleData.riverWidth/2].sort((a,b)=>Math.abs(a)-Math.abs(b));
        for(const [i,mark] of [...markers.children].entries()){
          const pt=new THREE.Vector3(0,.23,ends[i]).project(this.camera);
          mark.hidden=Math.abs(pt.x)>.95||Math.abs(pt.y)>.94||pt.z>1;
          mark.style.left=((pt.x*.5+.5)*w)+'px';mark.style.top=((.5-pt.y*.5)*h)+'px';
        }
      }
    }
    const scale=document.getElementById('fieldScale');
    if (scale && !this.flyover) {
      const metres=2*distance*Math.tan(this.camera.fov*Math.PI/360)/h;
      const magnitude=10**Math.floor(Math.log10(metres*80));
      const length=([5,2,1].find(n=>n*magnitude<=metres*80)||1)*magnitude;
      const width=Math.round(length/metres);
      if(scale.dataset.px!==String(width) || scale.dataset.metres!==String(length)){
        scale.dataset.px=width;scale.dataset.metres=length;
        scale.style.setProperty('--rule-length',width+'px');
        scale.textContent=Number(length.toPrecision(3))+' m';
      }
    }
  }

  rotate(dx, dy) {
    this.focusPoint=null;
    this.descent=null;
    if(this.detail?.onDeck){
      this.walkTransit=null;this.yaw-=dx*.005;
      this.pitch=THREE.MathUtils.clamp(this.pitch+dy*.005,-1.12,1.15);
      const [x,y,z]=this.detail.eye,d=this.detail.distance,r=d*Math.cos(this.pitch);
      this.panX=x-r*Math.sin(this.yaw);this.targetY=y-d*Math.sin(this.pitch);this.panZ=z-r*Math.cos(this.yaw);
      this.render();return;
    }
    this.yaw -= dx * .008;
    const minimum=this.detail?.14:this.walk?Math.max(.16,.005+this.overviewBlend*(.27-(this.scaleData.keyframeView?.[5]||.27))):.37;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * .007, minimum, 1.46);
    this.render();
  }

  pan(dx,dy) {
    if(this.detail?.onDeck){this.rotate(dx,dy);return;}
    const orbit=this.eyeState?.[2]??this.yaw;
    const s=Math.sin(orbit), c=Math.cos(orbit), units=this.distance/Math.max(1,this.height)*.78;
    const limit=this.detail ? this.detail.distance*.42 : this.shot*.42;
    const x=this.detail?.x||0,z=this.detail?.z||0;
    this.panX=THREE.MathUtils.clamp(this.panX-(dx*c+dy*s)*units,x-limit,x+limit);
    this.panZ=THREE.MathUtils.clamp(this.panZ+(dx*s-dy*c)*units,z-limit,z+limit);
    this.render();
  }

  bindInput() {
    const stage = this.stage;
    const gap = () => {
      const [a,b] = this.pointers.values();
      return Math.hypot(a.x-b.x, a.y-b.y);
    };
    stage.addEventListener('pointerdown', e => {
      if (!this.model || e.button !== 0) return;
      stage.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      this.focusTap=this.walk&&this.pointers.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
    });
    stage.addEventListener('pointermove', e => {
      const last = this.pointers.get(e.pointerId);
      if (!last) return;
      if(this.focusTap&&Math.hypot(e.clientX-this.focusTap.x,e.clientY-this.focusTap.y)>5)this.focusTap=null;
      const previous = this.pointers.size === 2 ? gap() : 0;
      this.pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if (this.pointers.size === 1 && !e.shiftKey) this.rotate(e.clientX-last.x, e.clientY-last.y);
      else {
        this.pan((e.clientX-last.x)/this.pointers.size,(e.clientY-last.y)/this.pointers.size);
        if (previous > 1) this.magnify(gap()/previous);
      }
    });
    stage.addEventListener('pointerup',e=>{
      if(this.focusTap?.id===e.pointerId&&this.detail&&!this.clay){
        const box=stage.getBoundingClientRect();
        this.focusPoint=new THREE.Vector2((e.clientX-box.left)/box.width,1-(e.clientY-box.top)/box.height);
        this.render();
      }
      this.focusTap=null;
    });
    stage.addEventListener('lostpointercapture', e => this.pointers.delete(e.pointerId));
    stage.addEventListener('wheel', e => {
      if (!this.model) return;
      e.preventDefault();
      this.magnify(Math.exp(-THREE.MathUtils.clamp(e.deltaY,-240,240)*.0018));
    }, { passive: false });
    stage.addEventListener('keydown', e => {
      if (!this.model) return;
      if(this.detail?.onDeck&&!e.shiftKey&&['ArrowUp','ArrowDown'].includes(e.key)){
        this.walkBridge(this.walkMetres+(e.key==='ArrowUp'?1.5:-1.5));e.preventDefault();return;
      }
      const delta = { ArrowLeft: [-12,0], ArrowRight: [12,0], ArrowUp: [0,9], ArrowDown: [0,-9] }[e.key];
      if (delta && e.shiftKey) this.pan(...delta);
      else if (delta) this.rotate(...delta);
      else if (e.key === '+' || e.key === '=') this.magnify(1.2);
      else if (e.key === '-') this.magnify(1/1.2);
      else if (e.key === 'Home') this.reset();
      else return;
      e.preventDefault();
    });
  }
}
