import { TerrainView } from './terrain-view.js?v=luding-studio-1';
import { chapters, places } from './places.js?v=luding-studio-1';
import { southernStories } from './story-south.js';
import { northernStories } from './story-north.js';
import { maoJourney } from './mao-journey.js';
import { HistoryView, historyScenes, detailViews } from './history-view.js?v=luding-studio-1';
import { modelSources } from './history-sources.js';
import { tableaux, showStudy } from './scene-studies.js?v=luding-studio-1';
import { createFieldGuide } from './field-lessons.js?v=luding-studio-1';
import { createPeopleNotes } from './people-notes.js';

const stories = { ...southernStories, ...northernStories };

const $ = (id) => document.getElementById(id);
const icon = (id) => '<svg aria-hidden="true"><use href="#i-' + id + '"/></svg>';
const href = (station) => '#station/' + station.id;
const byId = new Map(stations.map((station, index) => [station.id, { ...station, index }]));
const journeyHref = id => '#journey/' + id;
const chapterFor = (index) => chapters.findLastIndex(chapter => byId.get(chapter.start).index <= index);
const formatNumber = (value) => String(value).padStart(2, '0');
const numberFormat = new Intl.NumberFormat('zh-CN');
const mobile = matchMedia('(max-width: 720px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const walkKeys=['bridgehead','deck','pavilion'];
const walkNames=['桥头望全桥','桥上听水','回望桥亭'];
let stillWalk=false;
const selectedLabels = new Set(['yudu', 'xiangjiang', 'zunyi', 'jiaoping', 'luding', 'songpan', 'wuqi', 'huining']);
const mobileLabels = new Set(['yudu', 'zunyi', 'luding', 'wuqi']);
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
const tabs = [...document.querySelectorAll('[data-tab]')];
const peopleNotes = createPeopleNotes($('stationText'), stations);
$('tab-people').textContent = '沿途的人';
const renderFieldLesson = createFieldGuide($('studyPrompt'), stations, () => {
  setReaderExpanded(false);
  $(display === 'model' ? 'modelStage' : 'world').focus({ preventScroll: true });
});
const fieldEntry = document.createElement('button');
fieldEntry.type = 'button';
fieldEntry.className = 'field-guide-entry';
fieldEntry.setAttribute('aria-controls', 'studyPrompt');
fieldEntry.textContent = '行记研学';
$('toggleReader').before(fieldEntry);
const historySwitch = $('historyToggle');
const historyLabels = $('historicalLabels');
let active;
let mode = 'home';
let world;
let ready = false;
let loadFailed = false;
let stateVersion = 0;
let passageStation = null;
let journeyIndex = -1;
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
  for (const [index, entry] of maoJourney.entries()) {
    const station = byId.get(entry.id);
    const step = document.createElement('a');
    step.className = 'station-step ' + station.kind;
    step.href = journeyHref(station.id);
    step.title = station.name + ' · ' + entry.title;
    step.setAttribute('aria-label', '独白第 ' + (index + 1) + ' 站 · ' + station.name + ' · ' + entry.title);
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
  const named = mobile.matches ? mobileLabels : selectedLabels;
  const near = view.view.distance < 105;
  const scale = $('terrainScale');
  const bounds = view.near?.bounds;
  const limited = view.atZoomLimit();
  const refining = limited && view.refiningImagery();
  const bridgeEntry=view.canEnterLuding();
  $('zoomIn').disabled = (limited&&!bridgeEntry) || view.waitingForTerrain;
  const detailView = bounds && !view.historical && view.view.distance <= 13 &&
    view.view.x >= bounds[0] && view.view.x <= bounds[2] && view.view.z >= bounds[1] && view.view.z <= bounds[3];
  scale.hidden = !limited && !detailView;
  if (!scale.hidden) {
    const vectorVisible = view.near?.features?.visible && view.near.features.userData.count > 0;
    const detailLabel = mode === 'overview' ? '高程浮雕 · 分区设色' : vectorVisible ? '约 10 米卫星影像 · 现代地物' : '约 10 米卫星影像';
    const label = limited&&bridgeEntry?'已到影像清晰边界 · 继续靠近可进入桥头':refining ? '正在加载更清晰的影像' : limited ? (mode === 'overview' ? '已到清晰范围 · 点选节点看近景' :
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
    pin.classList.toggle('named', Boolean(landmark) || isActive || (!near && named.has(station.id)));
    pin.classList.toggle('left', point.x > view.size.width - 115 ||
      point.x > 112 && station.id === 'luding' && !near);
  }
}

function setTab(name) {
  const studying = name === 'study';
  for (const tab of tabs) {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
  }
  $('stationBody').setAttribute('aria-labelledby', 'tab-' + name);
  $('monologue').hidden = name !== 'event' || journeyIndex === -1;
  $('storyContent').hidden = name !== 'event' || journeyIndex !== -1;
  $('terrainInsight').hidden = studying || (name === 'event' && journeyIndex !== -1);
  peopleNotes.root.hidden = name !== 'people';
  $('studyPrompt').hidden = !studying;
  $('reader').dataset.tab = name;
  if (journeyIndex === -1) {
    setStationLink('prevStation', stations[active.index - 1], name);
    setStationLink('nextStation', stations[active.index + 1], name);
  }
}

function setStationLink(id, station, tab = 'event') {
  const link = $(id);
  link.href = station ? href(station) + (tab === 'event' ? '' : '/' + tab) : '#explore';
  link.querySelector('small').textContent = station ? (id === 'prevStation' ? '上一站' : '下一站') : '长征路线';
  link.querySelector('strong').textContent = station ? station.name : '返回全线';
}

function setReaderExpanded(expanded) {
  $('readerContents').hidden = !expanded;
  const toggle = $('toggleReader');
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.innerHTML = (expanded ? '收起 ' : '展开 ') + icon(expanded ? 'minus' : 'plus');
  $('reader').classList.toggle('is-collapsed', !expanded);
}

function renderStory(station) {
  const story = stories[station.id];
  $('storyTitle').textContent = story.title;
  $('storyLead').textContent = story.lead;
  $('storySections').replaceChildren(...story.sections.map(({ title, body }) => {
    const section = document.createElement('section');
    section.className = 'story-section';
    const heading = document.createElement('h4');
    heading.textContent = title;
    const paragraph = document.createElement('p');
    paragraph.textContent = body;
    section.append(heading, paragraph);
    return section;
  }));
  $('poemNote').hidden = !story.poem;
  if (story.poem) {
    $('poemTitle').textContent = story.poem.title;
    $('poemExcerpt').textContent = story.poem.excerpt;
    $('poemAnalysis').textContent = story.poem.body;
  }
  $('storyReferences').open = false;
  const [title, url] = modelSources[station.id];
  const sources = [{title: '场景取材 · ' + title, url}, ...story.sources.filter(source => source.url !== url)];
  $('sourceList').replaceChildren(...sources.map(source => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = source.title;
    item.append(link);
    return item;
  }));
  $('stationSource').hidden = sources.some(source => source.url === station.url);
}

function renderReader(station, chapter, place) {
  $('stationChapter').textContent = formatNumber(chapter + 1) + ' / ' + chapters[chapter].title;
  $('stationNumber').textContent = station.number + ' / ' + stations.length;
  $('stationTitle').textContent = station.title;
  $('stationRegion').textContent = station.region;
  $('stationDate').textContent = station.date;
  $('terrainTitle').textContent = place.title;
  $('terrainLook').textContent = place.look;
  renderStory(station);
  renderFieldLesson(station);
  peopleNotes.render(station);
  $('stationSource').href = station.url;
  $('stationSource').firstElementChild.textContent = station.source;
  $('readerScroll').scrollTop = 0;
  const entry = maoJourney[journeyIndex];
  $('tab-event').textContent = entry ? '独白与史实' : '长征故事';
  if (entry) {
    $('stationNumber').textContent = formatNumber(journeyIndex + 1) + ' / ' + formatNumber(maoJourney.length);
    $('monologueTitle').textContent = entry.title;
    $('monologueVoice').textContent = entry.voice;
    $('monologueTerrain').textContent = entry.terrain;
    $('monologueHistory').textContent = entry.history;
    $('monologueSource').href = entry.url;
    $('monologueSource').textContent = entry.source;
    $('monologueArchive').href = href(station);
    for (const [link, step] of [['prevStation', -1], ['nextStation', 1]]) {
      const next = maoJourney[journeyIndex + step];
      setStationLink(link, next ? byId.get(next.id) : null);
      if (next) $(link).href = journeyHref(next.id);
    }
  }
  $('detail').hidden = false;
  $('stationNav').hidden = false;
  setReaderExpanded(true);
  setTab('event');
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
    link.classList.toggle('reached', journeyIndex >= index);
    if (journeyIndex === index) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  const continuation = $('storyContinue');
  const next = maoJourney[journeyIndex + 1];
  continuation.href = next ? journeyHref(next.id) : '#explore';
  continuation.firstElementChild.textContent = journeyIndex < 0 ? '从于都开始' :
    next ? '下一站 · ' + byId.get(next.id).name : '回到全线';
  $('journeyPosition').textContent = journeyIndex < 0 ? '毛泽东视角 · 八站独白' :
    '独白 ' + formatNumber(journeyIndex + 1) + ' / ' + formatNumber(maoJourney.length);
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
  $('sceneKicker').textContent = journeyIndex < 0 ? active.number + ' / ' + stations.length :
    formatNumber(journeyIndex + 1) + ' / ' + formatNumber(maoJourney.length);
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
  showWalk(false);
  stillWalk=false;
  const request = ++modelRequest;
  ++stateVersion;
  document.body.dataset.display = next;
  $('world').inert = next !== 'terrain';
  $('specimen').hidden = next !== 'model';
  $('sceneViews').hidden = !active;
  $('fieldShot').hidden = true;
  $('fieldScale').hidden = true;
  $('modelClay').setAttribute('aria-pressed','false');
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
  const section=location.hash.split('/')[2],stop=walkKeys.includes(section)?section:'bridgehead';
  Object.assign(plate.style, {backgroundImage:station.id==='luding'?'url(assets/luding/stills/'+stop+'.webp)':'url(assets/valley/stills/'+station.id+'.webp?v=cinema-20261121)',
    backgroundSize:'cover',backgroundPosition:'center'});
  plate.setAttribute('aria-label', name + '的模型静帧');
  plate.hidden = false;
  $('modelStatus').textContent = '正在装入模型';
  const controls = document.querySelectorAll('.model-tools button');
  controls.forEach(button => button.disabled = true);
  (async () => {
    try {
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
      const labels={bridgehead:'桥头望全桥',deck:'桥上听水',pavilion:'回望桥亭',tableau:'史事现场',guide:'行记员近景',boat:'船工与渡船',reach:'两岸尺度'};
      $('fieldShot').replaceChildren(new Option('场景机位','site'),...Object.keys(modelView.fieldShots).map(key=>new Option(labels[key],key)));
      $('fieldShot').hidden=false;
      $('fieldScale').hidden=false;
      if(station.id==='luding'){
        const section=location.hash.split('/')[2];
        if(!section||walkKeys.includes(section)||section==='journal')selectWalk(walkKeys.includes(section)?section:'bridgehead');
        else addDeckEntry();
        if(section==='journal')modelView.pauseForReading(true);
      }
      window.dispatchEvent(new Event('atlas:scene-ready'));
      $('modelStatus').textContent = mobile.matches ? '单指环看 · 双指移动与缩放' : '拖动环看 · Shift 拖动平移 · 滚轮缩放';
      controls.forEach(button => button.disabled = false);
    } catch (error) {
      if (request !== modelRequest) return;
      $('modelStatus').textContent = '当前显示模型静帧';
      const notes=document.createElement('button');
      notes.type='button';notes.className='show-study';notes.textContent='翻开现场手记';
      notes.onclick=()=>showStudy(station.id,modelSources[station.id][1]);
      $('modelCaption').append('　',notes);
      if(station.id==='luding'){stillWalk=true;showStillWalk(stop);}
      arrivalStation=null;window.dispatchEvent(new Event('atlas:scene-ready'));
      console.warn('历史模型未加载', station.id, error.message);
    }
  })();
}

function updatePage(event) {
  const previousStation = active?.id;
  const previousJourney = journeyIndex;
  const hash = location.hash.slice(1);
  const stationRoute = /^station\/([^/]+)(?:\/(people|study|deck|bridgehead|pavilion|terrain|journal))?$/.exec(hash);
  const stationTab = stationRoute?.[2];
  journeyIndex = hash.startsWith('journey/') ? maoJourney.findIndex(entry => entry.id === hash.slice(8)) : -1;
  active = journeyIndex >= 0 ? byId.get(maoJourney[journeyIndex].id) :
    byId.get(stationRoute?.[1]);
  mode = active ? 'station' : hash ? 'overview' : 'home';
  document.body.dataset.mode = mode;
  document.body.dataset.journey = String(journeyIndex >= 0);
  if (journeyIndex >= 0) document.querySelector('.nav-journey').setAttribute('aria-current', 'true');
  else document.querySelector('.nav-journey').removeAttribute('aria-current');
  $('cover').hidden = mode !== 'home';
  $('hud').hidden = mode === 'home';
  $('reader').hidden = !active;
  $('pins').hidden = mode === 'home';
  if (mode !== 'overview') $('regionalLabels').hidden = true;
  passageStation = event && active && active.id !== previousStation ? active.id : null;
  $('scenePassage').hidden = true;
  $('reader').classList.remove('in-passage');
  if (passageStation) {
    $('passageIndex').textContent = journeyIndex < 0 ? '第 ' + active.number + ' 站 / ' + stations.length :
      '独白 ' + formatNumber(journeyIndex + 1) + ' / ' + formatNumber(maoJourney.length);
    $('passageTitle').textContent = maoJourney[journeyIndex]?.title || active.name;
    $('passageDate').textContent = active.date + ' · ' + active.region;
  }
  $('world').tabIndex = mode === 'home' ? -1 : 0;
  document.title = active ? active.title + ' · 山河之路' : '山河之路 · 长征纪念图集';
  updateHUD();
  const readOverTerrain=stationTab==='journal'&&previousStation==='luding'&&display==='terrain'&&ready;
  const nextDisplay = mode === 'home' ? 'cover' : mode === 'overview'||stationTab==='terrain'||readOverTerrain ? 'terrain' : walkKeys.includes(stationTab)||stationTab==='journal' ? 'model' :
    previousStation && (previousJourney >= 0) === (journeyIndex >= 0) ? display : journeyIndex >= 0 ? 'terrain' : 'model';
  const keepLuding=previousStation==='luding'&&active?.id==='luding'&&display==='model'&&nextDisplay==='model'&&
    ((modelView?.id==='luding'&&modelView.active&&$('modelPlate').hidden)||stillWalk);
  const closedJournal=event?.oldURL&&new URL(event.oldURL).hash==='#station/luding/journal';
  if(readOverTerrain){
    world.suspended=true;
  }else if(closedJournal&&nextDisplay==='terrain'&&display==='terrain'&&world?.focus==='luding'){
    world.suspended=false;
  }else if(keepLuding&&closedJournal&&(!stationTab||walkKeys.includes(stationTab))&&!$('riverWalk').hidden){
    modelView?.pauseForReading(false);
  }else if(keepLuding&&stationTab==='journal'){
    modelView?.pauseForReading(true);
  }else if(keepLuding&&walkKeys.includes(stationTab)){
    modelView?.pauseForReading(false);
    selectWalk(stationTab);
  }else{modelView?.pauseForReading(false);setDisplay(nextDisplay);}
  if (active && (stationTab==='people'||stationTab==='study')) {
    setReaderExpanded(true);
    setTab(stationTab);
  } else if (nextDisplay === 'model') {
    setReaderExpanded(false);
  }
  if (event) {
    const title = mode === 'home' ? 'coverTitle' : active && !$('readerContents').hidden ? 'stationTitle' : 'sceneTitle';
    $(title).focus({ preventScroll: true });
  }
}

makeTimeline();
makePins();
updatePage();
window.addEventListener('hashchange', updatePage);
window.addEventListener('wheel', event => {
  if (mode === 'home' && event.deltaY > 55 && !event.target.closest('button,nav') &&
    !document.querySelector('dialog[open]') && $('exhibitNavigation').hidden) $('cover').querySelector('.enter').click();
}, { passive: true });

function startTerrain() {
  $('loading').textContent = loadFailed ? '三维地形暂不可用，仍可阅读地点档案' : '正在展开山河';
  $('loading').hidden = false;
  terrainStartup ??= (async () => {
    try {
      world = new TerrainView($('world'), drawOverlay);
      await world.start(route);
      ready = true;
      document.body.classList.add('terrain-ready');
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
}

$('useSpecimen').addEventListener('click', () => {
  if (display === 'model') return;
  if(active?.id==='luding'){enterWalk('bridgehead');return;}
  setDisplay('model');
  if (mobile.matches) setReaderExpanded(false);
});
$('useTerrain').addEventListener('click', () => {
  if (display === 'terrain') return;
  if(active?.id==='luding'&&location.hash!=='#station/luding/terrain'){location.hash='station/luding/terrain';return;}
  updateHUD();
  setDisplay('terrain');
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
function showStillWalk(id){
  showWalk(true);$('riverWalk').dataset.still='true';
  $('modelPlate').style.backgroundImage='url(assets/luding/stills/'+id+'.webp)';
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
  if(modelView.clay){modelView.setClay(false);$('modelClay').setAttribute('aria-pressed','false');}
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
$('world').addEventListener('luding-arrival',()=>{if(display==='terrain'&&world?.canEnterLuding())enterWalk('bridgehead');});
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
$('modelClay').addEventListener('click',()=>{
  if(!modelView||display!=='model')return;
  const enabled=$('modelClay').getAttribute('aria-pressed')!=='true';
  $('modelClay').setAttribute('aria-pressed',String(enabled));modelView.setClay(enabled);
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
    const study=document.createElement('button');study.type='button';study.className='show-study';
    study.textContent='翻开现场手记';study.onclick=()=>showStudy(active.id,modelSources[active.id][1]);
    $('modelCaption').replaceChildren(note+' ',study);
    const people=document.createElement('a');
    people.href='#station/'+active.id+'/people';people.textContent='读这段历史 ↗';
    $('modelCaption').append('　',people);
  }else if(kind==='guide'){
    $('modelName').textContent='行记员 · 虚构研学向导';
    $('modelCaption').textContent='从她的软帽、斜背包和红扣手记认出她。打开研学手记，留下你在本站看见的证据。';
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
  if (!ready || !active) return;
  if(active.id==='luding'){enterWalk('bridgehead');return;}
  const button = $('shotButton');
  const place = places[active.id];
  const close = button.getAttribute('aria-pressed') !== 'true';
  const shot = close ? place.close : place;
  setHistoricalView(false);
  if (active.id === 'luding' || active.id === 'zunyi') setReaderExpanded(!close);
  $('sceneKind').textContent = place.tag;
  button.setAttribute('aria-pressed', String(close));
  button.lastElementChild.textContent = close ? '回到地貌全景' : place.close.label;
  beginFlight(false, shot);
});
historySwitch.addEventListener('click', () => {
  if (!ready || !active) return;
  if(active.id==='luding'){enterWalk('bridgehead');return;}
  const place = places[active.id];
  const historical = historySwitch.getAttribute('aria-pressed') !== 'true';
  const shot = historical ? place.historic : { ...place.historic, history: false, context: '今景 · 大渡河桥址' };
  setHistoricalView(historical);
  $('sceneKind').textContent = historical ? '泸定桥 · 史料复原' : place.tag;
  $('shotButton').setAttribute('aria-pressed', 'true');
  $('shotButton').lastElementChild.textContent = '回到地貌全景';
  if (historical) setReaderExpanded(false);
  beginFlight(false, shot);
});
$('toggleReader').addEventListener('click', () => setReaderExpanded($('readerContents').hidden));
fieldEntry.addEventListener('click', () => {
  setReaderExpanded(true);
  setTab('study');
  $('readerScroll').scrollTop = 0;
  $('tab-study').focus();
});

for (const tab of tabs) tab.addEventListener('click', () => setTab(tab.dataset.tab));
$('detail').querySelector('[role="tablist"]').addEventListener('keydown', event => {
  const index = tabs.indexOf(event.target);
  const offset = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (index < 0 || !['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
    (index + offset + tabs.length) % tabs.length;
  tabs[next].focus();
  setTab(tabs[next].dataset.tab);
});

let filter = 'all';

function renderResults() {
  const query = $('search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = stations.filter(station => {
    const story = stories[station.id];
    const text = [station.number, station.name, station.title, station.region, station.date, station.base,
      places[station.id].tag, story.title, story.poem?.title].join(' ').toLowerCase();
    return (filter === 'all' || station.kind === filter) && query.every(term => text.includes(term));
  });
  $('resultCount').textContent = '共 ' + matches.length + ' 处节点';
  $('results').innerHTML = matches.map(station => '<a class="result" href="' + href(station) + '">' +
    '<img class="result-plate" alt="" loading="lazy" src="assets/scene-studies/'+station.id+'.webp"><span><small class="result-loc">' +
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
