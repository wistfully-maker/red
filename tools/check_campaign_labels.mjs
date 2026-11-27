// Deterministic algorithm check; explicitly not a browser-frame capture.
import fs from 'node:fs';
import {StableCampaignLabelLayout,rectangleOverlap} from '../assets/campaign-label-layout.js';
import {campaignNodes} from '../assets/campaign-map-data.js';

const desktop=[[.84,.53],[.82,.55],[.64,.64],[.55,.66],[.415,.62],[.36,.61],[.20,.85],[.16,.69],[.16,.58],[.17,.52],[.165,.49],[.16,.45],[.20,.38],[.18,.35],[.22,.31],[.23,.33],[.33,.16],[.23,.25],[.26,.23]];
const mobile=[[.85,.68],[.85,.66],[.59,.66],[.5,.665],[.45,.61],[.39,.59],[.16,.62],[.15,.59],[.16,.55],[.195,.53],[.20,.50],[.20,.47],[.28,.44],[.25,.43],[.28,.40],[.31,.41],[.58,.34],[.40,.36],[.44,.36]];
const results=[];
for(const [width,height]of[[1440,900],[390,844],[320,740]]){
  const compact=width<=720,points=compact?mobile:desktop;
  const base=campaignNodes.map((n,i)=>({id:n.id,order:i,x:points[i][0]*width,y:points[i][1]*height,
    w:Math.max(36,n.name.length*(compact?11:12)+(compact?12:14)),h:compact?23:25}));
  const reserved=compact?[{x:0,y:0,w:width,h:60},{x:12,y:65,w:width-24,h:105},{x:10,y:height-202,w:width-20,h:190},{x:width-60,y:230,w:42,h:230}]:
    [{x:0,y:0,w:width,h:64},{x:35,y:75,w:390,h:130},{x:width-350,y:82,w:326,h:270},{x:width-90,y:350,w:42,h:230}];
  const state=new StableCampaignLabelLayout();let previous=null,maxOffsetDelta=0,slotChanges=0,last=[];
  for(let frame=0;frame<200;frame++){
    const items=base.map((p,i)=>({...p,x:p.x+Math.sin(frame*.65+i)*.25,y:p.y+Math.cos(frame*.65+i)*.25}));
    last=state.update(items,{width,height},reserved,frame*16.67);
    if(previous)last.forEach((p,i)=>{const old=previous[i];maxOffsetDelta=Math.max(maxOffsetDelta,Math.hypot(p.dx-old.dx,p.dy-old.dy));slotChanges+=Number(p.slot!==old.slot);});
    previous=last;
  }
  const collisions=[];last.forEach((a,i)=>last.slice(i+1).forEach(b=>{if(rectangleOverlap(a.box,b.box)>0)collisions.push([a.id,b.id]);}));
  if(maxOffsetDelta||slotChanges||state.reflows!==1||collisions.length)throw Error('Stationary anchor stability failed');
  results.push({viewport:[width,height],frames:200,labels:last.length,projectionNoisePx:.25,layoutReflows:state.reflows,
    slotChanges,maxRelativeOffsetDeltaPx:maxOffsetDelta,sideSwitches:state.sideSwitches,labelCollisions:collisions});
}
const report={scope:'Pure deterministic layout engine, synthetic geographic anchors; not a browser frame capture.',results};
fs.mkdirSync('output/campaign-map',{recursive:true});
fs.writeFileSync('output/campaign-map/layout-stability-simulation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
