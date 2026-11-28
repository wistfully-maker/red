import {openMuseum} from './longmarch-museum.js?v=scene-fixes-20261128';
import {stationViewHref,sceneModeFromHash} from './scene-navigation.js';
import {brandStage} from './brand-stage.js?v=museum-final-20261127';
import './map-welcome.js?v=terrain-entry-20261127';
import { TerrainView } from './terrain-view.js?v=terrain-depth-20261128-v2';
import { chapters, places } from './places.js?v=scene-fixes-20261128';
import { HistoryView, historyScenes, detailViews } from './history-view.js?v=scene-layout-20261128';
import { tableaux } from './scene-studies.js?v=luding-studio-1';


const $ = (id) => document.getElementById(id);
const icon = (id) => '<svg aria-hidden="true"><use href="#i-' + id + '"/></svg>';
const href = (station) => '#station/' + station.id;
const byId = new Map(stations.map((station, index) => [station.id, { ...station, index }]));
const chapterFor = (index) => chapters.findLastIndex(chapter => byId.get(chapter.start).index <= index);
const formatNumber = (value) => String(value).padStart(2, '0');
const numberFormat = new Intl.NumberFormat('zh-CN');
const mobile = matchMedia('(max-width: 720px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const walkKeys=['bridgehead','deck','pavilion'];
const walkNames=['桥头望全桥','桥上听水','回望桥亭'];
let stillWalk=false;
const route = stations.filter(station => station.kind === 'route' && station.id !== 'songpan').map(station => station.id);
const terrainLabels = [
  ['赣南丘陵', [26.77, 114.98]],
  ['湘江流域', [27.01, 110.98]],
  ['川黔滇山地', [27.75, 104.35]],
  ['川西高山', [31.35, 101.01]],
  ['陕甘丘陵', [35.72, 107.46]]
].map(([name, coords]) => {
  const element = document.createElement('span');
  element.textContent = name;
  $('regionalLabels').append(element);
  return { coords, element };
});

const pinElements = new Map();
const historySwitch = $('historyToggle');
const historyLabels = $('historicalLabels');
let active;
let mode = 'home';
let world;
let ready = false;
let loadFailed = false;
let stateVersion = 0;
let passageStation = null;
let display = 'cover';
let modelView;
let modelRequest = 0;
let terrainStartup;

function makeTimeline() {
  $('timeline').innerHTML = chapters.map((chapter, i) =>
    '<a href="#station/' + chapter.start + '" data-chapter="' + i + '">' +
    '<span class="chapter-no">' + formatNumber(i + 1) + '</span><span><strong>' + chapter.title +
    '</strong><small>' + chapter.date + '</small></span></a>'
  ).join('');
  for (const [index, station] of stations.entries()) {
    const step = document.createElement('a');
    step.className = 'station-step ' + station.kind;
    step.href = href(station);
    step.title = station.name + ' · ' + station.title;
    step.setAttribute('aria-label', '第 '+(index+1)+'站 · '+station.name);
    const number=document.createElement('span');number.className='step-number';number.textContent=station.number;
    const label=document.createElement('span');label.className='step-name';label.textContent=station.name;
    step.append(number,label);
    $('stationRail').append(step);
  }
}

function makePins() {
  for (const station of stations) {
    const link = document.createElement('a');
    link.href = href(station);
    link.className = 'pin ' + station.kind;
    link.hidden = true;
    link.setAttribute('aria-label', station.number + ' ' + station.name + ' · ' + station.title);
    link.innerHTML = '<span class="pin-dot" aria-hidden="true"></span><span class="pin-name" aria-hidden="true"></span>';
    link.lastElementChild.textContent = station.name;
    $('pins').append(link);
    pinElements.set(station.id, link);
  }
}

let overlayFrame = -1;

function drawPassage(view) {
  const passage = $('scenePassage');
  const flight = passageStation && !reduceMotion.matches && view.flight;
  const progress = flight ? flight.distanceTravelled : 0;
  const visible = Boolean(flight && progress < .87);
  passage.hidden = !visible;
  $('reader').classList.toggle('in-passage', visible);
  if (visible) {
    const opacity = Math.min(1, progress * 7.5, (.87 - progress) * 7);
    passage.style.setProperty('--passage-opacity', opacity.toFixed(3));
  }
  if (!view.flight && !view.waitingForTerrain) passageStation = null;
}

function drawOverlay(view) {
  if (display !== 'terrain') return;
  const current = Math.floor(performance.now() / 25);
  if (current === overlayFrame) return;
  overlayFrame = current;
  drawPassage(view);
  const near = view.view.distance < 105;
  const scale = $('terrainScale');
  const bounds = view.near?.bounds;
  const limited = view.atZoomLimit();
  const refining = limited && view.refiningImagery();
  $('zoomIn').disabled = limited || view.waitingForTerrain;
  const detailView = bounds && !view.historical && view.view.distance <= 13 &&
    view.view.x >= bounds[0] && view.view.x <= bounds[2] && view.view.z >= bounds[1] && view.view.z <= bounds[3];
  scale.hidden = !limited && !detailView;
  if (!scale.hidden) {
    const vectorVisible = view.near?.features?.visible && view.near.features.userData.count > 0;
    const detailLabel = mode === 'overview' ? '高程浮雕 · 分区设色' : vectorVisible ? '约 10 米卫星影像 · 现代地物' : '约 10 米卫星影像';
    const label = refining ? '正在加载更清晰的影像' : limited ? (mode === 'overview' ? '已到清晰范围 · 点选节点看近景' :
      view.modelZoom ? '已到模型近景' : '已到影像清晰范围') : detailLabel;
    if (scale.textContent !== label) scale.textContent = label;
  }
  const heading = Math.round(view.view.bearing * 180 / Math.PI);
  $('northArrow').style.transform = 'rotate(' + -heading + 'deg)';
  const labels = $('regionalLabels');
  labels.hidden = mode !== 'overview' || mobile.matches || view.view.distance < 900 || Boolean(view.flight);
  if (!labels.hidden) {
    for (const { coords, element } of terrainLabels) {
      const point = view.screenPoint(view.world(coords));
      element.hidden = !point || point.x < 160 || point.x > view.size.width - 100 ||
        point.y < 104 || point.y > view.size.height - 114;
      if (!element.hidden) element.style.transform = 'translate(' + Math.round(point.x) + 'px, ' + Math.round(point.y) + 'px)';
    }
  }
  historyLabels.hidden = !view.historical || Boolean(view.flight) || view.view.distance > .9;
  if (!historyLabels.hidden) {
    const bridge = view.bridge.position;
    for (const [index, label] of [...historyLabels.children].entries()) {
      const x = bridge.x + (index === 0 ? -.065 : .065);
      const point = view.screenPoint({ x, z: bridge.z + .04 * (x - bridge.x) }, bridge.y + .016);
      label.hidden = !point || point.x < 29 || point.x > view.size.width - 29;
      if (!label.hidden) {
        const left = Math.max(12, Math.min(point.x, view.size.width - label.offsetWidth - 12));
        label.style.transform = 'translate(' + Math.round(left) + 'px, ' + Math.round(point.y) + 'px)';
      }
    }
  }
  // The campaign layer owns geographic pins in the overview. A second writer
  // here would alternate its placement with the label collision layout.
  if(mode==='overview'&&view.campaign)return;
  for (const station of stations) {
    const pin = pinElements.get(station.id);
    const landmark = view.overviewLandmarkScreen(station.id);
    const point = landmark || view.screen(station.id);
    const isActive = active?.id === station.id;
    pin.hidden = !point || (view.flight && view.flight.distanceTravelled < .45 && !isActive) ||
      (view.historical && view.view.distance < .9) || (station.id === 'zunyi' && view.zunyiHall?.visible);
    if (pin.hidden) continue;
    pin.style.transform = 'translate3d(' + Math.round(point.x) + 'px,' + Math.round(point.y) + 'px,0)';
    pin.classList.toggle('landmark', Boolean(landmark));
    pin.classList.toggle('named', Boolean(landmark) || isActive || (!near && mode === 'overview'));
    pin.classList.toggle('left', point.x > view.size.width - 115 ||
      point.x > 112 && station.id === 'luding' && !near);
  }
}

function setStationLink(id, station) {
  const link=$(id);
  link.href=station?stationViewHref(station.id,display):'#explore';
  link.querySelector('small').textContent=station?(id==='prevStation'?'上一站':'下一站'):'全线地图';
  link.querySelector('strong').textContent=station?station.name:'返回全线';
}
function renderReader(station) {
  $('readerName').textContent=station.name;
  $('stationNav').hidden=false;
  setStationLink('prevStation',stations[station.index-1]);
  setStationLink('nextStation',stations[station.index+1]);
}
function setHistoricalView(enabled) {
  historySwitch.setAttribute('aria-pressed', String(enabled));
  historySwitch.textContent = enabled ? '切回今景' : '1935 年史景';
  $('historyNote').hidden = !enabled;
  historyLabels.hidden = true;
}

function updateHUD() {
  const chapter = active ? chapterFor(active.index) : -1;
  for (const link of $('timeline').children) {
    if (Number(link.dataset.chapter) === chapter) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  for (const [id, pin] of pinElements) {
    if (active?.id === id) pin.setAttribute('aria-current', 'location');
    else pin.removeAttribute('aria-current');
  }
  for (const [index, link] of [...$('stationRail').children].entries()) {
    link.classList.toggle('reached', (active?.index??-1) >= index);
    if (active?.index === index) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  const shotButton = $('shotButton');
  $('terrainScale').hidden = true;
  historySwitch.hidden = !active || !places[active.id].historic;
  setHistoricalView(false);
  shotButton.hidden = !active || !places[active.id].close;
  shotButton.setAttribute('aria-pressed', 'false');
  if (!active) {
    $('sceneKicker').textContent = '沿线总览';
    $('sceneKind').textContent = '1934 — 1936';
    $('sceneTitle').textContent = '长征路线';
    $('sceneSub').textContent = '点选地名，走进沿途的历史现场';
    return;
  }
  const place = places[active.id];
  if (place.close) shotButton.lastElementChild.textContent = place.close.label;
  $('sceneKicker').textContent=active.number+' / '+stations.length;
  $('sceneKind').textContent = place.tag;
  $('sceneTitle').textContent = active.name;
  $('sceneSub').textContent = active.region;
  renderReader(active, chapter, place);
}

function describeElevation(patch, place) {
  const [min, max] = patch.range;
  $('sceneSub').textContent = place + ' · 场景海拔 ' + numberFormat.format(min) + '–' + numberFormat.format(max) + ' 米';
}

function beginFlight(initial = false, shot = places[active?.id]) {
  if (!ready || display !== 'terrain') return;
  const turn = ++stateVersion;
  const id = active?.id;
  $('loading').hidden = true;
  if (initial && mode === 'home') return;
  const load = world.goTo(mode, id, shot, initial);
  const timer = setTimeout(() => {
    if (turn !== stateVersion) return;
    $('loading').textContent = '正在加载这一站的地形';
    $('loading').hidden = false;
  }, 400);
  load.then(patch => {
    clearTimeout(timer);
    if (turn !== stateVersion) return;
    $('loading').hidden = true;
    if (id && !patch) {
      $('loading').textContent = '这一站的精细地形加载失败';
      $('loading').hidden = false;
      return;
    }
    if (shot?.history) $('sceneSub').textContent = shot.context;
    else if (id) describeElevation(patch, shot.context || active.region);
  });
}

let arrivalStation=null;
window.addEventListener('cinema:arrive',event=>{arrivalStation=event.detail;});
function setDisplay(next) {
  display = next;
  if(active)renderReader(active);
  $('terrainGesture').hidden=next!=='terrain';
  $('modelMuseum').hidden=next!=='model'||!active;
  if(active)$('modelMuseumName').textContent=active.name;
  showWalk(false);
  stillWalk=false;
  const request = ++modelRequest;
  brandStage.cancel();
  ++stateVersion;
  document.body.dataset.display = next;
  $('world').inert = next !== 'terrain';
  $('specimen').hidden = next !== 'model';
  $('sceneViews').hidden = !active;
  $('fieldShot').hidden = true;
  $('fieldScale').hidden = true;
  $('useSpecimen').setAttribute('aria-pressed', String(next === 'model'));
  $('useTerrain').setAttribute('aria-pressed', String(next === 'terrain'));
  $('loading').hidden = true;
  $('scenePassage').hidden = true;
  $('reader').classList.remove('in-passage');
  if (world) world.suspended = next !== 'terrain';
  if (next === 'terrain') modelView?.hide();
  if (next === 'terrain') {
    if (ready) beginFlight();
    else startTerrain();
    return;
  }
  if (next === 'cover') {
    $('modelPlate').hidden = true;
    $('modelStage').tabIndex = -1;
    modelView?.hide();
    return;
  }
  $('modelStage').tabIndex = 0;
  passageStation = null;
  const station = active;
  const [name, caption] = historyScenes[station.id];
  $('modelNear').hidden = !detailViews[station.id];
  $('modelNear').textContent = detailViews[station.id]?.label || '';
  $('modelFolio').textContent = station.number + ' / 19 · 历史地景示意';
  $('modelName').textContent = name;
  $('modelCaption').textContent = caption;
  $('sceneSub').textContent = station.region + ' · ' + station.date;
  $('sceneKind').textContent = places[station.id].tag;
  const plate = $('modelPlate');
  $('modelStage').classList.add('loading-model');
  const section=location.hash.split('/')[2],walkEntry=walkKeys.includes(section)||section==='journal';
  const stop=walkKeys.includes(section)?section:section==='journal'?'bridgehead':'overview';
  Object.assign(plate.style, {backgroundImage:station.id==='luding'?ludingPoster(stop):'url(assets/valley/stills/'+station.id+'.webp?v=scene-layout-20261128)',
    backgroundSize:'cover',backgroundPosition:'center'});
  plate.setAttribute('aria-label', name + '的模型静帧');
  plate.hidden = false;
  $('modelStatus').textContent = '正在装入模型';
  const brandToken=brandStage.begin(station.name+' · 正在载入');
  const controls = document.querySelectorAll('.model-tools button');
  controls.forEach(button => button.disabled = true);
  (async () => {
    try {
      await brandStage.painted();
      if(request!==modelRequest)return;
      modelView ??= new HistoryView($('modelStage'));
      if (!await modelView.show(station.id) || request !== modelRequest) return;
      if(arrivalStation===station.id && !reduceMotion.matches){
        const wide=modelView.shot*(mobile.matches?2.8:2.2);
        modelView.descent={from:[wide,1.08,-.17,0,modelView.baseTarget,0],start:performance.now()};
        modelView.schedule();
      }
      arrivalStation=null;
      plate.hidden = true;
      $('modelStage').classList.remove('loading-model');
      const labels={bridgehead:'桥头望全桥',deck:'桥上听水',pavilion:'回望桥亭',tableau:'史事现场',resident:'人物近景',guide:'行记员近景',boat:'船工与渡船',reach:'两岸尺度'};
      $('fieldShot').replaceChildren(new Option('场景机位','site'),...Object.keys(modelView.fieldShots).map(key=>new Option(labels[key],key)));
      $('fieldShot').hidden=false;
      $('fieldScale').hidden=false;
      if(station.id==='luding'){
        const section=location.hash.split('/')[2];
        if(walkKeys.includes(section)||section==='journal')selectWalk(walkKeys.includes(section)?section:'bridgehead');
        else addDeckEntry();

      }
      window.dispatchEvent(new Event('atlas:scene-ready'));
      $('modelStatus').textContent = mobile.matches ? '单指环看 · 双指移动与缩放' : '拖动环看 · Shift 拖动平移 · 滚轮缩放';
      controls.forEach(button => button.disabled = false);
      modelView.render();
      if(document.querySelector('#longmarchMuseum[open]'))modelView.pauseForReading(true);
      await brandStage.painted();
      brandStage.finish(brandToken);
    } catch (error) {
      if (request !== modelRequest) return;
      brandStage.finish(brandToken);
      $('modelStatus').textContent = '当前显示模型静帧';
      const notes=document.createElement('button');
      notes.type='button';notes.className='show-study';notes.textContent='进入主题展馆';
      notes.onclick=()=>openMuseum({stationId:station.id});
      $('modelCaption').append('　',notes);
      if(station.id==='luding'){
        stillWalk=true;
        if(walkEntry)showStillWalk(stop);else addDeckEntry();
      }
      arrivalStation=null;window.dispatchEvent(new Event('atlas:scene-ready'));
      console.warn('历史模型未加载', station.id, error.message);
    }
  })();
}

function updatePage(event) {
  const previousStation = active?.id;
  const previousDisplay=display;
  const hash = location.hash.slice(1)||'explore';
  if(hash.startsWith('journey/')){
    location.replace('#station/'+hash.slice(8)+'/exhibit');
    return;
  }
  const stationRoute = /^station\/([^/]+)(?:\/(archive|people|study|exhibit|deck|bridgehead|pavilion|terrain|model|journal))?$/.exec(hash);
  const stationTab = stationRoute?.[2];
  active=byId.get(stationRoute?.[1]);
  mode = active ? 'station' : 'overview';
  document.body.dataset.mode = mode;
  document.body.dataset.journey='false';
  $('cover').hidden = mode !== 'home';
  $('hud').hidden = mode === 'home';
  $('reader').hidden = !active;
  $('pins').hidden = mode === 'home';
  if (mode !== 'overview') $('regionalLabels').hidden = true;
  passageStation = event && active && active.id !== previousStation ? active.id : null;
  $('scenePassage').hidden = true;
  $('reader').classList.remove('in-passage');
  if (passageStation) {
    $('passageIndex').textContent='第 '+active.number+' 站 / '+stations.length;
    $('passageTitle').textContent=active.name;
    $('passageDate').textContent = active.date + ' · ' + active.region;
  }
  $('world').tabIndex = mode === 'home' ? -1 : 0;
  document.title = active ? active.title + ' · 山河之路' : '山河之路 · 长征纪念图集';
  updateHUD();
  const museumTab=['archive','people','study','journal','exhibit'].includes(stationTab);
  const savedEntry=history.state;
  const savedView=savedEntry?.sceneRoute===hash?savedEntry.sceneView:null;
  const nextDisplay=active&&(stationTab==='model'||walkKeys.includes(stationTab)||
    (museumTab&&(savedView==='model'||(!savedView&&previousStation===active.id&&previousDisplay==='model'))))?'model':'terrain';
  if(active)history.replaceState({...history.state,sceneRoute:hash,sceneView:nextDisplay},'');
  const keepWalk=previousStation==='luding'&&active?.id==='luding'&&display==='model'&&
    nextDisplay==='model'&&modelView?.walk&&walkKeys.includes(stationTab)&&$('modelPlate').hidden;
  if(keepWalk)selectWalk(stationTab);
  else{modelView?.pauseForReading(false);setDisplay(nextDisplay);}
  if(hash==='museum'||hash==='exhibit')openMuseum();
  else if(active&&museumTab)openMuseum({stationId:active.id,returnScene:stationViewHref(active.id,nextDisplay)});
  if (event) {
    const title = 'sceneTitle';
    $(title).focus({ preventScroll: true });
  }
}

makeTimeline();
makePins();
updatePage();
window.addEventListener('hashchange', updatePage);

function startTerrain() {
  const terrainBrand=brandStage.begin('正在展开山河');
  $('loading').textContent = loadFailed ? '三维地形暂不可用，仍可阅读地点档案' : '正在展开山河';
  $('loading').hidden = false;
  terrainStartup ??= (async () => {
    try {
      world = new TerrainView($('world'), drawOverlay);
      await world.start(route);
      ready = true;
      document.body.classList.add('terrain-ready');
      await brandStage.painted();
      $('loading').hidden = true;
      if (display === 'terrain') beginFlight(true);
    } catch (error) {
      loadFailed = true;
      console.warn('无法初始化三维地形', error.message);
      document.body.classList.add('terrain-unavailable');
      $('loading').textContent = '三维地形暂不可用，仍可阅读地点档案';
      $('loading').hidden = display !== 'terrain';
      for (const id of ['zoomIn','zoomOut','orbitView','historyToggle','shotButton']) $(id).disabled = true;
    }
  })();
  terrainStartup.then(()=>brandStage.finish(terrainBrand));
}

$('useSpecimen').addEventListener('click',()=>{
  if(active&&display!=='model')location.hash='station/'+active.id+'/model';
});
$('useTerrain').addEventListener('click',()=>{
  if(active&&display!=='terrain')location.hash='station/'+active.id+'/terrain';
});
$('modelPlus').addEventListener('click', () => modelView?.magnify(1.25));
$('modelMinus').addEventListener('click', () => modelView?.magnify(.8));
function addDeckEntry() {
  const link=document.createElement('a');link.href='#station/luding/deck';link.textContent='走上桥面 →';
  link.onclick=event=>{
    if(location.hash!==link.hash)return;
    event.preventDefault();$('fieldShot').value='deck';$('fieldShot').dispatchEvent(new Event('change'));
  };
  $('modelCaption').append('　',link);
}
function showWalk(visible){
  $('riverWalk').hidden=!visible;document.body.dataset.riverWalk=String(visible);
}
function ludingPoster(kind){
  const suffix=mobile.matches?(kind==='overview'&&innerHeight<800?'-compact':'-mobile'):'';
  return 'url(assets/luding/stills/'+kind+suffix+'.webp?v=scene-layout-20261128)';
}
function showStillWalk(id){
  showWalk(true);$('riverWalk').dataset.still='true';
  $('modelPlate').style.backgroundImage=ludingPoster(id);
  $('walkTitle').textContent=walkNames[walkKeys.indexOf(id)]+' · 静帧';
  for(const b of $('riverWalk').querySelectorAll('[data-walk]'))b.setAttribute('aria-pressed',String(b.dataset.walk===id));
}
function paintWalk(metres){
  const stops=modelView.walk.stops;
  const stop=stops.reduce((best,s)=>Math.abs(s.metres-metres)<Math.abs(best.metres-metres)?s:best);
  $('walkPosition').value=metres;$('walkMetres').value=Number(metres.toFixed(1))+' 米';
  if($('walkTitle').textContent!==stop.caption){
    $('walkTitle').textContent=stop.caption;
    if(!reduceMotion.matches)$('walkTitle').animate([{opacity:.28,translate:'0 3px'},{opacity:1,translate:'0 0'}],{duration:210});
  }
  for(const b of $('riverWalk').querySelectorAll('[data-walk]')){
    const value=String(b.dataset.walk===stop.id);
    if(b.getAttribute('aria-pressed')!==value)b.setAttribute('aria-pressed',value);
  }
}
function selectWalk(id){
  if(stillWalk){showStillWalk(id);return;}
  if(!modelView?.walk)return;
  delete $('riverWalk').dataset.still;
  const stop=modelView.walk.stops.find(s=>s.id===id);if(!stop)return;
  modelView.inspectDetail(id);$('fieldShot').value=id;showWalk(true);
  $('walkPosition').max=modelView.walk.stops.at(-1).metres;paintWalk(modelView.walkTransit?modelView.walkMetres:stop.metres);
}
function enterWalk(id){
  if(location.hash==='#station/luding/'+id){if(display==='model')selectWalk(id);else setDisplay('model');}
  else location.hash='#station/luding/'+id;
}
$('riverWalk').querySelector('nav').addEventListener('click',e=>{const b=e.target.closest('[data-walk]');if(b)enterWalk(b.dataset.walk);});
$('walkPosition').addEventListener('input',e=>modelView.walkBridge(Number(e.target.value)));
$('modelStage').addEventListener('walk-position',e=>{if(!$('riverWalk').hidden&&!stillWalk)paintWalk(e.detail);});
function restoreSceneCaption() {
  if(!active)return;
  showWalk(false);
  $('modelName').textContent=historyScenes[active.id][0];
  $('modelCaption').textContent=historyScenes[active.id][1];
  if(active.id==='luding')addDeckEntry();
  $('fieldShot').value='site';
}
$('modelReset').addEventListener('click', () => {restoreSceneCaption();modelView?.reset();});
$('modelNear').addEventListener('click', () => {restoreSceneCaption();modelView?.inspectDetail();});
$('objectMarker').addEventListener('click',()=>{
  if(display!=='model'||!active)return;
  $('fieldShot').value='tableau';$('fieldShot').dispatchEvent(new Event('change'));
  $('fieldShot').focus({preventScroll:true});
});
$('modelStage').addEventListener('keydown',e=>{if(e.key==='Home')restoreSceneCaption();});
$('modelStage').addEventListener('guide-load-error',()=>{
  restoreSceneCaption();$('modelStatus').textContent='行记员模型暂未载入，可重新选择镜头。';
});
$('fieldShot').addEventListener('change',()=>{
  if(!modelView||!active)return;
  const kind=$('fieldShot').value;
  if(active.id==='luding'&&walkKeys.includes(kind)){enterWalk(kind);return;}
  showWalk(false);
  if(kind==='site'){restoreSceneCaption();modelView.reset();return;}
  modelView.inspectDetail(kind);
  const data=modelView.scaleData;
  if(kind==='tableau'){
    const [title,note]=tableaux[active.id];
    $('modelName').textContent=title;
    $('modelCaption').textContent=note;
  }else if(kind==='resident'){
    $('modelName').textContent=active.name+' · 场景人物';
    $('modelCaption').textContent='人物为场景演绎。拖动视角，可近看衣着、双手和身边的物件。';
  }else if(kind==='guide'){
    $('modelName').textContent='行记员 · 虚构研学向导';
    $('modelCaption').textContent='从她的软帽、斜背包和红扣手记认出她。在主题展馆中，继续阅读她记录的山河与人物。';
  }else{
    $('modelName').textContent=kind==='boat'?'船工与渡船':'两岸之间';
    const link=document.createElement('a');
    link.href=data.scaleSource;link.target='_blank';link.rel='noopener';link.textContent=data.widthSource?'复制船资料 ↗':'河段资料 ↗';
    $('modelCaption').replaceChildren((kind==='boat' ? '模型船身 '+data.hullDimensions[0]+' × '+data.hullDimensions[1]+' 米。' : '')+data.scaleBasis+' ',link);
    if (data.widthSource) {
      const widthLink=link.cloneNode(false);widthLink.href=data.widthSource;widthLink.textContent='河宽口述 ↗';
      $('modelCaption').append(' · ',widthLink);
    }
  }
});

$('fitMap').addEventListener('click', event => {
  if (mode === 'overview' && ready) {
    event.preventDefault();
    beginFlight();
  }
});
$('zoomIn').addEventListener('click', () => { if (ready) world.zoom(1 / 1.34); });
$('zoomOut').addEventListener('click', () => { if (ready) world.zoom(1.34); });
$('orbitView').addEventListener('click', () => { if (ready) world.orbit(65, 35); });
$('shotButton').addEventListener('click', () => {
  if (!ready || !active || !places[active.id].close) return;
  const button = $('shotButton');
  const place = places[active.id];
  const close = button.getAttribute('aria-pressed') !== 'true';
  const shot = close ? place.close : place;
  setHistoricalView(false);
  $('sceneKind').textContent = place.tag;
  button.setAttribute('aria-pressed', String(close));
  button.lastElementChild.textContent = close ? '回到地貌全景' : place.close.label;
  beginFlight(false, shot);
});
historySwitch.addEventListener('click', () => {
  if (!ready || !active || !places[active.id].historic) return;
  const place = places[active.id];
  const historical = historySwitch.getAttribute('aria-pressed') !== 'true';
  const shot = historical ? place.historic : { ...place.historic, history: false, context: '今景 · 大渡河桥址' };
  setHistoricalView(historical);
  $('sceneKind').textContent = historical ? '泸定桥 · 史料复原' : place.tag;
  $('shotButton').setAttribute('aria-pressed', 'true');
  $('shotButton').lastElementChild.textContent = '回到地貌全景';
  beginFlight(false, shot);
});
function openStationMuseum(trigger){
  if(!active)return;
  void openMuseum({stationId:active.id,returnFocus:trigger,returnScene:stationViewHref(active.id,display)});
}
$('toggleReader').addEventListener('click',()=>openStationMuseum($('toggleReader')));
$('modelMuseum').addEventListener('click',()=>openStationMuseum($('modelMuseum')));
let filter = 'all';

function renderResults() {
  const query = $('search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = stations.filter(station => {

    const text = [station.number, station.name, station.title, station.region, station.date, station.base,
      places[station.id].tag, station.lead, station.people].join(' ').toLowerCase();
    return (filter === 'all' || station.kind === filter) && query.every(term => text.includes(term));
  });
  $('resultCount').textContent = '共 ' + matches.length + ' 处节点';
  $('results').innerHTML = matches.map(station => '<a class="result" href="' + href(station) + '/exhibit">' +
    '<img class="result-plate" alt="" loading="lazy" src="'+('assets/scene-studies/'+station.id+'.webp')+'"><span><small class="result-loc">' +
    station.number + ' / ' + station.name + '</small><b>' + station.title + '</b><small>' +
    station.region + ' · ' + station.date + '</small></span>' + icon('right') + '</a>').join('') ||
    '<p class="empty-results">没有匹配的节点，试试其他地名或事件。</p>';
}

$('search').addEventListener('input', renderResults);
$('filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  filter = button.dataset.filter;
  for (const option of $('filters').children) option.setAttribute('aria-pressed', option === button);
  renderResults();
});
$('results').addEventListener('click', event => {
  if (event.target.closest('a')) $('catalog').close();
});
for (const button of document.querySelectorAll('[data-dialog]')) {
  button.addEventListener('click', () => {
    if (button.dataset.dialog === 'catalog') renderResults();
    $(button.dataset.dialog).showModal();
  });
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}

window.addEventListener('longmarch-museum:open',()=>{
  if(world)world.suspended=true;
  modelView?.pauseForReading(true);
});
window.addEventListener('longmarch-museum:close',()=>{
  if(world)world.suspended=display!=='terrain';
  modelView?.pauseForReading(false);
});
