import * as THREE from './vendor/three.module.min.js';
import {campaignSources,campaignStages,campaignNodes,campaignBoundary} from './campaign-map-data.js?v=campaign-20261127';
import {journeyWaypoints} from './journey-waypoints.js';
import {StableCampaignLabelLayout} from './campaign-label-layout.js?v=motion-sync-20261127';
import {clipCampaignSegment} from './campaign-projection.js?v=motion-sync-20261127';

const NS='http://www.w3.org/2000/svg';
const svg=(name,attrs={})=>{const el=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;};
const element=(name,cls,text)=>{const el=document.createElement(name);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const layoutStates=new WeakMap();

function ensureStyle(){
  const href=new URL('./campaign-map.css?v=motion-sync-20261127',import.meta.url).href;
  const existing=document.querySelector('link[data-campaign-map]');
  if(existing){if(existing.href!==href)existing.href=href;return;}
  const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.campaignMap='';document.head.append(link);
}

/** Keep dots geographic; only displace names, with short leader lines. */
export function layoutCampaignLabels(view,leaders,reserved=[],{project,moving=false}={}){
  const width=view.size.width,height=view.size.height;
  const entries=campaignNodes.flatMap((node,order)=>{
    const pin=document.querySelector(`#pins a[href="#station/${node.id}"]`);
    const point=project?project(view.points[node.id]):view.screen(node.id);
    if(!pin)return[];
    // The viewport itself clips labels. An extended band avoids hard edge toggles.
    const margin=pin.hidden?260:320;
    const visible=point&&point.x>-margin&&point.x<width+margin&&point.y>-margin&&point.y<height+margin;
    if(pin.hidden!==!visible)pin.hidden=!visible;
    if(!visible)return[];
    const label=pin.querySelector('.pin-name');
    const font=width<=720?11:12;
    return [{id:node.id,order,node,pin,label,point,x:point.x,y:point.y,w:Math.max(36,node.name.length*font+(width<=720?12:14)),h:width<=720?23:25}];
  });
  let state=layoutStates.get(leaders);if(!state){state=new StableCampaignLabelLayout();layoutStates.set(leaders,state);}
  const placements=state.update(entries,{width,height},reserved,performance.now(),{moving});const lines=[];
  for(const item of placements){
    const {point,w,h,pin,label,box,dx,dy}=item;
    if(!pin.classList.contains('named'))pin.classList.add('named');
    if(pin.classList.contains('landmark'))pin.classList.remove('landmark');
    if(pin.classList.contains('left'))pin.classList.remove('left');
    // CampaignMap is the sole overview pin writer. The explore loop skips this mode.
    const transform=`translate3d(${point.x.toFixed(2)}px,${point.y.toFixed(2)}px,0)`;
    if(pin.style.transform!==transform)pin.style.transform=transform;
    const left=`${dx+15}px`,top=`${dy+15}px`;
    if(label.style.left!==left)label.style.left=left;
    if(label.style.top!==top)label.style.top=top;
    const lx=clamp(point.x,box.x,box.x+w),ly=clamp(point.y,box.y,box.y+h);
    if(Math.hypot(lx-point.x,ly-point.y)>17)lines.push(`M${point.x.toFixed(1)},${point.y.toFixed(1)}L${lx.toFixed(1)},${ly.toFixed(1)}`);
  }
  const leaderPath=lines.join(' ');if(leaders.getAttribute('d')!==leaderPath)leaders.setAttribute('d',leaderPath);
  leaders.parentElement?.setAttribute('data-layout-reflows',state.reflows);
  leaders.parentElement?.setAttribute('data-label-side-switches',state.sideSwitches);
  return entries.length;
}

export class CampaignMap {
  constructor(view,{initialStage='xiangjiang'}={}){
    ensureStyle();this.view=view;this.stage=campaignStages[0];this.layers={march:true,opposition:true};this.paths=[];
    this.uiDirty=true;this.reserved=[];this.dragPointers=new Set();this.lastWheelAt=-Infinity;this.projectionFrames=0;
    this.root=element('div','campaign-map');this.root.hidden=true;view.container.append(this.root);
    this.root.dataset.labelLayoutVersion='motion-sync-20261127';
    this.root.dataset.projectionVersion='per-terrain-render';
    this.vectors=svg('svg',{'class':'campaign-vectors','aria-hidden':'true'});
    const defs=svg('defs');
    for(const [id,colour] of [['red','#d45342'],['blue','#91b3c9']]){
      const marker=svg('marker',{id:`campaign-arrow-${id}`,viewBox:'0 0 12 12',refX:'9',refY:'6',markerWidth:'7',markerHeight:'7',orient:'auto-start-reverse',markerUnits:'strokeWidth'});
      marker.append(svg('path',{d:'M1 1 L10 6 L1 11 L3 6 Z',fill:colour}));defs.append(marker);
    }
    this.vectors.append(defs);this.routes=svg('g');this.vectorLabels=svg('g',{'class':'campaign-vector-labels'});this.leaders=svg('path',{'class':'campaign-name-leaders'});
    this.vectors.append(this.routes,this.vectorLabels,this.leaders);this.root.append(this.vectors);
    this.panel=element('section','campaign-panel');this.panel.setAttribute('aria-label','长征阶段行动图');
    const header=element('div','campaign-heading');header.append(element('span','campaign-kicker','行军与围堵'),element('span','campaign-count','19 节点'));this.panel.append(header);
    const row=element('div','campaign-select-row');
    this.select=element('select');this.select.setAttribute('aria-label','选择长征行动阶段');
    campaignStages.forEach(stage=>{const option=element('option',null,`${stage.date} · ${stage.short}${stage.id==='all'?'（仅主线）':''}`);option.value=stage.id;this.select.append(option);});
    this.select.addEventListener('change',()=>this.setStage(this.select.value));
    const focus=element('button','campaign-focus','聚焦此段');focus.type='button';focus.addEventListener('click',()=>this.focusStage());row.append(this.select,focus);this.panel.append(row);
    this.title=element('h2');this.summary=element('p','campaign-summary');this.summary.setAttribute('aria-live','polite');this.panel.append(this.title,this.summary);
    const legend=element('div','campaign-legend');
    for(const [key,text] of [['march','红军行军'],['opposition','国民党军行动']]){
      const label=element('label',`campaign-toggle campaign-${key}`);const input=element('input');input.type='checkbox';input.checked=true;input.dataset.layer=key;input.addEventListener('change',()=>this.setLayer(key,input.checked));
      label.append(input,element('i'),element('span',null,text));legend.append(label);
    }
    legend.append(element('span','campaign-block-key','┤┤ 堵截 / 设防'));this.panel.append(legend);
    this.notice=element('p','campaign-precision','区域方向示意 · 非精确轨迹');this.panel.append(this.notice);
    const meta=element('div','campaign-meta');
    this.references=element('details','campaign-sources');this.references.append(element('summary',null,'史料与边界'));this.referenceBody=element('div');this.references.append(this.referenceBody);
    const index=element('details','campaign-index');index.append(element('summary',null,'19节点索引'));
    const nodes=element('nav');nodes.setAttribute('aria-label','全线十九节点');campaignNodes.forEach(node=>{const a=element('a',null,`${node.number} ${node.name}`);a.href=`#station/${node.id}`;nodes.append(a);});index.append(nodes);meta.append(this.references,index);this.panel.append(meta);
    this.root.append(this.panel);
    for(const type of ['wheel','pointerdown','pointerup','focusin'])this.panel.addEventListener(type,e=>e.stopPropagation());
    this.panel.addEventListener('keydown',e=>{if(e.key!=='Escape')e.stopPropagation();});
    const navigation=document.getElementById('exhibitNavigation');
    this.menuObserver=new MutationObserver(()=>this.syncMenuPlacement());
    if(navigation)this.menuObserver.observe(navigation,{attributes:true,attributeFilter:['hidden']});
    this.resizeObserver=new ResizeObserver(()=>{this.resetLabelLayout();this.syncMenuPlacement();});
    this.resizeObserver.observe(view.container);
    this.panel.addEventListener('toggle',()=>this.syncMenuPlacement(),true);
    const canvas=view.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>this.dragPointers.add(e.pointerId));
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>this.dragPointers.delete(e.pointerId));
    canvas.addEventListener('wheel',()=>{this.lastWheelAt=performance.now();},{passive:true});
    window.addEventListener('hashchange',()=>{if(location.hash!=='#explore')this.clearLabels();});
    this.setStage(initialStage);
  }

  resetLabelLayout(){this.uiDirty=true;layoutStates.get(this.leaders)?.invalidate();}
  clearLabels(){
    for(const label of document.querySelectorAll('#pins .pin-name'))for(const key of ['left','right','top','transform'])label.style.removeProperty(key);
    for(const pin of document.querySelectorAll('#pins .pin'))pin.classList.remove('campaign-emphasis');
    layoutStates.get(this.leaders)?.clear();this.leaders.setAttribute('d','');this.wasActive=false;
    this.vectors.dataset.layoutReflows='0';this.vectors.dataset.labelSideSwitches='0';
    this.dragPointers.clear();this.lastWheelAt=-Infinity;this.uiDirty=true;
    this.view.container.classList.remove('campaign-labels-active');
  }
  syncMenuPlacement(){
    const menu=document.getElementById('exhibitNavigation');
    for(const key of ['top','right','max-height','overflow-y'])this.panel.style.removeProperty(key);
    const open=menu&&!menu.hidden;this.root.dataset.menuOpen=String(Boolean(open));
    if(!open){this.resetLabelLayout();return;}
    const origin=this.view.container.getBoundingClientRect(),nav=menu.getBoundingClientRect();
    const width=origin.width,height=origin.height,panel=this.panel.getBoundingClientRect();
    if(width>720){
      const left=nav.left-origin.left-panel.width-12;
      const titleRects=['sceneTitle','sceneSub'].flatMap(id=>{
        const el=document.getElementById(id);if(!el)return[];const range=document.createRange();range.selectNodeContents(el);return[range.getBoundingClientRect()];
      });
      const titleRight=Math.max(0,...titleRects.map(r=>r.right-origin.left));
      if(left>12&&left>titleRight+12)this.panel.style.right=`${width-(nav.left-origin.left)+12}px`;
      else{
        this.panel.style.top=`${nav.bottom-origin.top+12}px`;
        const instrument=document.querySelector('.instrument')?.getBoundingClientRect();
        if(instrument)this.panel.style.right=`${Math.max(24,width-(instrument.left-origin.left)+12)}px`;
      }
      const top=parseFloat(this.panel.style.top)||panel.top-origin.top;
      this.panel.style.maxHeight=`${Math.max(56,height-top-16)}px`;
    }else this.panel.style.maxHeight=`${Math.max(56,height-(nav.bottom-origin.top)-24)}px`;
    this.panel.style.overflowY='auto';this.resetLabelLayout();
  }

  setStage(id){
    const stage=campaignStages.find(s=>s.id===id);if(!stage)return false;
    this.stage=stage;this.select.value=id;this.title.textContent=stage.title;this.summary.textContent=stage.summary;
    this.notice.textContent=id==='all'?'选择阶段查看围堵与追击 · 非精确轨迹':'亮红为本阶段 / 浅红为全线参照 · 非精确轨迹';
    this.referenceBody.replaceChildren(element('p',null,campaignBoundary));
    stage.sources.forEach(id=>{const s=campaignSources[id];const a=element('a',null,s.title+' ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';this.referenceBody.append(a);});
    this.routes.replaceChildren();this.vectorLabels.replaceChildren();this.paths=[];
    const features=[...stage.features];
    if(id!=='all'&&!features.some(f=>f.kind==='march')){
      const ids=stage.nodes.filter(node=>node!=='songpan'&&!['huining','jiangtai'].includes(node));
      const coords=[];
      ids.forEach((node,index)=>{
        coords.push(this.view.data.stations[node]);
        if(index<ids.length-1)coords.push(...(journeyWaypoints[node]||[]));
      });
      if(coords.length>1)features.unshift({label:'中央红军 · 本阶段主线',coords,kind:'march',sources:stage.sources});
    }
    for(const feature of features){
      const points=[];
      for(let i=1;i<feature.coords.length;i++){
        const a=this.view.world(feature.coords[i-1]),b=this.view.world(feature.coords[i]);const steps=Math.max(3,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/13));
        for(let j=0;j<steps;j++)points.push({x:a.x+(b.x-a.x)*j/steps,z:a.z+(b.z-a.z)*j/steps});
      }
      points.push(this.view.world(feature.coords.at(-1)));
      const path=svg('path',{'class':`campaign-line campaign-line-${feature.kind}`});
      if(feature.kind!=='blockade')path.setAttribute('marker-end',`url(#campaign-arrow-${feature.kind==='march'?'red':'blue'})`);
      const title=svg('title');title.textContent=feature.label+'（区域示意）';path.append(title);this.routes.append(path);
      const label=svg('text',{'class':`campaign-line-label campaign-label-${feature.kind}`});label.textContent=feature.label;this.vectorLabels.append(label);
      this.paths.push({feature,points,path,label});
    }
    this.root.dataset.stage=id;this.uiDirty=true;
    this.root.dispatchEvent(new CustomEvent('campaign-stagechange',{bubbles:true,detail:{id,date:stage.date}}));
    return true;
  }

  setLayer(layer,visible){if(layer in this.layers){this.layers[layer]=Boolean(visible);const input=this.root.querySelector(`input[data-layer="${layer}"]`);if(input)input.checked=this.layers[layer];}}

  focusStage(){
    const locations=this.stage.nodes.map(id=>this.view.points[id]).filter(Boolean);
    const more=this.stage.features.flatMap(f=>f.coords.map(p=>this.view.world(p)));
    this.view.focusCampaign?.(this.stage.id==='all'?this.view.panoramaPoints:[...locations,...more]);
  }

  project(point){
    const height=this.view.height(point.x,point.z)*this.view.terrainScale+5.5;
    const vector=new THREE.Vector3(point.x,height,point.z).project(this.view.camera);
    if(vector.z<-1||vector.z>1||!Number.isFinite(vector.x))return null;
    return {x:(vector.x+1)*this.view.size.width/2,y:(1-vector.y)*this.view.size.height/2};
  }

  clipPoint(point){
    return new THREE.Vector4(point.x,this.view.height(point.x,point.z)*this.view.terrainScale+5.5,point.z,1)
      .applyMatrix4(this.view.camera.matrixWorldInverse).applyMatrix4(this.view.camera.projectionMatrix);
  }

  pathData(points,width,height){
    const projected=points.map(p=>this.clipPoint(p));let d='',previous=null;
    for(let i=1;i<projected.length;i++){
      const segment=clipCampaignSegment(projected[i-1],projected[i],width,height);
      if(!segment){previous=null;continue;}
      const [a,b]=segment;
      if(!previous||Math.hypot(a.x-previous.x,a.y-previous.y)>.2)d+=`M${a.x.toFixed(2)},${a.y.toFixed(2)}`;
      d+=`L${b.x.toFixed(2)},${b.y.toFixed(2)}`;previous=b;
    }
    return d;
  }

  refreshReserved(){
    const origin=this.view.container.getBoundingClientRect();this.reserved=[];
    for(const selector of ['.scene-title','.site-header','.instrument','.campaign-panel','#routeBook[open]','#exhibitNavigation:not([hidden])']){
      const el=document.querySelector(selector);if(!el||el.hidden)continue;const r=el.getBoundingClientRect();
      if(r.width&&r.height)this.reserved.push({x:r.x-origin.x-5,y:r.y-origin.y-5,w:r.width+10,h:r.height+10});
    }
    this.uiDirty=false;
  }

  update(){
    const active=this.view.mode==='overview'&&document.body.dataset.display==='terrain';
    this.root.hidden=!active;this.view.container.classList.toggle('campaign-labels-active',active);
    if(!active){
      if(this.wasActive)this.clearLabels();return;
    }
    if(!this.wasActive)this.uiDirty=true;this.wasActive=true;
    const now=performance.now();this.projectionFrames++;
    // Projection follows every TerrainView.draw; only costly label packing waits.
    if(this.uiDirty)this.refreshReserved();
    const {width,height}=this.view.size,box=`0 0 ${width} ${height}`;
    if(this.vectors.getAttribute('viewBox')!==box)this.vectors.setAttribute('viewBox',box);
    const moving=this.dragPointers.size>0||now-this.lastWheelAt<240||Boolean(this.view.flight);
    for(const item of this.paths){
      const visible=item.feature.kind==='march'?this.layers.march:this.layers.opposition;
      if(item.lastVisible!==visible){item.path.style.visibility=visible?'visible':'hidden';item.lastVisible=visible;}
      if(!visible)continue;
      const d=this.pathData(item.points,width,height);if(item.path.getAttribute('d')!==d)item.path.setAttribute('d',d);
      const p=this.project(item.points[Math.floor(item.points.length*.45)]);
      const captionVisible=Boolean(p);
      if(item.captionVisible!==captionVisible){item.label.style.visibility=captionVisible?'visible':'hidden';item.captionVisible=captionVisible;}
      if(p){item.label.setAttribute('x',(p.x-item.feature.label.length*11.5/2).toFixed(2));item.label.setAttribute('y',(p.y-14-(this.paths.indexOf(item)%2)*15).toFixed(2));}
    }
    const count=layoutCampaignLabels(this.view,this.leaders,this.reserved,{project:p=>this.project(p),moving});this.root.dataset.visibleNodeLabels=count;
    for(const node of campaignNodes){const pin=document.querySelector(`#pins a[href="#station/${node.id}"]`);pin?.classList.toggle('campaign-emphasis',this.stage.id==='all'||this.stage.nodes.includes(node.id));}
  }
}
