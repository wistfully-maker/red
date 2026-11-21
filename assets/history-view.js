import * as THREE from './vendor/three.module.min.js';
import { loadModel } from './scene-models.js?v=cinema-20261121';
import { landscapeMaterial } from './valley-materials.js?v=cinema-20261121';
import { plantedGrove } from './green-groves.js?v=cinema-20261121';
import { ExhibitFilm } from './exhibit-film.js?v=cinema-20261121';
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
  materials.forEach(material => material.dispose());
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
    this.scene.add(new THREE.HemisphereLight(0xdce7ed,0x73745d,.82));
    this.sun=new THREE.DirectionalLight(0xffe0ac,2.25);
    this.scene.environment=makeValleyEnvironment(this.renderer,new THREE.Vector3(-.82,.48,.27).normalize());
    this.scene.environmentIntensity=.53;
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);
    this.sun.shadow.bias=-.00012;
    this.scene.add(this.sun,this.sun.target);
    this.clock={value:0};
    this.serial=0;
    this.pointers=new Map();
    this.bindInput();
    new ResizeObserver(()=>this.render()).observe(stage);
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.animate = time => {
      this.frame=0;
      if (!this.active || !this.model || document.hidden || this.reduced.matches) return;
      if (!this.last || time-this.last>65) {
        this.clock.value=time*.001;
        this.render();
        this.last=time;
      }
      this.frame=requestAnimationFrame(this.animate);
    };
    document.addEventListener('visibilitychange',()=>this.schedule());
  }

  schedule() {
    if (this.active && !this.frame && !document.hidden && !this.reduced.matches)
      this.frame=requestAnimationFrame(this.animate);
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
    disposeModel(this.model);
    if (this.guideAsset) this.guideAsset.visible=false;
    this.model=null;
    this.renderer.clear();
    const model=await loadModel('landscapes/'+id,'cinema-20261121');
    try {
      const mapped=new Map();
      let ground;
      model.traverse(mesh=>{if(mesh.isMesh && mesh.material.name.startsWith('ground_')) ground=mesh;});
      if (!ground) throw Error('Missing continuous terrain');
      const registration=ground.geometry.getAttribute('uv1');
      if(!registration) throw Error('Missing registered ground coordinates');
      ground.geometry.setAttribute('atlasRegistration',registration);
      model.traverse(mesh=>{
        if (!mesh.isMesh) return;
        const name=mesh.material.name;
        if (!mapped.has(name)) mapped.set(name,landscapeMaterial(name,this.clock,ground.userData));
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
        original.add(mesh.material);
        const name=mesh.material.name;
        if (name==='iron_near') nearIron=mesh;
        if (name==='iron_far') farIron=mesh;
        if (mesh.userData.journalGuide) {mesh.visible=false;guides.push(mesh);}
        if(mesh.userData.roomCut)cutaway.push(mesh);
        mesh.material=materials.get(name);
        mesh.castShadow=mesh!==ground && name!=='canopy_side';
        mesh.receiveShadow=true;
      });
      original.forEach(mat=>mat.dispose());
      const grove=await plantedGrove(ground.userData);
      if(grove)model.add(grove);
      if (this.serial!==serial) { disposeModel(model); return false; }
      this.grove=grove;
      this.model=model; this.id=id;
      this.scene.background=new THREE.Color(0xb5beb0);
      this.nearIron=nearIron;this.farIron=farIron;
      this.guides=guides;
      this.cutaway=cutaway;
      this.fieldShots={};
      const metadata=ground.userData;
      if(id==='luding')this.fieldShots.deck=this.bridgeEye(12);
      if(metadata.tableauView){
        const [x,y,z,distance,yaw,pitch]=metadata.tableauView;
        this.fieldShots.tableau={x,y,z,distance,yaw,pitch};
      }
      if (metadata.recorderAnchor) {
        const [x,y,z,turn]=metadata.recorderAnchor;
        this.fieldShots.guide={x,y,z,distance:3.05,yaw:turn+.17,pitch:.16};
      }
      if (metadata.boatView) {
        const [x,y,z]=metadata.boatView;
        this.fieldShots.boat={x,y,z,distance:metadata.hullDimensions[0]*1.60,yaw:.56,pitch:.47};
        const [cx,cy,cz]=metadata.reachCentre;
        this.fieldShots.reach={x:cx,y:cy,z:cz,distance:metadata.riverWidth*1.76,yaw:.11,pitch:1.29,wideReach:true};
      }
      this.shot=ground.userData.framingWidth;
      this.span=ground.userData.plateWidth;
      model.add(valleyMist(this.span,this.clock,['wuqi','huining','jiangtai'].includes(id)?.16:.40));
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
    this.cutaway?.forEach(mesh=>mesh.visible=true);
    this.panX=this.id==='zunyi'?-2.2:0;
    this.panZ=0;
    this.targetY=this.baseTarget;
    this.detail=null;
    if(this.guideAsset)this.guideAsset.visible=false;
    this.guides?.forEach(mesh=>mesh.visible=false);
    this.shadowRegion='';
    this.descent=null;
    this.yaw=this.flyover ? -.37 : ({yudu:.60,luding:.31,hadapu:.69,wuqi:.21}[this.id] ?? .38);
    this.pitch=this.flyover ? .82 : ({songpan:.84,lazikou:.75,jiajin:.68,wuqi:.47}[this.id] ?? .59);
    this.zoom=1;
    this.render();
  }

  inspectDetail(kind='detail') {
    const shot=kind==='detail' ? detailViews[this.id] : this.fieldShots?.[kind];
    if (!shot || !this.active || this.flyover) return;
    const from=this.eyeState;
    this.detail=shot;
    this.cutaway?.forEach(mesh=>mesh.visible=kind!=='tableau');
    if(this.guideAsset)this.guideAsset.visible=false;
    if(kind==='guide') this.placeRecorder();
    this.guides?.forEach(mesh=>mesh.visible=kind==='guide');
    this.shadowRegion='';
    this.panX=shot.x;this.panZ=shot.z;this.targetY=shot.y;
    this.yaw=shot.yaw;this.pitch=shot.pitch;this.zoom=1;
    this.descent=from && !this.reduced.matches ? {from,start:performance.now()} : null;
    this.render();
    this.schedule();
  }

  bridgeEye(metres) {
    // Match the board elevation of native_luding in the Blender scene.
    const half=103.67/2;
    const deck=x=>7.25+2.65*(Math.min(half,Math.abs(x))/half)**2;
    const x=metres-half,eye=deck(x)+1.70,distance=7.5,pitch=.052;
    const yaw=-1.77-.72*Math.sin(Math.PI*metres/(2*half));
    const reach=distance*Math.cos(pitch);
    return {x:x-reach*Math.sin(yaw),y:eye-distance*Math.sin(pitch),z:-.38-reach*Math.cos(yaw),
      distance,yaw,pitch,onDeck:true};
  }

  walkBridge(metres) {
    if(!this.active||this.id!=='luding'||!this.detail?.onDeck)return;
    const shot=this.bridgeEye(metres);
    this.descent=null;this.detail=shot;this.panX=shot.x;this.panZ=shot.z;
    this.targetY=shot.y;this.yaw=shot.yaw;this.pitch=shot.pitch;this.zoom=1;
    this.render();
  }

  async placeRecorder() {
    const serial=this.serial;
    try {
      this.guideLoading??=loadModel('journal-recorder','recorder-master-67').then(asset=>{
        asset.traverse(part=>{if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}});
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
      this.scene.background=new THREE.Color(enabled?0xc7c3bb:0xb5beb0);
    }
    this.shadowRegion='';this.render();
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
    if (this.detail) distance=this.detail.distance/this.zoom*(aspect<.8&&!this.detail.onDeck?(this.detail.wideReach?1.55:1.28):1);
    let offsetY=0;
    if(this.detail?.wideReach && aspect<.85){
      const top=document.querySelector('.scene-title').getBoundingClientRect().bottom+23;
      const bottom=document.querySelector('.model-foot').getBoundingClientRect().top-28;
      const available=Math.max(h*.19,bottom-top);
      const tangent=2*Math.tan(this.camera.fov*Math.PI/360);
      distance=Math.max(distance,this.scaleData.riverWidth*h/(available*tangent)*1.25/this.zoom);
      offsetY=h*.5-(top+bottom)*.5;
    }
    let orbit=this.yaw+(this.flyover && !this.reduced.matches ? .055*Math.sin(this.clock.value*.105) : 0);
    let pitch=this.pitch;
    let aimX=this.panX,aimY=this.targetY,aimZ=this.panZ;
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
    const reach=2**Math.ceil(Math.log2(Math.max(6,distance*.82)));
    const cell=reach/8;
    const sx=Math.round(aimX/cell)*cell, sz=Math.round(aimZ/cell)*cell;
    const sy=Math.round(aimY/cell)*cell;
    const region=[reach,sx,sy,sz,Boolean(closeIron)].join('/');
    if (this.shadowRegion!==region) {
      this.shadowRegion=region;
      this.sun.target.position.set(sx,sy,sz);
      this.sun.position.set(sx-reach*2.6,sy+reach*1.74,sz+reach*.94);
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
    this.film.draw(this.scene,this.camera,{span:this.span,clay:this.clay,strength:this.clay?.35:1});
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
    this.descent=null;
    this.yaw -= dx * .008;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * .007, this.detail ? .14 : .37, 1.46);
    this.render();
  }

  pan(dx,dy) {
    const s=Math.sin(this.yaw), c=Math.cos(this.yaw), units=this.distance/Math.max(1,this.height)*.78;
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
    });
    stage.addEventListener('pointermove', e => {
      const last = this.pointers.get(e.pointerId);
      if (!last) return;
      const previous = this.pointers.size === 2 ? gap() : 0;
      this.pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if (this.pointers.size === 1 && !e.shiftKey) this.rotate(e.clientX-last.x, e.clientY-last.y);
      else {
        this.pan((e.clientX-last.x)/this.pointers.size,(e.clientY-last.y)/this.pointers.size);
        if (previous > 1) this.magnify(gap()/previous);
      }
    });
    stage.addEventListener('lostpointercapture', e => this.pointers.delete(e.pointerId));
    stage.addEventListener('wheel', e => {
      if (!this.model) return;
      e.preventDefault();
      this.magnify(Math.exp(-THREE.MathUtils.clamp(e.deltaY,-240,240)*.0018));
    }, { passive: false });
    stage.addEventListener('keydown', e => {
      if (!this.model) return;
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
