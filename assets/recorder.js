const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

const entrance = document.querySelector('.cover .enter');
let entranceBounds;
function clearMagnet() {
  entranceBounds = null;
  entrance.style.removeProperty('--magnet-x');
  entrance.style.removeProperty('--magnet-y');
}
entrance.addEventListener('pointermove', event => {
  if (reducedMotion.matches || !finePointer.matches || event.pointerType !== 'mouse') return;
  entranceBounds ??= entrance.getBoundingClientRect();
  const { left, top, width, height } = entranceBounds;
  entrance.style.setProperty('--magnet-x', `${(event.clientX - left - width / 2) * .08}px`);
  entrance.style.setProperty('--magnet-y', `${(event.clientY - top - height / 2) * .16}px`);
});
entrance.addEventListener('pointerleave', clearMagnet);
window.addEventListener('resize', clearMagnet);
window.addEventListener('hashchange', clearMagnet);
reducedMotion.addEventListener('change', clearMagnet);
finePointer.addEventListener('change', clearMagnet);

const reader = document.getElementById('reader');
const contents = document.getElementById('readerContents');
const scroll = document.getElementById('readerScroll');
const folio = document.getElementById('stationNumber');
const folioMark = document.getElementById('archiveFolio');
const article = document.getElementById('detail');
const panel = document.getElementById('stationBody');
const title = document.querySelector('.scene-plate');
const subtitle = document.getElementById('sceneSub');
const routeBook = document.getElementById('routeBook');
const routeToggle = routeBook.querySelector('summary');
const stationRail = document.getElementById('stationRail');
const stationNames = new Map(stations.map(station => [station.id, station.name]));

function labelGuideStops() {
  for (const [index, link] of [...stationRail.children].entries()) {
    const name = stationNames.get(link.hash.split('/').at(-1));
    const number = document.createElement('span');
    number.className = 'step-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const text = document.createElement('span');
    text.className = 'step-name';
    text.textContent = name;
    link.replaceChildren(number, text);
  }
}
labelGuideStops();
new MutationObserver(labelGuideStops).observe(stationRail, { childList: true });

function closeRoute(event) {
  if (!routeBook.open || !routeBook.contains(event.target) || event.key !== 'Escape') return;
  event.preventDefault();
  routeBook.open = false;
  routeToggle.focus();
}
routeBook.addEventListener('keydown', closeRoute);
routeBook.addEventListener('click', event => {
  if (event.target.closest('a')?.hash === location.hash && document.body.dataset.mode === 'station') {
    routeBook.open = false;
    routeToggle.focus();
  }
});
document.addEventListener('pointerdown', event => {
  if (document.body.dataset.mode === 'station' && routeBook.open && !routeBook.contains(event.target)) {
    routeBook.open = false;
  }
}, { passive: true });

function syncReadingProgress() {
  const travel = scroll.scrollHeight - scroll.clientHeight;
  const progress = travel > 0 ? Math.min(1, Math.max(0, scroll.scrollTop / travel)) : 0;
  reader.style.setProperty('--reading-progress', progress);
}
scroll.addEventListener('scroll', syncReadingProgress, { passive: true });
const readingSize = new ResizeObserver(syncReadingProgress);
readingSize.observe(scroll);
readingSize.observe(article);

function syncFolio() { folioMark.textContent = folio.textContent; }
syncFolio();
new MutationObserver(syncFolio).observe(folio, { childList: true });

let panelReveal;
new MutationObserver(() => {
  panelReveal?.cancel();
  if (!reducedMotion.matches && !reader.hidden && !contents.hidden) {
    panelReveal = panel.animate([{ opacity: .58, translate: '0 5px' }, { opacity: 1, translate: '0 0' }], {
      duration: 220, easing: 'ease-out'
    });
  }
}).observe(panel, { attributes: true, attributeFilter: ['aria-labelledby'] });

const sceneReveals = new Map();

function reveal(element, duration, offset, delay = 0) {
  sceneReveals.get(element)?.cancel();
  if (reducedMotion.matches || document.body.dataset.mode === 'home') return;
  sceneReveals.set(element, element.animate([
    { opacity: 0, translate: `0 ${offset}px` },
    { opacity: 1, translate: '0 0' }
  ], { duration, delay, easing: 'cubic-bezier(.22,.75,.18,1)', fill: 'backwards' }));
}
new MutationObserver(() => reveal(title, 350, 8))
  .observe(document.getElementById('sceneTitle'), { childList: true });
new MutationObserver(() => reveal(subtitle, 390, 5, 100))
  .observe(subtitle, { childList: true });

const specimen = document.getElementById('specimen');
const routeLink = document.querySelector('.nav-route');
function syncMode() {
  const mode = document.body.dataset.mode;
  specimen.inert = mode === 'home';
  if (mode === 'overview') routeLink.setAttribute('aria-current', 'page');
  else routeLink.removeAttribute('aria-current');
}
syncMode();
new MutationObserver(syncMode).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
window.addEventListener('hashchange',()=>{routeBook.open=false;});
reducedMotion.addEventListener('change', () => {
  panelReveal?.cancel();
  sceneReveals.forEach(animation => animation.cancel());
});

for (const stage of [document.getElementById('modelStage'), document.getElementById('world')]) {
  const reticle = document.createElement('span');
  reticle.className = 'stage-reticle';
  reticle.setAttribute('aria-hidden', 'true');
  stage.append(reticle);
  let pointer;
  let bounds;

  function positionReticle(event) {
    if (event.pointerId !== pointer) return;
    reticle.style.setProperty('--reticle-x', `${event.clientX - bounds.left}px`);
    reticle.style.setProperty('--reticle-y', `${event.clientY - bounds.top}px`);
  }

  function clearReticle() {
    pointer = undefined;
    stage.classList.remove('stage-tracking');
  }

  stage.addEventListener('pointerdown', event => {
    if (document.body.dataset.mode === 'home' || event.target.closest('a, button') ||
        reducedMotion.matches || !finePointer.matches || event.pointerType !== 'mouse' || event.button !== 0) return;
    pointer = event.pointerId;
    bounds = stage.getBoundingClientRect();
    positionReticle(event);
    stage.classList.add('stage-tracking');
  }, { passive: true });
  stage.addEventListener('pointermove', positionReticle, { passive: true });
  stage.addEventListener('pointerleave', clearReticle);
  stage.addEventListener('lostpointercapture', clearReticle);
  window.addEventListener('pointerup', clearReticle);
  window.addEventListener('pointercancel', clearReticle);
  window.addEventListener('hashchange', clearReticle);
  window.addEventListener('blur', clearReticle);
  reducedMotion.addEventListener('change', clearReticle);
  finePointer.addEventListener('change', clearReticle);
}
