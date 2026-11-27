// Clip in homogeneous camera space before perspective division. This avoids
// enormous offscreen SVG boxes and keeps edge crossings continuous while zooming.
export function clipCampaignSegment(a,b,width,height,margin=64){
  if(!a||!b)return null;
  const px=1+2*margin/width,py=1+2*margin/height;
  const planes=[p=>p.w-1e-5,p=>p.z+p.w,p=>p.w-p.z,p=>p.x+px*p.w,p=>px*p.w-p.x,p=>p.y+py*p.w,p=>py*p.w-p.y];
  let from=0,to=1;
  for(const distance of planes){
    const da=distance(a),db=distance(b);
    if(da<0&&db<0)return null;
    if(da<0)from=Math.max(from,da/(da-db));
    else if(db<0)to=Math.min(to,da/(da-db));
    if(from>to)return null;
  }
  const screen=t=>{
    const w=a.w+(b.w-a.w)*t,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
    return{x:(x/w+1)*width/2,y:(1-y/w)*height/2};
  };
  return[screen(from),screen(to)];
}
