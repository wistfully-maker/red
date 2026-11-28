import { museumIntro, museumHalls, museumStations, museumReadingRoom } from './longmarch-museum-data.js?v=stories-final-20261127';
import {museumSceneHref,sceneModeFromHash} from './scene-navigation.js';

let museum,scrollPane,stationSelect,status,observer,restoreFocus,zoom,zoomReturn,styleReady,openSequence=0;
let currentStation=null;
let sceneReturn,returnOrigin='#explore';
const hallButtons=new Map();
const knownStation=id=>typeof id==='string'&&Object.hasOwn(museumStations,id);
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

function node(tag,cls,text){
  const e=document.createElement(tag);if(cls)e.className=cls;
  if(text!==undefined&&text!==null)e.textContent=String(text);return e;
}
function button(text,cls,action){const b=node('button',cls,text);b.type='button';b.addEventListener('click',action);return b;}
function external(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function asset(value){
  if(typeof value!=='string'||!/^assets\/[a-z0-9_()./\-]+\.(?:jpe?g|png|webp)$/i.test(value)||value.split('/').includes('..'))return null;
  const url=new URL(value,document.baseURI);
  if(value.startsWith('assets/valley/stills/'))url.searchParams.set('v','scene-layout-20261128');
  return url.href;
}
function link(label,value,cls='lm-source'){
  const href=external(value)||asset(value),e=node(href?'a':'span',cls,label);
  if(href){e.href=href;e.target='_blank';e.rel='noopener noreferrer';}return e;
}
function loadStyle(){
  if(styleReady)return styleReady;
  styleReady=new Promise(resolve=>{
    const sheet=node('link');sheet.rel='stylesheet';sheet.href=new URL('./longmarch-museum.css?v=scene-fixes-20261128',import.meta.url).href;
    sheet.addEventListener('load',resolve,{once:true});sheet.addEventListener('error',resolve,{once:true});document.head.append(sheet);
  });return styleReady;
}
function imageKind(image){return image.licenseUrl?'资料照片':/三维/.test(image.caption)?'三维场景示意':'场景绘图 · 含AI辅助';}
function addCredit(target,image){
  target.append(node('span','lm-media-kind',imageKind(image)),node('p','lm-caption',image.caption),node('p','lm-credit',image.credit));
  const refs=node('div','lm-image-refs');refs.append(link('原图与出处 ↗',image.source));
  if(image.licenseUrl)refs.append(link('图像许可 ↗',image.licenseUrl));target.append(refs);
}
function openImage(image,trigger){
  if(!asset(image.src))return;
  if(!zoom){
    zoom=node('dialog','lm-zoom');zoom.setAttribute('aria-label','资料图大图与出处');
    zoom.addEventListener('close',()=>{if(zoomReturn?.isConnected&&museum?.open)zoomReturn.focus({preventScroll:true});});
    document.body.append(zoom);
  }
  zoomReturn=trigger;
  const close=button('关闭大图 ×','lm-zoom-close',()=>zoom.close());
  const img=node('img');img.src=asset(image.src);img.alt=image.caption;
  const caption=node('div','lm-zoom-caption');addCredit(caption,image);
  zoom.replaceChildren(close,img,caption);if(!zoom.open)zoom.showModal();close.focus();
}
function gallery(images,title){
  const root=node('figure','lm-gallery');
  const frame=node('div','lm-photo-frame'),img=node('img');img.loading='lazy';img.decoding='async';img.width=960;img.height=640;
  const enlarge=button('查看大图 ↗','lm-enlarge',()=>openImage(images[selected],enlarge));
  frame.append(img,enlarge);const caption=node('figcaption'),thumbs=node('div','lm-thumbnails');thumbs.setAttribute('aria-label',title+'的资料图');
  let selected=0;
  const choices=images.map((image,i)=>{
    const b=button('','lm-thumbnail',()=>select(i));b.setAttribute('aria-label','查看第'+(i+1)+'张：'+image.caption);
    const t=node('img');t.src=asset(image.src)||'';t.alt='';t.loading='lazy';t.width=90;t.height=60;b.append(t,node('span','',String(i+1).padStart(2,'0')));return b;
  });
  function select(i){
    selected=i;const image=images[i];img.src=asset(image.src)||'';img.alt=image.caption;
    choices.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
    caption.replaceChildren();addCredit(caption,image);
  }
  thumbs.append(...choices);root.append(frame,thumbs,caption);if(images.length)select(0);return root;
}

function illustration(kind){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 240 220');svg.setAttribute('aria-hidden','true');
  const shape=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));svg.append(e);return e;};
  if(kind==='lantern'){
    shape('path',{d:'M91 60 C69 4 175 4 151 60 M83 176 L73 73 L167 73 L157 176 M85 176 Q120 191 155 176 M88 65 L152 65 M82 184 L158 184',fill:'none'});
    shape('path',{d:'M103 82 L95 165 Q120 177 145 165 L137 82 Z',fill:'none'});shape('path',{d:'M116 152 Q98 132 120 109 Q142 132 124 152',fill:'none'});
  }else if(kind==='document'){
    shape('path',{d:'M62 25 L166 25 L183 42 L183 194 L62 194 Z M166 25 L166 42 L183 42',fill:'none'});
    for(let i=0;i<7;i++)shape('line',{x1:79,y1:74+i*14,x2:i%3===0?151:165,y2:74+i*14});
    const text=shape('text',{x:78,y:55});text.textContent='1934 · 12 · 18';
  }else if(kind==='chain'){
    for(let i=0;i<4;i++)shape('ellipse',{cx:56+i*43,cy:88+(i%2)*26,rx:32,ry:17,transform:'rotate(-28 '+(56+i*43)+' '+(88+(i%2)*26)+')',fill:'none'});
    shape('line',{x1:39,y1:167,x2:204,y2:167});shape('line',{x1:39,y1:162,x2:39,y2:172});shape('line',{x1:204,y1:162,x2:204,y2:172});
  }else if(kind==='grain'){
    shape('path',{d:'M57 171 Q108 136 100 45 M100 131 Q136 104 138 45',fill:'none'});
    for(let i=0;i<5;i++){shape('ellipse',{cx:88,cy:58+i*16,rx:9,ry:4,transform:'rotate(35 88 '+(58+i*16)+')',fill:'none'});shape('ellipse',{cx:110,cy:63+i*16,rx:9,ry:4,transform:'rotate(-35 110 '+(63+i*16)+')',fill:'none'});}
    shape('rect',{x:135,y:128,width:67,height:57,rx:2,fill:'none'});const t=shape('text',{x:149,y:163});t.textContent='凭据';
  }else{
    shape('path',{d:'M48 183 L48 110 L192 110 L192 183 M93 183 L93 148 Q120 120 147 148 L147 183 M38 109 L120 85 L202 109 M65 95 L65 61 L175 61 L175 95 M47 61 L120 36 L193 61 M61 115 L61 173 M179 115 L179 173',fill:'none'});
    shape('path',{d:'M82 70 L82 87 M108 70 L108 87 M134 70 L134 87 M160 70 L160 87',fill:'none'});
  }
  return svg;
}
function objectCase(record,number){
  const box=node('section','lm-case');
  const display=node('div','lm-case-display');display.append(node('span','lm-case-number','观察台 / '+number),illustration(record.symbol),node('p','lm-diagram-note','结构与文字示意 · 非原件照片'));
  const text=node('div','lm-case-text');text.append(node('p','lm-kicker',record.category),node('h3','',record.title),node('p','lm-object-name',record.subtitle),node('p','',record.text));
  const look=node('details','lm-look');look.append(node('summary','',record.question));
  const list=node('ul');record.details.forEach(p=>list.append(node('li','',p)));look.append(list);text.append(look,node('p','lm-case-label',record.label),link(record.source.label+' ↗',record.source.url));box.append(display,text);return box;
}
function showHall(id){
  const hall=museumHalls.find(h=>h.id===id);if(!hall)return;
  hallButtons.forEach((b,key)=>{if(key===id)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  status.textContent='第'+hall.number+'展厅 · '+hall.name;
}
function moveTo(target,focus=true,immediate=false){
  if(!target||!museum.open)return;
  const y=target.getBoundingClientRect().top-scrollPane.getBoundingClientRect().top+scrollPane.scrollTop-24;
  scrollPane.scrollTo({top:Math.max(0,y),behavior:immediate||reduced()?'instant':'smooth'});
  if(focus)target.focus({preventScroll:true});
}
function enterHall(id){const heading=museum.querySelector('#lm-hall-'+id);showHall(id);moveTo(heading);}
function enterStation(id,immediate=false){
  if(!knownStation(id))return;
  currentStation=id;stationSelect.value=id;showHall(museumStations[id].hallId);moveTo(museum.querySelector('#lm-station-'+id),true,immediate);
  refreshSceneReturn();
}
function returnToScene(id){
  if(!knownStation(id))return;
  const destination=museumSceneHref(id,returnOrigin);
  closeMuseum();
  if(location.hash!==destination)location.hash=destination;
}
function refreshSceneReturn(){
  if(!sceneReturn)return;
  sceneReturn.hidden=!knownStation(currentStation);
  if(currentStation)sceneReturn.textContent='← 返回 '+museumStations[currentStation].name;
  const label=sceneModeFromHash(returnOrigin)==='model'?'历史现场':'地形实景';
  for(const control of museum.querySelectorAll('[data-scene-return]')){
    control.textContent='返回'+museumStations[control.dataset.sceneReturn].name+' · '+label+' ↗';
  }
}
function entrance(){
  currentStation=null;stationSelect.value='';hallButtons.forEach(b=>b.removeAttribute('aria-current'));status.textContent='序厅 · 五厅展线';
  refreshSceneReturn();
  scrollPane.scrollTo({top:0,behavior:reduced()?'instant':'smooth'});museum.querySelector('#lm-entrance-title').focus({preventScroll:true});
}
function stationExhibit(s){
  const section=node('section','lm-station');section.dataset.station=s.id;
  const header=node('header','lm-station-head');
  header.append(node('p','lm-kicker','地标 '+s.number+' / '+s.region+' / '+s.date));
  const title=node('h3','',s.name+'｜'+s.title);title.id='lm-station-'+s.id;title.tabIndex=-1;title.dataset.observeStation=s.id;
  const sceneLink=button('返回'+s.name+'的现场 ↗','lm-station-return',()=>returnToScene(s.id));
  sceneLink.dataset.sceneReturn=s.id;
  header.append(title,node('p','lm-station-lead',s.lead),sceneLink);
  const body=node('div','lm-station-grid'),text=node('div','lm-station-text');s.paragraphs.forEach(p=>text.append(node('p','',p)));
  for(const record of s.stories||[]){
    const story=node('section','lm-story');
    if(record.kind)story.append(node('p','lm-kicker',record.kind));
    story.append(node('h4','',record.title));
    for(const paragraph of record.body)story.append(node('p','',paragraph));
    if(record.source)story.append(link(record.source.label+' ↗',record.source.url,'lm-story-source'));
    text.append(story);
  }
  const question=node('aside','lm-station-question');question.append(node('span','','观察线索'),node('p','',s.observation));text.append(question);
  if(s.annotations.length){const more=node('details','lm-annotation');more.append(node('summary','','资料注释'));s.annotations.forEach(p=>more.append(node('p','',p)));text.append(more);}
  const refs=node('details','lm-annotation');refs.append(node('summary','','本展段的材料出处'));
  const list=node('ul','lm-source-list');s.sources.forEach(ref=>{const li=node('li');li.append(link(ref.label+' ↗',ref.url));list.append(li);});refs.append(list);text.append(refs);
  body.append(gallery(s.images,s.name),text);section.append(header,body);return section;
}
function hallExhibit(h,index){
  const section=node('section','lm-hall');section.dataset.hall=h.id;
  const header=node('header','lm-hall-head');
  const words=node('div','lm-hall-words');words.append(node('p','lm-kicker','第 '+h.number+' 展厅 / '+h.period));
  const title=node('h2','',h.name);title.id='lm-hall-'+h.id;title.tabIndex=-1;title.dataset.observeHall=h.id;
  words.append(title,node('h3','',h.title),node('p','lm-hall-lead',h.lead));
  const photo=node('figure','lm-hall-photo'),img=node('img');img.src=asset(h.cover.src)||'';img.alt=h.cover.caption;img.loading='lazy';img.width=960;img.height=640;
  photo.append(img,node('figcaption','',h.cover.caption));header.append(words,photo);
  const wall=node('div','lm-wall-text');h.wall.forEach(p=>wall.append(node('p','',p)));
  section.append(header,wall,objectCase(h.object,h.number));h.stations.forEach(id=>section.append(stationExhibit(museumStations[id])));
  const next=node('div','lm-doorway');next.append(node('span','',index<4?'沿展线继续':'展线之外，继续查阅'));
  if(index<4)next.append(button('第'+museumHalls[index+1].number+'厅 · '+museumHalls[index+1].name+' →','lm-next',()=>enterHall(museumHalls[index+1].id)));
  else next.append(button('进入史料阅览台 →','lm-next',()=>moveTo(museum.querySelector('#lm-reading-title'))));
  section.append(next);return section;
}
function createMuseum(){
  if(museum)return;
  museum=node('dialog','lm-museum');museum.id='longmarchMuseum';museum.setAttribute('aria-labelledby','lm-museum-title');
  const header=node('header','lm-header');
  const brand=node('div','lm-brand');brand.append(node('span','lm-seal','山河'),node('h1','',museumIntro.subtitle));brand.lastElementChild.id='lm-museum-title';
  sceneReturn=button('返回现场','lm-scene-return',()=>returnToScene(currentStation));sceneReturn.hidden=true;
  const controls=node('div','lm-header-controls');controls.append(sceneReturn,button('全展','lm-all',entrance),button('离开展馆 ×','lm-close',closeMuseum));header.append(brand,controls);
  const layout=node('div','lm-layout'),aside=node('aside','lm-sidebar'),nav=node('nav','lm-hall-nav');nav.setAttribute('aria-label','五个展厅');
  museumHalls.forEach(h=>{const b=button('','lm-hall-button',()=>enterHall(h.id));b.append(node('span','',h.number),node('strong','',h.name));nav.append(b);hallButtons.set(h.id,b);});
  const jump=node('label','lm-jump','从一个地点进入');stationSelect=node('select');stationSelect.setAttribute('aria-label','地点直达');stationSelect.append(new Option('十九个地标 · 选择地点',''));
  museumHalls.forEach(h=>{const group=node('optgroup');group.label=h.number+' '+h.name;h.stations.forEach(id=>group.append(new Option(museumStations[id].name,id)));stationSelect.append(group);});
  stationSelect.addEventListener('change',()=>{if(knownStation(stationSelect.value))enterStation(stationSelect.value);else entrance();});jump.append(stationSelect);
  const library=button('史料阅览台 ↗','lm-library-nav',()=>moveTo(museum.querySelector('#lm-reading-title')));
  status=node('p','lm-now','序厅 · 五厅展线');status.setAttribute('aria-live','polite');aside.append(nav,jump,library,status,node('p','lm-sidebar-note','主题展线，不代替不同部队的完整行程。'));
  scrollPane=node('div','lm-scroll');scrollPane.setAttribute('role','document');scrollPane.setAttribute('aria-label','长征主题展线');
  const intro=node('section','lm-entrance'),cover=node('img','lm-entrance-image');cover.src=asset(museumIntro.cover.src)||'';cover.alt=museumIntro.cover.caption;cover.fetchPriority='high';
  const content=node('div','lm-entrance-content');content.append(node('p','lm-kicker','1934 — 1936 / 多支队伍，共同记忆'));
  const title=node('h2','',museumIntro.title);title.id='lm-entrance-title';title.tabIndex=-1;
  content.append(title,node('p','lm-entrance-subtitle','人们怎样走过长征'),node('p','lm-entrance-lead',museumIntro.lead),button('进入第一展厅 →','lm-enter',()=>enterHall('departure')));
  intro.append(cover,content,node('p','lm-entrance-caption',museumIntro.cover.caption+' '+museumIntro.cover.credit));
  const introduction=node('div','lm-introduction');introduction.append(node('p','lm-kicker','观展提示'),node('p','',museumIntro.note),node('p','','资料照片保留拍摄时代与出处；场景绘图、模型和示意图另有标注。展馆的当代观察不冒作历史亲历。'));
  scrollPane.append(intro,introduction);museumHalls.forEach((h,i)=>scrollPane.append(hallExhibit(h,i)));
  const reading=node('section','lm-reading');const readingTitle=node('h2','','史料阅览台');readingTitle.id='lm-reading-title';readingTitle.tabIndex=-1;
  reading.append(node('p','lm-kicker','看见展品，也读它的来路'),readingTitle,node('p','lm-reading-lead','从公开目录、原始照片的整理线索和官方影像入口继续阅读。沿原始出处继续查阅影像与文献。'));
  const cards=node('div','lm-reading-grid');museumReadingRoom.forEach(r=>{const card=node('article','lm-reading-card');card.append(node('p','lm-kicker',r.kind),node('h3','',r.title),node('p','',r.description),link(r.source.label+' ↗',r.source.url));cards.append(card);});
  reading.append(cards,button('回到序厅 ↑','lm-enter',entrance));scrollPane.append(reading);
  layout.append(aside,scrollPane);museum.append(header,layout);document.body.append(museum);
  museum.addEventListener('cancel',e=>{e.preventDefault();closeMuseum();});
  museum.addEventListener('close',()=>{
    if(zoom?.open)zoom.close();const target=restoreFocus;restoreFocus=null;
    if(target instanceof HTMLElement&&target.isConnected)target.focus({preventScroll:true});
    window.dispatchEvent(new CustomEvent('longmarch-museum:close',{detail:{stationId:currentStation}}));
  });
  observer=new IntersectionObserver(entries=>{
    if(!museum.open)return;
    for(const entry of entries){if(!entry.isIntersecting)continue;
      if(entry.target.dataset.observeHall)showHall(entry.target.dataset.observeHall);
      const id=entry.target.dataset.observeStation;if(knownStation(id)){currentStation=id;stationSelect.value=id;showHall(museumStations[id].hallId);refreshSceneReturn();}
    }
  },{root:scrollPane,rootMargin:'-8% 0px -65% 0px',threshold:0});
  museum.querySelectorAll('[data-observe-hall],[data-observe-station]').forEach(e=>observer.observe(e));
}

export async function openMuseum({stationId,returnFocus,returnScene}={}){
  const sequence=++openSequence,origin=returnFocus instanceof HTMLElement?returnFocus:document.activeElement;
  await loadStyle();if(sequence!==openSequence)return museum||null;
  createMuseum();const wasOpen=museum.open;
  if(returnScene||!wasOpen)returnOrigin=returnScene||location.hash;
  refreshSceneReturn();
  if(!wasOpen||returnFocus instanceof HTMLElement)restoreFocus=origin;
  if(!wasOpen)museum.showModal();
  const id=knownStation(stationId)?stationId:null;
  museum.dataset.ready='false';
  window.dispatchEvent(new CustomEvent('longmarch-museum:open',{detail:{stationId:id}}));
  await new Promise(resolve=>requestAnimationFrame(resolve));
  if(museum.open&&sequence===openSequence){if(id)enterStation(id,true);else entrance();museum.dataset.ready='true';}
  return museum;
}
export function closeMuseum(){if(zoom?.open)zoom.close();if(museum?.open)museum.close();}
