const key='map-welcome-seen-v1';
let dismissed=false;
try{dismissed=sessionStorage.getItem(key)==='yes';}catch{}
const card=document.createElement('section');
card.className='map-welcome';card.hidden=true;card.setAttribute('aria-label','地图浏览提示');
card.innerHTML='<span class="map-welcome-mark" aria-hidden="true">↗</span><div><h2>点击地名，进入详细节点</h2><p>先看实地景象，再走近历史与展馆。</p></div><button type="button">知道了</button>';
document.body.append(card);
function dismiss(){
  dismissed=true;card.hidden=true;
  try{sessionStorage.setItem(key,'yes');}catch{}
}
function update(){
  const onMap=['','#','#explore'].includes(location.hash);
  card.hidden=dismissed||!onMap||!document.body.classList.contains('terrain-ready')||
    !document.querySelector('#brandStage')?.hidden;
}
card.querySelector('button').addEventListener('click',dismiss);
card.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}});
document.querySelector('#pins').addEventListener('click',e=>{if(e.target.closest('a'))dismiss();});
window.addEventListener('hashchange',update);
new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class','data-mode']});
const stage=document.querySelector('#brandStage');
if(stage)new MutationObserver(update).observe(stage,{attributes:true,attributeFilter:['hidden']});
update();
