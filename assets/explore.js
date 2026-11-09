import { TerrainView } from './terrain-view.js';
import { chapters, places } from './places.js';
import { southernStories } from './story-south.js';
import { northernStories } from './story-north.js';

const stories = { ...southernStories, ...northernStories };

const $ = (id) => document.getElementById(id);
const icon = (id) => '<svg aria-hidden="true"><use href="#i-' + id + '"/></svg>';
const href = (station) => '#station/' + station.id;
const byId = new Map(stations.map((station, index) => [station.id, { ...station, index }]));
const chapterFor = (index) => chapters.findLastIndex(chapter => byId.get(chapter.start).index <= index);
const formatNumber = (value) => String(value).padStart(2, '0');
const numberFormat = new Intl.NumberFormat('zh-CN');
const mobile = matchMedia('(max-width: 720px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
const historySwitch = $('historyToggle');
const historyLabels = $('historicalLabels');
let active;
let mode = 'home';
let world;
let ready = false;
let loadFailed = false;
let stateVersion = 0;
let passageStation = null;

function makeTimeline() {
  $('timeline').innerHTML = chapters.map((chapter, i) =>
    '<a href="#station/' + chapter.start + '" data-chapter="' + i + '">' +
    '<span class="chapter-no">' + formatNumber(i + 1) + '</span><span><strong>' + chapter.title +
    '</strong><small>' + chapter.date + '</small></span></a>'
  ).join('');
  for (const station of stations) {
    const step = document.createElement('a');
    step.className = 'station-step ' + station.kind;
    step.href = href(station);
    step.title = station.number + ' · ' + station.name;
    step.setAttribute('aria-label', '第 ' + station.number + ' 站 · ' + station.name + ' · ' + station.title);
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
  if (mode === 'home') return;
  const current = Math.floor(performance.now() / 25);
  if (current === overlayFrame) return;
  overlayFrame = current;
  drawPassage(view);
  const named = mobile.matches ? mobileLabels : selectedLabels;
  const near = view.view.distance < 105;
  const scale = $('terrainScale');
  const bounds = view.near?.bounds;
  const limited = view.atZoomLimit();
  $('zoomIn').disabled = limited || view.waitingForTerrain;
  const detailView = bounds && !view.historical && view.view.distance <= 13 &&
    view.view.x >= bounds[0] && view.view.x <= bounds[2] && view.view.z >= bounds[1] && view.view.z <= bounds[3];
  scale.hidden = !limited && !detailView;
  if (!scale.hidden) {
    const vectorVisible = view.near?.features?.visible && view.near.features.userData.count > 0;
    const detailLabel = vectorVisible ? '约 10 米卫星影像 · 现代地物' : '约 10 米卫星影像';
    const label = limited ? (mode === 'overview' ? '已到清晰范围 · 点选节点看近景' :
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
      if (!label.hidden) label.style.transform = 'translate(' + Math.round(point.x) + 'px, ' + Math.round(point.y) + 'px)';
    }
  }
  for (const station of stations) {
    const pin = pinElements.get(station.id);
    const point = view.screen(station.id);
    const isActive = active?.id === station.id;
    pin.hidden = !point || (view.flight && view.flight.distanceTravelled < .45 && !isActive) ||
      (view.historical && view.view.distance < .9);
    if (pin.hidden) continue;
    pin.style.transform = 'translate3d(' + Math.round(point.x) + 'px,' + Math.round(point.y) + 'px,0)';
    pin.classList.toggle('named', isActive || (!near && named.has(station.id)));
    pin.classList.toggle('left', point.x > view.size.width - 115 ||
      point.x > 112 && station.id === 'luding' && !near);
  }
}

function setTab(name) {
  const content = { people: active.people, study: active.base };
  for (const tab of tabs) {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
  }
  $('stationBody').setAttribute('aria-labelledby', 'tab-' + name);
  $('storyContent').hidden = name !== 'event';
  $('stationText').hidden = name === 'event';
  $('stationText').textContent = content[name] || '';
  $('studyPrompt').hidden = name !== 'study';
}

function setStationLink(id, station) {
  const link = $(id);
  link.href = station ? href(station) : '#explore';
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

function renderStory(station, chapter) {
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
  $('studyQuestion').textContent = story.question.prompt;
  $('studyAnalysis').textContent = story.question.reveal;
  $('chapterQuestion').textContent = chapters[chapter].question;
  $('studyReveal').open = false;
  $('storyReferences').open = false;
  $('sourceList').replaceChildren(...story.sources.map(source => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = source.title;
    item.append(link);
    return item;
  }));
  $('stationSource').hidden = story.sources.some(source => source.url === station.url);
}

function renderReader(station, chapter, place) {
  $('stationChapter').textContent = formatNumber(chapter + 1) + ' / ' + chapters[chapter].title;
  $('stationNumber').textContent = station.number + ' / ' + stations.length;
  $('stationTitle').textContent = station.title;
  $('stationRegion').textContent = station.region;
  $('stationDate').textContent = station.date;
  $('terrainTitle').textContent = place.title;
  $('terrainLook').textContent = place.look;
  renderStory(station, chapter);
  $('stationSource').href = station.url;
  $('stationSource').firstElementChild.textContent = station.source;
  $('readerScroll').scrollTop = 0;
  setStationLink('prevStation', stations[station.index - 1]);
  setStationLink('nextStation', stations[station.index + 1]);
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
    link.classList.toggle('reached', Boolean(active && index <= active.index));
    if (active?.index === index) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  const continuation = $('storyContinue');
  const next = active ? stations[active.index + 1] : stations[0];
  continuation.href = next ? href(next) : '#explore';
  continuation.firstElementChild.textContent = !active ? '从瑞金出发' : next ? '下一站 · ' + next.name : '回到全线';
  $('journeyPosition').textContent = active ?
    '第 ' + active.number + ' 站 / ' + stations.length + ' · ' + chapters[chapter].title : '四幕 · 十九站';
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
    $('sceneSub').textContent = '从毛泽东与中共中央的抉择，读到各路红军会师';
    return;
  }
  const place = places[active.id];
  if (place.close) shotButton.lastElementChild.textContent = place.close.label;
  $('sceneKicker').textContent = active.number + ' / ' + stations.length;
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
  if (!ready) return;
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

function updatePage(event) {
  const previousStation = active?.id;
  const hash = location.hash.slice(1);
  active = hash.startsWith('station/') ? byId.get(hash.slice(8)) : null;
  mode = active ? 'station' : hash ? 'overview' : 'home';
  document.body.dataset.mode = mode;
  $('cover').hidden = mode !== 'home';
  $('hud').hidden = mode === 'home';
  $('reader').hidden = !active;
  $('pins').hidden = mode === 'home';
  if (mode !== 'overview') $('regionalLabels').hidden = true;
  passageStation = event && active && active.id !== previousStation ? active.id : null;
  $('scenePassage').hidden = true;
  $('reader').classList.remove('in-passage');
  if (passageStation) {
    $('passageIndex').textContent = '第 ' + active.number + ' 站 / ' + stations.length;
    $('passageTitle').textContent = active.name;
    $('passageDate').textContent = active.date + ' · ' + active.region;
  }
  $('world').tabIndex = mode === 'home' ? -1 : 0;
  document.title = active ? active.title + ' · 山河之路' : '山河之路 · 长征纪念图集';
  updateHUD();
  beginFlight();
  if (event) {
    const title = mode === 'home' ? 'coverTitle' : active ? 'stationTitle' : 'sceneTitle';
    $(title).focus({ preventScroll: true });
  }
}

makeTimeline();
makePins();
updatePage();
window.addEventListener('hashchange', updatePage);
window.addEventListener('wheel', event => {
  if (mode === 'home' && ready && event.deltaY > 12 && !document.querySelector('dialog[open]')) location.hash = 'explore';
}, { passive: true });

try {
  world = new TerrainView($('world'), drawOverlay);
  await world.start(route);
  ready = true;
  document.body.classList.add('terrain-ready');
  $('loading').hidden = true;
  beginFlight(true);
} catch (error) {
  loadFailed = true;
  console.warn('无法初始化三维地形', error.message);
  document.body.classList.add('terrain-unavailable');
  $('loading').textContent = '三维地形暂不可用，仍可阅读地点档案';
}

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
  if (!ready || !active) return;
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
    '<span class="chapter-no">' + station.number + '</span><span><b>' + station.title + '</b><small>' +
    station.name + ' · ' + places[station.id].tag + '</small></span>' + icon('right') + '</a>').join('') ||
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

if (loadFailed) {
  for (const id of ['zoomIn', 'zoomOut', 'orbitView', 'historyToggle']) $(id).disabled = true;
}
