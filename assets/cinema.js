import {mountExhibitionAudio} from './exhibition-audio.js?v=continuous-loop-20261128';
const menu=document.getElementById('exhibitNavigation'),toggle=document.getElementById('cinemaMenu');
function menuState(open,restore=false){menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(restore)toggle.focus();}
toggle.addEventListener('click',()=>menuState(menu.hidden));
menu.addEventListener('click',e=>{if(e.target.closest('button,a'))menuState(false);});
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('#cinemaMenu,#exhibitNavigation'))menuState(false);},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){menuState(false,true);e.preventDefault();}});
document.addEventListener('focusin',e=>{if(!menu.hidden&&!e.target.closest('#cinemaMenu,#exhibitNavigation'))menuState(false);});
window.addEventListener('hashchange',()=>menuState(false));
const audioHome=document.querySelector('.cinema-tools');
mountExhibitionAudio(audioHome);
window.addEventListener('longmarch-museum:open',()=>{
  const controls=document.querySelector('.lm-header-controls');
  if(controls)mountExhibitionAudio(controls);
});
window.addEventListener('longmarch-museum:close',()=>mountExhibitionAudio(audioHome));

