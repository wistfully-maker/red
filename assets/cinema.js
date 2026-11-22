const openings = {
  luding:{title:'铁索横江',place:'四川 · 泸定',date:'1935 年 5 月',lead:'走到大渡河边，看铁索如何把两岸的人连在一起。',enter:'走进泸定桥',coordinate:'29°54′52″ N　102°13′49″ E',arrival:'大渡河 · 泸定桥'},
  yudu:{title:'于都夜渡',place:'江西 · 于都',date:'1934 年 10 月',lead:'一扇家门，一只木船。在六百多米宽的河面上，它们成了同一条路。',enter:'走进于都渡口',coordinate:'江西赣南　于都河畔',arrival:'赣南 · 于都渡口'},
  zunyi:{title:'灯下遵义',place:'贵州 · 遵义',date:'1935 年 1 月',lead:'沿木梯上楼。长桌、藤椅与一盏吊灯，留下了一次会议的空间尺度。',enter:'走进遵义会址',coordinate:'贵州黔北　子尹路',arrival:'遵义 · 二楼会客室'}
};
const keys=Object.keys(openings);
const byId=id=>document.getElementById(id);
const cover=byId('cover'),landscape=cover.querySelector('.cinema-landscape'),copy=cover.querySelector('.cover-inner');
const enter=cover.querySelector('.enter'),reel=[...cover.querySelectorAll('[data-scene]')];
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
let selected='luding',serial=0,portalTimer,exitTimer,departing=false;
function choose(id,focus=false){
 if(!openings[id])return;
 const item=openings[id],request=++serial;
 selected=id;
 reel.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===id)));
 byId('coverTitle').textContent=item.title;byId('openingDate').textContent=item.date;byId('openingPlace').textContent=item.place;
 byId('openingLead').textContent=item.lead;byId('openingCoordinate').textContent=item.coordinate;
 enter.href='#station/'+id;enter.firstElementChild.textContent=item.enter;
 byId('openingStory').href='#station/'+id+(id==='luding'?'/journal':'/people');
 byId('openingStory').firstElementChild.textContent=id==='luding'?'行记员手记':'沿途的人';
 let frame=landscape.querySelector('[data-plate="'+id+'"]');
 if(!frame){frame=new Image();frame.className='cinema-frame';frame.alt='';frame.dataset.plate=id;frame.src='assets/cinema/'+id+'.webp';landscape.append(frame);}
 const paint=()=>{
  if(request!==serial)return;
  [...landscape.children].forEach(el=>el.classList.toggle('is-current',el===frame));
  copy.classList.remove('is-changing');void copy.offsetWidth;copy.classList.add('is-changing');
 };
 if(frame.complete && frame.naturalWidth)paint();else frame.decode().then(paint,paint);
 if(focus)reel.find(b=>b.dataset.scene===id).focus();
 updateSound();
}
reel.forEach((b,i)=>{
 b.onclick=()=>choose(b.dataset.scene);
 b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
  const n=e.key==='Home'?0:e.key==='End'?keys.length-1:(i+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
  choose(keys[n],true);};
});
cover.addEventListener('pointermove',e=>{
 if(reduced.matches || e.pointerType!=='mouse')return;
 landscape.style.setProperty('--pan-x',((.5-e.clientX/innerWidth)*8)+'px');
 landscape.style.setProperty('--pan-y',((.5-e.clientY/innerHeight)*6)+'px');
},{passive:true});
let touch;
cover.addEventListener('touchstart',e=>{if(!e.target.closest('button,a'))touch=[e.touches[0].clientX,e.touches[0].clientY];},{passive:true});
cover.addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch[0],dy=e.changedTouches[0].clientY-touch[1];touch=null;
 if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.6)choose(keys[(keys.indexOf(selected)+(dx<0?1:-1)+keys.length)%keys.length]);},{passive:true});

const menu=byId('exhibitNavigation'),toggle=byId('cinemaMenu');
function menuState(open,restore=false){menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(restore)toggle.focus();}
toggle.addEventListener('click',()=>menuState(menu.hidden));
menu.addEventListener('click',e=>{if(e.target.closest('button,a'))menuState(false);});
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('#cinemaMenu,#exhibitNavigation'))menuState(false);},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){menuState(false,true);e.preventDefault();}});
document.addEventListener('focusin',e=>{if(!menu.hidden&&!e.target.closest('#cinemaMenu,#exhibitNavigation'))menuState(false);});

const portal=byId('cinemaPortal');
function reveal(immediate=false){
 if(!departing)return;
 clearTimeout(portalTimer);clearTimeout(exitTimer);
 if(immediate||reduced.matches){portal.hidden=true;departing=false;return;}
 portal.classList.add('revealed');
 exitTimer=setTimeout(()=>{portal.hidden=true;departing=false;},880);
}
enter.addEventListener('click',e=>{
 if(e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||departing)return;
 const id=enter.hash.split('/')[1], item=openings[id];
 const imageUrl=new URL('assets/cinema/'+id+'.webp',document.baseURI);
 departing=true;portal.classList.remove('revealed');portal.style.setProperty('--departure','url("'+imageUrl.href+'")');
 portal.firstElementChild.textContent=item.arrival;portal.hidden=false;
 window.dispatchEvent(new CustomEvent('cinema:arrive',{detail:id}));
 portalTimer=setTimeout(()=>reveal(),7000);
});
window.addEventListener('atlas:scene-ready',()=>reveal());
window.addEventListener('hashchange',()=>{menuState(false);if(!location.hash.startsWith('#station/'))reveal(true);updateSound();});

// Low-volume river, wind and interior room tone. Sound starts only on request.
let ctx,master,wind,flow,on=false;
function updateSound(){
 if(!ctx)return;
 const id=location.hash.split('/')[1]||selected;
 const t=ctx.currentTime;
 wind.frequency.setTargetAtTime(id==='zunyi'?240:id==='yudu'?760:1400,t,.7);
 flow.frequency.setTargetAtTime(id==='zunyi'?85:id==='yudu'?170:340,t,.8);
 master.gain.setTargetAtTime(on&&!document.hidden?(id==='zunyi'?.07:.14):0,t,.32);
}
byId('soundscape').addEventListener('click',async()=>{
 try{
  if(!ctx){
   ctx=new AudioContext();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
   const buf=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate),data=buf.getChannelData(0);
   let brown=0;for(let i=0;i<data.length;i++){brown=(brown+.105*(Math.random()*2-1))*.976;data[i]=brown*.7+(Math.random()-.5)*.19;}
   const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
   wind=ctx.createBiquadFilter();wind.type='lowpass';flow=ctx.createBiquadFilter();flow.type='bandpass';flow.Q.value=.52;
   src.connect(wind);src.connect(flow);wind.connect(master);flow.connect(master);src.start();
   const lfo=ctx.createOscillator(),gain=ctx.createGain();lfo.frequency.value=.078;gain.gain.value=75;lfo.connect(gain);gain.connect(wind.frequency);lfo.start();
  }
  await ctx.resume();on=!on;updateSound();
  byId('soundscape').setAttribute('aria-pressed',String(on));byId('soundscape').setAttribute('aria-label',on?'关闭环境声':'开启环境声');byId('soundText').textContent=on?'关闭环境声':'开启环境声';
 }catch{byId('soundText').textContent='环境声暂不可用';}
});
document.addEventListener('visibilitychange',updateSound);
function positionSound(){
 const holder=location.hash?document.querySelector('.cinema-tools'):document.querySelector('.cinema-audio');
 holder.prepend(byId('soundscape'));
}
positionSound();window.addEventListener('hashchange',positionSound);

