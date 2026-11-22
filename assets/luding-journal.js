import { journalMedia, journalSources, bridgeObservations, imageQuestion } from './luding-journal-data.js';

const journalHash = '#station/luding/journal';
const noteKey = 'long-march:field-note:luding';
const motionKey = 'long-march:journal-motion';
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let journal;
let noteDraft;
let returnFocusPending = false;
let returnHash = '#station/luding/study';
let previousOpener;

function journalReturnRoute(hash) {
  return /^#station\/luding(?:\/(?:bridgehead|deck|pavilion|terrain))?$/.test(hash)
    ? hash : '#station/luding/study';
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}
function sourceLink(id) {
  const source = journalSources.find(item => item.id === id);
  return `<a class="lj-cite" href="${source.url}" target="_blank" rel="noopener" aria-label="查阅${source.title}（新标签页）">[${id}] ↗</a>`;
}
function mediaFigure(key, className = '') {
  const media = journalMedia[key];
  const details = key === 'deck' ? '<button type="button" class="lj-photo-point lj-point-ring" data-photo-detail="ring" data-caption="ring" aria-controls="ljCaption" aria-label="观察一：相扣的铁环" aria-pressed="false">01</button><button type="button" class="lj-photo-point lj-point-boards" data-photo-detail="boards" data-caption="boards" aria-controls="ljCaption" aria-label="观察二：木板桥面" aria-pressed="false">02</button>' : '';
  return `<figure class="lj-figure ${className}" data-media="${key}">
    <div class="lj-image"><img src="${media.src}" alt="${escapeHTML(media.alt)}" decoding="async" ${key === 'bridge' ? '' : 'loading="lazy"'}><span class="lj-media-kind">${media.badge}</span>${details}</div>
    <figcaption><button type="button" class="lj-photo-title" data-caption="photo-${key}" aria-controls="ljCaption" aria-pressed="false">${media.title}<span aria-hidden="true">↗</span></button><p>${media.caption}</p><small>${media.credit} · ${media.licenseUrl ? `<a href="${media.licenseUrl}" target="_blank" rel="noopener">${media.license}</a>` : media.license}${media.source ? ` · <a href="${media.source}" target="_blank" rel="noopener">图源 ↗</a>` : ''}</small></figcaption>
  </figure>`;
}

function bridgeDiagram() {
  const chains = Array.from({length:9}, (_,i) => {
    const y=232+i*5;
    return `<path d="M100 ${y} Q390 ${y+92} 680 ${y}"/>`;
  }).join('');
  const boards = Array.from({length:30}, (_,i) => {
    const x=108+i*19;
    const y=232+88*(1-Math.pow((x-390)/290,2));
    return `<path d="M${x} ${y} l0 40"/>`;
  }).join('');
  return `<svg class="lj-bridge-svg" viewBox="0 0 780 430" role="img" aria-labelledby="ljDiagramTitle ljDiagramDesc">
    <title id="ljDiagramTitle">泸定桥构件关系示意</title><desc id="ljDiagramDesc">桥台固定铁链；9根底链上铺桥板，另4根扶手链分列两侧。示意不按比例，不表现战斗时拆板范围。</desc>
    <g class="lj-river-lines" fill="none" stroke="currentColor" stroke-width="1"><path d="M30 354q150-30 300 0t400 0M50 374q130-30 280 0t400 0M80 394q130-30 280 0t350 0"/></g>
    <g class="lj-abutments" fill="currentColor"><path d="M65 210h45v115H50v-45h15zM670 210h45v70h15v45h-60z"/></g>
    <g class="lj-bottom-chains" fill="none" stroke="currentColor" stroke-width="2">${chains}</g>
    <g class="lj-boards" fill="none" stroke="currentColor" stroke-width="13">${boards}</g>
    <g class="lj-rail-chains" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M100 138q290 184 580 0M100 159q290 184 580 0M100 179q290 184 580 0M100 200q290 184 580 0"/></g>
    <g fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 5"><path d="M100 138v94m0 21v19M680 138v94m0 21v19M237 204v93M527 209v89"/></g>
    <g class="lj-diagram-labels" fill="currentColor" font-size="14"><text x="365" y="401">大渡河</text><text x="50" y="350">桥台</text><text x="671" y="350">桥台</text><text x="286" y="103">9根底链 + 4根扶手链</text></g>
  </svg>`;
}

function buildJournal() {
  if (!document.querySelector('link[data-luding-journal]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = new URL('./luding-journal.css?v=scene-panel-20261121-2', import.meta.url).href;
    css.dataset.ludingJournal = ''; document.head.append(css);
  }
  const dialog = document.createElement('dialog');
  dialog.id = 'ludingJournal'; dialog.className = 'lj';
  dialog.setAttribute('aria-labelledby', 'ljTitle');
  dialog.innerHTML = `
    <header class="lj-top"><div class="lj-brand"><span aria-hidden="true">山河之路</span><span>行记员手记 / 09</span></div><div class="lj-tools"><button class="lj-motion" type="button" aria-pressed="false">减弱动效</button><button class="lj-close" type="button" aria-label="合上泸定行记">合上 <span aria-hidden="true">×</span></button></div><div class="lj-progress" aria-hidden="true"></div></header>
    <nav class="lj-chapters" aria-label="泸定行记篇章"><button type="button" data-jump="look"><span>01</span> 看现场</button><button type="button" data-jump="evidence"><span>02</span> 找证据</button><button type="button" data-jump="images"><span>03</span> 辨图像</button><button type="button" data-jump="note"><span>04</span> 留行记</button></nav>
    <div class="lj-scroll" tabindex="0" aria-label="泸定行记阅读区">
      <section class="lj-cover" aria-labelledby="ljTitle">
        <div class="lj-cover-heading"><p class="lj-eyebrow">四川 · 泸定 / 大渡河</p><h2 id="ljTitle">一座桥，<br><em>两段年代。</em></h2><p class="lj-cover-lead">先看桥，再看过桥的人。</p><div class="lj-cover-meta"><span>1706 · 桥梁建成</span><span>1935.05.29 · 飞夺泸定桥</span></div></div>
        ${mediaFigure('bridge', 'lj-cover-photo')}
        <div class="lj-cover-guide"><img src="${journalMedia.guide.src}" width="96" height="116" alt="${journalMedia.guide.alt}"><div><p class="lj-eyebrow">行记员 / 虚构研学向导</p><p>“一条铁索能把两岸接起来。<br>让整支队伍过去，还需要什么？”</p><small>当代研学提示 · 角色形象为艺术演绎</small></div></div>
        <button type="button" class="lj-begin" data-jump="look">随我看现场 <span aria-hidden="true">↓</span></button>
      </section>
      <section class="lj-section lj-look" id="lj-look" data-chapter="look" aria-labelledby="ljLookTitle">
        <div class="lj-section-title"><p class="lj-eyebrow">01 / 看现场</p><h3 id="ljLookTitle">把一座桥<br>看得更具体。</h3><p>先辨认构件，再理解通行。桥面、铁索与桥台，都是可以追问的线索。</p></div>
        <div class="lj-structure"><div class="lj-diagram" data-board="true">${bridgeDiagram()}<button type="button" class="lj-board-toggle" aria-pressed="false">移开示意桥板</button></div><p class="lj-figcaption">原创结构示意 · 不按比例。隐藏桥板用于辨认底链，不代表1935年拆板的具体范围。 ${sourceLink('S4')}</p><div class="lj-observe-tabs" role="group" aria-label="选择桥梁构件">${bridgeObservations.map((item,index)=>`<button type="button" data-observe="${index}" data-caption="structure-${index}" aria-controls="ljCaption" aria-pressed="${index===0}"><span>0${index+1}</span>${['底链','扶手链','桥台'][index]}</button>`).join('')}</div><div class="lj-observation" aria-live="polite" aria-atomic="true"></div></div>
      </section>
      <section class="lj-section lj-evidence" id="lj-evidence" data-chapter="evidence" aria-labelledby="ljEvidenceTitle">
        <div class="lj-section-title"><p class="lj-eyebrow">02 / 找证据</p><h3 id="ljEvidenceTitle">夺下桥头，<br>还要铺出通路。</h3><p>把“一次夺桥”放回渡河的连续任务，才会看见更多参与者。</p></div>
        <div class="lj-evidence-body"><div class="lj-time-pair"><article><span>1706</span><h4>先有一座通行的桥</h4><p>泸定桥在清康熙年间建成，连接大渡河两岸。它先是一条交通通道，后来成为长征的纪念地。 ${sourceLink('S1')}</p></article><article><span>1935</span><h4>后来有一场夺桥战斗</h4><p>5月25日，红军在安顺场强渡大渡河。水急、船少，摆渡难以及时运过主力；部队随后沿两岸向上游的泸定桥推进。 ${sourceLink('S2')}</p></article></div><div class="lj-cooperation"><p class="lj-eyebrow">1935年5月29日 / 相互接续的任务</p><ol><li><span>01</span><div><h4>火力掩护</h4><p>压制对岸火力，为突击与后续通行争取条件。</p></div></li><li><span>02</span><div><h4>攀索突击</h4><p>红四团22名突击队员向东桥头推进，夺取桥头。</p></div></li><li><span>03</span><div><h4>随后铺板</h4><p>后续队伍一边铺桥，一边前进，让更多人能够过河。</p></div></li></ol><p class="lj-task-note">掩护、突击和铺板互相配合。此处按任务分解，不能理解成互不重叠的三个时间段。 ${sourceLink('S2')}</p></div><aside class="lj-guide-question"><span>行记员问</span><p>如果只记住冲在最前面的人，<br>哪些劳动会从故事里消失？</p></aside></div>
      </section>
      <section class="lj-section lj-images" id="lj-images" data-chapter="images" aria-labelledby="ljImagesTitle">
        <div class="lj-section-title"><p class="lj-eyebrow">03 / 辨图像</p><h3 id="ljImagesTitle">画面会讲故事，<br>也要问它从哪里来。</h3><p>从远望走到桥面，看看先前看不清的铁环与木板。再把这张实拍，与桥头生活的艺术演绎放在一起。</p></div>
        <div class="lj-image-wall"><div class="lj-wall-real">${mediaFigure('deck')}<div class="lj-photo-observation" aria-label="照片细节说明"><div data-photo-copy="intro" class="is-active"><p>悬浮、聚焦或点选01与02：找一枚相扣的铁环，再辨认脚下木板的铺设方向。</p></div><div data-photo-copy="ring" aria-hidden="true"><h4>01 / 铁索，是一枚枚相扣的铁环</h4><p>沿左侧扶手链向近处看，椭圆铁环一个套着一个。再往下看，还能辨认另一条扶手链；照片让“铁索”从远处的一条线变成了具体构件。</p></div><div data-photo-copy="boards" aria-hidden="true"><h4>02 / 脚下不是一整块木面</h4><p>近处能看见横向排列的木条，以及沿通行方向铺设的长木板。这样的观察只说明2026年照片里的桥面；1935年的铺板样式还需另查材料。</p></div></div><p class="lj-boundary">${journalMedia.deck.boundary}</p></div><div class="lj-wall-art">${mediaFigure('life')}<p class="lj-boundary">${journalMedia.life.boundary}</p><aside class="lj-wall-note"><span aria-hidden="true">图 / 证</span><p>看见的<br>与知道的，<br><em>分开记。</em></p></aside></div></div>
        <fieldset class="lj-image-question"><legend>试着写一句有据的图注</legend><p id="ljImagePrompt">${imageQuestion.prompt}</p><div role="group" aria-labelledby="ljImagePrompt">${imageQuestion.choices.map(([label],i)=>`<button type="button" data-image-choice="${i}" aria-pressed="false"><span>0${i+1}</span>${label}</button>`).join('')}</div><p class="lj-answer" role="status" aria-live="polite"></p></fieldset>
      </section>
      <section class="lj-section lj-note-section" id="lj-note" data-chapter="note" aria-labelledby="ljNoteTitle">
        <div class="lj-section-title"><p class="lj-eyebrow">04 / 留行记</p><h3 id="ljNoteTitle">带着一个问题，<br>再看一眼桥。</h3><p>把观察、材料和疑问写成三句话。回到现场时，你会看得更仔细。</p><button type="button" class="lj-return-scene">回到泸定现场 ↗</button></div>
        <form class="lj-note-form"><label for="ljNote">我的泸定行记</label><p id="ljNoteHelp">我看见了……<br>材料 [S__] 告诉我……<br>我还想问……</p><textarea id="ljNote" rows="6" maxlength="300" aria-describedby="ljNoteHelp ljStorageHelp" placeholder="从你注意到的一根铁索、一块桥板，或一个人开始写。"></textarea><p id="ljStorageHelp">最多300字 · 保存在当前浏览器，与本站研学行记共用。</p><div class="lj-note-actions"><button type="submit">保存这页行记</button><button type="button" class="lj-download">下载文字</button></div><p class="lj-note-status" role="status" aria-live="polite"></p></form>
        <div class="lj-sources"><h4>这一页的资料依据</h4><p>以下是学习入口与后来的历史叙述。查阅时继续区分当时的记录、事后回忆与今天的讲解。</p>${journalSources.map(item=>`<details><summary><span>${item.id}</span>${item.title}</summary><p>${item.note}</p><a href="${item.url}" target="_blank" rel="noopener">查阅原文 ↗</a></details>`).join('')}<details><summary><span>图源</span>图像与角色说明</summary><p>${journalMedia.guide.boundary}</p><p>本页未使用战斗现场照片。2018年实景照片：${journalMedia.bridge.credit}，${journalMedia.bridge.license}，按原图色彩显示；封面有裁切。2026年桥面照片：${journalMedia.deck.credit}，${journalMedia.deck.license}；原图未调色或裁切，本页叠加观察编号。该照片及其改编继续按CC BY-SA 4.0提供。场景设计图与行记员肖像为项目既有生成式图像素材。</p><a href="${journalMedia.bridge.source}" target="_blank" rel="noopener">2018年照片与授权 ↗</a> · <a href="${journalMedia.deck.source}" target="_blank" rel="noopener">2026年照片与授权 ↗</a> · <a href="${journalMedia.deck.licenseUrl}" target="_blank" rel="noopener">CC BY-SA 4.0许可 ↗</a></details></div>
      </section><footer class="lj-footer"><span>山河之路 / 泸定手记</span><button type="button" data-jump="top">回到页首 ↑</button><span>观察 · 求证 · 记下</span></footer>
    </div><aside class="lj-caption" id="ljCaption" aria-label="行记员观察字幕"><img src="${journalMedia.guide.src}" width="44" height="52" alt=""><div class="lj-caption-area"><div class="lj-caption-layer is-active" aria-hidden="false"><strong>先看桥，再看过桥的人。</strong><span>让看见的细节，带出一个问题。</span></div><div class="lj-caption-layer" aria-hidden="true"><strong></strong><span></span></div></div><span class="lj-caption-mark" aria-hidden="true">行记员<br>观察提示</span><p class="lj-sr-only" role="status" aria-live="polite"></p></aside>`;
  document.body.append(dialog);
  const scroller = dialog.querySelector('.lj-scroll');
  const motion = dialog.querySelector('.lj-motion');
  let voluntaryReduction = false;
  try { voluntaryReduction = localStorage.getItem(motionKey) === 'reduce'; } catch {}
  function syncMotion() {
    const reduced = voluntaryReduction || motionPreference.matches;
    dialog.dataset.motion = reduced ? 'reduce' : 'full';
    motion.setAttribute('aria-pressed',String(reduced));
    motion.textContent = reduced ? '动效已减弱' : '减弱动效';
    motion.title = motionPreference.matches ? '已跟随系统减弱动态效果设置' : '切换行记中的过渡动效';
  }
  motion.onclick = () => {
    voluntaryReduction = !voluntaryReduction;
    try { localStorage.setItem(motionKey,voluntaryReduction ? 'reduce' : 'full'); } catch {}
    syncMotion();
  };
  motionPreference.addEventListener('change',syncMotion); syncMotion();
  dialog.querySelector('.lj-close').onclick = () => dialog.close();
  dialog.addEventListener('click', event => {
    if(event.target!==dialog)return;
    const bounds=dialog.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (location.hash === journalHash) {
      returnFocusPending = true;
      location.replace(returnHash);
    }
    document.dispatchEvent(new CustomEvent('luding-journal-closed',{detail:{returnHash,route:location.hash}}));
  });
  dialog.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => {
    const target = button.dataset.jump === 'top' ? null : dialog.querySelector('#lj-'+button.dataset.jump);
    scroller.scrollTo({ top:target ? target.offsetTop - 20 : 0, behavior:dialog.dataset.motion === 'reduce' ? 'instant' : 'smooth' });
  }));
  dialog.querySelector('.lj-return-scene').onclick = () => { location.hash='#station/luding'; dialog.close(); };
  dialog.querySelector('.lj-board-toggle').onclick = event => {
    const hidden = event.currentTarget.getAttribute('aria-pressed') !== 'true';
    event.currentTarget.setAttribute('aria-pressed',String(hidden));
    event.currentTarget.textContent=hidden?'放回示意桥板':'移开示意桥板';
    dialog.querySelector('.lj-diagram').dataset.board=String(!hidden);
  };
  function showObservation(index) {
    const observation=bridgeObservations[index];
    dialog.querySelector('.lj-observation').innerHTML=`<h4>${observation.title}</h4><p>${observation.body} ${sourceLink(observation.source)}</p><p class="lj-observe-question">${observation.question}</p>`;
    dialog.querySelectorAll('[data-observe]').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    dialog.querySelector('.lj-diagram').dataset.observation=String(index);
  }
  showObservation(0);
  const captions={
    'photo-bridge':['2018 · 从河岸远望','辨认桥亭、桥身与两岸的关系。'],
    'photo-deck':['2026 · 走到桥面上','点选照片编号，近看铁环和木板。'],
    'photo-life':['桥头日常 · 艺术演绎','这是场景设计，不是历史照片。'],
    'structure-0':['底链 · 托住桥面','9根底链上铺木板，另4根作扶手。'],
    'structure-1':['扶手链 · 分列两侧','看见“13根”各有分工。'],
    'structure-2':['桥台 · 固定两岸','不要只看江上的桥身。'],
    ring:['01 · 相扣的铁环','把远处的一条线，看成具体的构件。'],
    boards:['02 · 横纵铺设的木板','照片展示的是2026年的桥面。'],
  };
  let activeCaption='';let captionLayer=0;
  function activateCaption(key,announce){
    if(activeCaption===key)return;
    activeCaption=key;const [title,line]=captions[key];
    const layers=dialog.querySelectorAll('.lj-caption-layer');
    captionLayer=1-captionLayer;
    layers[captionLayer].querySelector('strong').textContent=title;
    layers[captionLayer].querySelector('span').textContent=line;
    layers.forEach((layer,index)=>{layer.classList.toggle('is-active',index===captionLayer);layer.setAttribute('aria-hidden',String(index!==captionLayer));});
    dialog.querySelectorAll('.lj-photo-title,[data-photo-detail]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.caption===key||((key==='ring'||key==='boards')&&button.dataset.caption==='photo-deck'))));
    if(key.startsWith('structure-'))showObservation(Number(key.split('-')[1]));
    if(key==='ring'||key==='boards'){
      dialog.querySelector('[data-media="deck"]').dataset.detail=key;
      dialog.querySelectorAll('[data-photo-copy]').forEach(copy=>{const active=copy.dataset.photoCopy===key;copy.classList.toggle('is-active',active);copy.setAttribute('aria-hidden',String(!active));});
    }
    if(announce)dialog.querySelector('.lj-caption .lj-sr-only').textContent=title+'。'+line;
  }
  dialog.querySelectorAll('[data-caption]').forEach(button=>{
    button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')activateCaption(button.dataset.caption,false);});
    button.addEventListener('focus',()=>activateCaption(button.dataset.caption,true));
    button.addEventListener('click',()=>activateCaption(button.dataset.caption,true));
  });
  dialog.querySelectorAll('[data-image-choice]').forEach(button => button.onclick=()=>{
    const index=Number(button.dataset.imageChoice);
    dialog.querySelectorAll('[data-image-choice]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    const feedback=dialog.querySelector('.lj-answer');
    feedback.textContent=(index===imageQuestion.answer?'判断有据。':'再对照图源。')+imageQuestion.choices[index][1];
    feedback.dataset.correct=String(index===imageQuestion.answer);
  });
  const textarea=dialog.querySelector('textarea');
  const status=dialog.querySelector('.lj-note-status');
  textarea.addEventListener('input',()=>{noteDraft=textarea.value;status.textContent='有未保存的修改';});
  dialog.querySelector('form').onsubmit=event=>{
    event.preventDefault();
    const value=textarea.value.trim();
    if(!value){status.textContent='先写下一条观察，再保存。';textarea.focus();return;}
    let stored=true;
    try{localStorage.setItem(noteKey,value);status.textContent='已保存到本站研学行记。';noteDraft=undefined;}
    catch{noteDraft=value;stored=false;status.textContent='当前浏览器无法持久保存；行记暂留本页，也可以下载文字。';}
    textarea.value=value;
    document.dispatchEvent(new CustomEvent('field-note-saved',{detail:{id:'luding',note:value,stored}}));
  };
  dialog.querySelector('.lj-download').onclick=()=>{
    if(!textarea.value.trim()){status.textContent='先写下行记，再下载。';textarea.focus();return;}
    const blob=new Blob(['山河之路 · 泸定行记\n\n'+textarea.value.trim()+'\n\n资料入口\n'+journalSources.map(s=>s.id+' '+s.title+'\n'+s.url).join('\n\n')],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='山河之路-泸定行记.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='已下载行记文字与资料链接。';
  };
  // Readable without animations; section highlighting follows the native scroll position.
  let scheduled=false;
  function updateProgress(){
    scheduled=false;
    const max=scroller.scrollHeight-scroller.clientHeight;
    dialog.style.setProperty('--lj-progress',max>0?Math.min(1,scroller.scrollTop/max):0);
    let current='';
    for(const section of dialog.querySelectorAll('[data-chapter]')){
      if(section.offsetTop-scroller.scrollTop<scroller.clientHeight*.4)current=section.dataset.chapter;
    }
    dialog.querySelectorAll('.lj-chapters button').forEach(button=>{
      if(button.dataset.jump===current)button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    });
  }
  scroller.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateProgress);}},{passive:true});
  new ResizeObserver(updateProgress).observe(scroller);
  return dialog;
}

export function openLudingJournal(options = {}) {
  journal ??= buildJournal();
  if(!journal.open){
    previousOpener=document.activeElement;
    returnHash=journalReturnRoute(options.returnHash || (location.hash!==journalHash?location.hash:'#station/luding/study'));
  }
  const textarea=journal.querySelector('textarea');
  try{textarea.value=noteDraft??localStorage.getItem(noteKey)??'';}catch{textarea.value=noteDraft??'';}
  if(location.hash!==journalHash)location.hash=journalHash;
  if(!journal.open){
    // The field-notes dialog may be the entry point; avoid stacked modal surfaces.
    document.getElementById('studyPlateDialog')?.close();
    journal.showModal();
    journal.querySelector('.lj-close').focus({preventScroll:true});
  }
}

function syncJournalRoute(event){
  if(location.hash===journalHash)openLudingJournal({returnHash:event?.oldURL?new URL(event.oldURL).hash:undefined});
  else if(journal?.open)journal.close();
  if(returnFocusPending){
    returnFocusPending=false;
    requestAnimationFrame(()=>{
      if(location.hash===returnHash){
        const opener=previousOpener?.isConnected&&previousOpener!==document.body&&previousOpener.getClientRects().length?previousOpener:null;
        const fallback=returnHash==='#station/luding/study'
          ? document.querySelector('.field-journal-entry')||document.getElementById('tab-study')
          : document.querySelector('#riverWalk a[href="'+journalHash+'"]')||document.getElementById('modelStage');
        (opener||fallback)?.focus({preventScroll:true});
      }
    });
  }
}
window.addEventListener('hashchange',syncJournalRoute);
if(location.hash===journalHash)queueMicrotask(syncJournalRoute);
