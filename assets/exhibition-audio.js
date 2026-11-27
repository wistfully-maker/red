/** The user's supplied recording. Nothing is fetched or played before consent. */
export const EXHIBITION_AUDIO_SESSION_KEY='exhibition-music-choice-v2';
export const exhibitionRecording=Object.freeze({
  title:'舒伯特 · 小夜曲', performer:'吕思清', album:'梦幻曲',
  source:new URL('./audio/schubert-standchen-lv-siqing.mp3',import.meta.url).href
});

let mounted;
const readChoice=()=>{try{return sessionStorage.getItem(EXHIBITION_AUDIO_SESSION_KEY);}catch{return null;}};
const saveChoice=value=>{try{sessionStorage.setItem(EXHIBITION_AUDIO_SESSION_KEY,value);}catch{}};

function loadStyle(){
  if(document.querySelector('link[data-exhibition-audio-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.dataset.exhibitionAudioStyle='';
  link.href=new URL('./exhibition-audio.css?v=20261127',import.meta.url).href;document.head.append(link);
}

class ExhibitionAudio {
  constructor(parent){
    this.parent=parent;this.choice=['on','off'].includes(readChoice())?readChoice():null;
    this.status=this.choice==='on'?'ready':this.choice==='off'?'muted':'idle';
    this.serial=0;this.destroyed=false;this.resumeAfterVisibility=false;this.targetVolume=.5;
    this.audio=document.createElement('audio');this.audio.preload='none';this.audio.loop=true;
    this.audio.hidden=true;this.audio.dataset.exhibitionAudioTrack='';this.audio.volume=1;
    document.body.append(this.audio);
    this.button=document.createElement('button');this.button.type='button';
    this.button.className='exhibition-audio-toggle';this.button.dataset.exhibitionAudioToggle='';
    this.button.title=exhibitionRecording.title+' · '+exhibitionRecording.performer+'演奏';
    this.button.innerHTML='<span class="exhibition-audio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="exhibition-audio-label">音乐</span>';
    this.button.addEventListener('click',()=>{
      if(this.status==='playing'||this.status==='starting')void this.mute();else void this.play();
    });
    this.button.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&this.choice==='on'){event.preventDefault();void this.mute();}
    });
    parent.insertBefore(this.button,parent.querySelector('#cinemaMenu')||parent.lastElementChild);
    this.live=document.createElement('span');this.live.className='exhibition-audio-live';
    this.live.setAttribute('role','status');this.live.setAttribute('aria-live','polite');document.body.append(this.live);
    this.card=document.createElement('section');this.card.className='exhibition-audio-permission';
    this.card.hidden=true;this.card.setAttribute('role','region');this.card.setAttribute('aria-label','展馆音乐选择');
    this.card.innerHTML='<h2>是否允许打开背景音乐？</h2><div class="exhibition-audio-actions"><button type="button" class="exhibition-audio-listen">允许</button><button type="button" class="exhibition-audio-decline">不允许</button></div>';
    this.card.querySelector('.exhibition-audio-listen').addEventListener('click',event=>{
      this.hideCard(event.detail===0);void this.play();
    });
    this.card.querySelector('.exhibition-audio-decline').addEventListener('click',event=>{
      this.hideCard(event.detail===0);void this.mute();
    });
    this.card.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.hideCard(true);void this.mute();}
    });
    document.body.append(this.card);
    this.onVisibility=()=>{
      if(document.hidden){
        this.resumeAfterVisibility=this.choice==='on'&&(!this.audio.paused||this.status==='starting');
        if(this.resumeAfterVisibility)void this.mute({background:true});
      }else if(this.resumeAfterVisibility&&this.choice==='on'){
        this.resumeAfterVisibility=false;void this.play({restore:true});
      }
    };
    document.addEventListener('visibilitychange',this.onVisibility);
    this.audio.addEventListener('error',()=>{
      if(this.choice==='on'){this.status='error';this.announce('音乐暂时无法播放，可继续静音参观。');this.render();}
    });
    this.audio.addEventListener('pause',()=>{
      if(this.status==='playing'&&!document.hidden){this.status=this.choice==='on'?'ready':'muted';this.render();}
    });
    // Native looping handles normal playback. Recover if a browser nevertheless
    // delivers an end event, without overriding a deliberate pause or teardown.
    this.audio.addEventListener('ended',()=>{
      if(this.destroyed||this.choice!=='on'||document.hidden)return;
      this.audio.currentTime=0;
      void this.play({restore:true});
    });
    this.promptTimer=setTimeout(()=>{if(!this.destroyed&&this.choice===null)this.card.hidden=false;},650);
    this.render();
  }

  hideCard(restoreFocus=false){
    clearTimeout(this.promptTimer);
    const focused=this.card.contains(document.activeElement);this.card.hidden=true;
    if(restoreFocus&&focused)this.button.focus({preventScroll:true});
  }

  announce(text){this.live.textContent=text;}

  ensureSource(){
    if(!this.audio.hasAttribute('src'))this.audio.src=exhibitionRecording.source;
    if(this.context||this.fallback)return;
    const AudioEngine=window.AudioContext||window.webkitAudioContext;
    if(!AudioEngine){this.fallback=true;this.audio.volume=0;return;}
    this.context=new AudioEngine();this.gain=this.context.createGain();this.gain.gain.value=0;
    this.analyser=this.context.createAnalyser();this.analyser.fftSize=512;
    this.samples=new Float32Array(this.analyser.fftSize);
    this.source=this.context.createMediaElementSource(this.audio);
    this.source.connect(this.gain);this.gain.connect(this.analyser);this.analyser.connect(this.context.destination);
  }

  cancelFade(){
    clearTimeout(this.fadeTimer);clearInterval(this.fadeInterval);
    if(this.fadeResolve){this.fadeResolve(false);this.fadeResolve=null;}
  }

  fadeTo(level,seconds){
    this.cancelFade();
    if(this.gain){
      const now=this.context.currentTime,param=this.gain.gain;
      if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);
      else{const value=param.value;param.cancelScheduledValues(now);param.setValueAtTime(value,now);}
      if(seconds)param.linearRampToValueAtTime(level,now+seconds);else param.setValueAtTime(level,now);
    }else{
      const start=this.audio.volume,at=performance.now();
      if(!seconds)this.audio.volume=level;
      else this.fadeInterval=setInterval(()=>{
        const amount=Math.min(1,(performance.now()-at)/(seconds*1000));
        this.audio.volume=start+(level-start)*amount;if(amount===1)clearInterval(this.fadeInterval);
      },25);
    }
    if(!seconds)return Promise.resolve(true);
    return new Promise(resolve=>{
      this.fadeResolve=resolve;this.fadeTimer=setTimeout(()=>{
        this.fadeResolve=null;clearInterval(this.fadeInterval);resolve(true);
      },seconds*1000+15);
    });
  }

  async play({restore=false}={}){
    if(this.destroyed||document.hidden)return false;
    const operation=++this.serial;this.choice='on';saveChoice('on');this.hideCard();
    this.status='starting';this.render();
    try{
      this.audio.loop=true;
      this.ensureSource();
      // Both calls are made in the click's activation turn, before the await.
      const engine=this.context?this.context.resume():Promise.resolve();
      const playback=this.audio.play();await Promise.all([engine,playback]);
      if(operation!==this.serial||this.choice!=='on'||document.hidden)return false;
      this.status='playing';this.render();void this.fadeTo(this.targetVolume,restore ? .75 : 1.05);
      if(!restore)this.announce('音乐已开启。可随时使用顶部音乐按钮暂停。');
      return true;
    }catch(error){
      if(operation!==this.serial||this.choice!=='on')return false;
      this.audio.pause();void this.fadeTo(0,0);
      this.status=error.name==='NotAllowedError'?'blocked':'error';
      this.announce(this.status==='blocked'?'请点按顶部音乐按钮继续聆听。':'音乐暂时无法播放，可继续静音参观。');
      this.render();return false;
    }
  }

  async mute({background=false}={}){
    if(this.destroyed)return;
    const operation=++this.serial;
    if(!background){this.choice='off';saveChoice('off');this.resumeAfterVisibility=false;this.hideCard();}
    this.status=background?'suspended':'muting';this.render();
    const changed=await this.fadeTo(0,this.audio.paused ? 0 : background ? .08 : .55);
    if(changed&&operation===this.serial){
      this.audio.pause();this.status=background?'suspended':'muted';this.render();
      if(!background)this.announce('音乐已静音。');
    }
  }

  render(){
    const playing=this.status==='playing'&&this.choice==='on';
    this.button.dataset.state=playing?'playing':this.status;
    this.button.setAttribute('aria-pressed',String(playing));
    const pending=this.choice==='on'&&['ready','blocked','suspended'].includes(this.status);
    const label=this.button.querySelector('.exhibition-audio-label');
    label.textContent=playing?'音乐':this.status==='starting'?'载入中':pending?'继续聆听':'音乐';
    this.button.setAttribute('aria-label',playing?'暂停展馆音乐':this.status==='starting'?'停止载入展馆音乐':pending?'继续播放展馆音乐':'播放展馆音乐');
  }

  getState(){
    let rms=0;
    if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);
      rms=Math.sqrt(this.samples.reduce((sum,value)=>sum+value*value,0)/this.samples.length);}
    return {choice:this.choice,status:this.status,paused:this.audio.paused,loop:this.audio.loop,time:this.audio.currentTime,
      duration:Number.isFinite(this.audio.duration)?this.audio.duration:null,
      volume:this.gain?this.gain.gain.value:this.audio.hasAttribute('src')?this.audio.volume:0,
      contextState:this.context?.state||null,hasSource:this.audio.hasAttribute('src'),rms,
      promptVisible:!this.card.hidden,hidden:document.hidden};
  }

  destroy(){
    if(this.destroyed)return;this.destroyed=true;++this.serial;this.cancelFade();clearTimeout(this.promptTimer);
    document.removeEventListener('visibilitychange',this.onVisibility);this.audio.pause();
    this.audio.removeAttribute('src');this.audio.load();this.audio.remove();
    this.context?.close();this.button.remove();this.card.remove();this.live.remove();
  }
}

/** Mount once in header .cinema-tools. Remembered consent never bypasses a click. */
export function mountExhibitionAudio(parent=document.querySelector('.cinema-tools')){
  if(!parent)return null;loadStyle();
  if(mounted&&!mounted.destroyed){
    if(mounted.button.parentElement!==parent)parent.insertBefore(mounted.button,parent.lastElementChild);
    return mounted;
  }
  mounted=new ExhibitionAudio(parent);return mounted;
}
