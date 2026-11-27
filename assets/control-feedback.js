const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const selector='button:not([disabled]),.opening-links a,.station-nav a,.edition-map-link';
document.addEventListener('pointermove',event=>{
  if(reduce.matches||event.pointerType!=='mouse')return;
  const control=event.target.closest(selector);
  if(!control)return;
  const box=control.getBoundingClientRect();
  control.style.setProperty('--pointer-x',(event.clientX-box.left)+'px');
  control.style.setProperty('--pointer-y',(event.clientY-box.top)+'px');
},{passive:true});
document.addEventListener('pointerdown',event=>{
  if(reduce.matches)return;
  const control=event.target.closest(selector);
  if(!control)return;
  const bounds=control.getBoundingClientRect();
  const ripple=document.createElement('i');
  ripple.className='control-ripple';ripple.setAttribute('aria-hidden','true');
  const radius=Math.max(bounds.width,bounds.height)*1.4;
  Object.assign(ripple.style,{width:radius+'px',height:radius+'px',
    left:(event.clientX-bounds.left)+'px',top:(event.clientY-bounds.top)+'px'});
  control.append(ripple);
  ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  setTimeout(()=>ripple.remove(),700);
},{passive:true});
