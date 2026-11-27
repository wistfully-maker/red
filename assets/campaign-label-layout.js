// Stateful screen-space layout. Geographic anchors may move each frame;
// label offsets and their side choices do not participate in that animation.
export const rectangleOverlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const inflate=r=>({x:r.x-3,y:r.y-2,w:r.w+6,h:r.h+4});

export class StableCampaignLabelLayout {
  constructor(){this.clear();}
  clear(){this.cache=new Map();this.anchors=new Map();this.previous=new Map();this.uiKey='';this.topologyKey='';this.lastMotion=-Infinity;this.lastReflow=-Infinity;this.reflows=0;this.sideSwitches=0;this.dirty=false;}
  invalidate(){this.uiKey='';}
  update(items,viewport,reserved,now,{moving=false}={}){
    // Input order is a stable chapter/id order, never a projected-x/y sort.
    const ordered=[...items].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
    const key=[viewport.width,viewport.height,
      reserved.map(r=>[r.x,r.y,r.w,r.h].map(n=>Math.round(n/4)).join(':')).join(',')].join('|');
    const topology=ordered.map(i=>`${i.id}:${i.w}:${i.h}`).join(',');
    let moved=0,displaced=0;
    for(const i of ordered){
      const previous=this.previous.get(i.id),anchor=this.anchors.get(i.id);
      if(previous)moved=Math.max(moved,Math.hypot(i.x-previous.x,i.y-previous.y));
      if(anchor)displaced=Math.max(displaced,Math.hypot(i.x-anchor.x,i.y-anchor.y));
      this.previous.set(i.id,{x:i.x,y:i.y});
    }
    if(moved>.12||moving)this.lastMotion=now;
    if(displaced>12||topology!==this.topologyKey)this.dirty=true;
    const changedUI=key!==this.uiKey;
    const settled=!moving&&this.dirty&&now-this.lastMotion>=220&&now-this.lastReflow>=260;
    if(changedUI||settled||!this.cache.size){
      this.reflow(ordered,viewport,reserved);this.uiKey=key;this.lastReflow=now;this.dirty=false;
      this.anchors=new Map(ordered.map(i=>[i.id,{x:i.x,y:i.y}]));
    }
    // Entering/leaving viewport nodes do not cause a global reflow mid-gesture.
    for(const i of ordered)if(!this.cache.has(i.id))this.cache.set(i.id,{dx:i.x>viewport.width*.68?-13-i.w:13,dy:0,slot:i.x>viewport.width*.68?1:0});
    this.topologyKey=topology;
    return ordered.map(i=>{const p=this.cache.get(i.id);return {...i,...p,box:{x:i.x+p.dx,y:i.y+p.dy,w:i.w,h:i.h}};});
  }
  reflow(items,{width,height},reserved){
    const occupied=[];
    for(const i of items){
      const old=this.cache.get(i.id);
      const make=(dx,dy,slot)=>{
        const box={x:clamp(i.x+dx,8,Math.max(8,width-8-i.w)),y:clamp(i.y+dy,74,Math.max(74,height-12-i.h)),w:i.w,h:i.h};
        const collisions=occupied.reduce((s,r)=>s+rectangleOverlap(inflate(box),r),0)+reserved.reduce((s,r)=>s+rectangleOverlap(box,r),0);
        return{dx:Math.round(box.x-i.x),dy:Math.round(box.y-i.y),slot,box,collisions,
          score:collisions*200+Math.hypot(box.x+i.w/2-i.x,box.y+i.h/2-i.y)*.1+(old&&slot!==old.slot?80:0)};
      };
      let best=old?make(old.dx,old.dy,old.slot):null;
      // A readable old candidate is locked even if a marginally shorter one appears.
      if(!best||best.collisions>0){
        let slot=0;
        for(const r of [13,32,55,82,112,150,195,245])for(const [dx,dy]of[[r,0],[-r-i.w,0],[r,-i.h],[-r-i.w,-i.h],[-i.w/2,-r-i.h],[-i.w/2,r]]){
          const candidate=make(dx,dy,slot++);
          if(!best||candidate.score<best.score-1)best=candidate;
        }
      }
      if(old&&Math.sign(old.dx+i.w/2)!==Math.sign(best.dx+i.w/2))this.sideSwitches++;
      this.cache.set(i.id,{dx:best.dx,dy:best.dy,slot:best.slot});occupied.push(inflate(best.box));
    }
    this.reflows++;
  }
}
