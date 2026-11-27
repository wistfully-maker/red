const panel=document.createElement('div');
panel.id='brandStage';panel.hidden=true;panel.setAttribute('role','status');
panel.setAttribute('aria-live','polite');
panel.innerHTML='<div class="brand-stage-core"><div class="brand-stage-orbit" aria-hidden="true"></div><svg class="brand-stage-mark" aria-hidden="true"><use href="#i-brand"/></svg><strong>山河之路</strong><span>长征纪念图集</span><p></p></div>';
document.body.append(panel);
let serial=0,opened=0,timer;
export const brandStage={
  begin(label='正在展开山河'){
    clearTimeout(timer);const token=++serial;opened=performance.now();
    panel.querySelector('p').textContent=label;panel.hidden=false;
    panel.classList.remove('is-leaving');document.body.classList.add('brand-stage-loading');
    return token;
  },
  painted(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},
  async finish(token){
    if(token!==serial)return;
    const remaining=Math.max(0,420-(performance.now()-opened));
    if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
    if(token!==serial)return;
    panel.classList.add('is-leaving');
    timer=setTimeout(()=>{if(token===serial){panel.hidden=true;document.body.classList.remove('brand-stage-loading');}},matchMedia('(prefers-reduced-motion:reduce)').matches?0:360);
  },
  cancel(){clearTimeout(timer);serial++;panel.hidden=true;document.body.classList.remove('brand-stage-loading');}
};
