// Dedicated map-scale dioramas, guided by the historical reference sheets.
// Units are schematic. Models are Y-up, centered at ground level, not survey reconstructions.
import * as THREE from '../assets/vendor/three.module.min.js';
import { mergeGeometries, mergeVertices } from '../assets/vendor/BufferGeometryUtils.js';

const paint = {
  earth: '#a4957c', edge: '#81745e', sand: '#d7c6a3', path: '#e3d4b7', stone: '#d1cbbb',
  brick: '#b3b3a7', plaster: '#e7dfcc', tile: '#727970', ridge: '#a0a79a',
  wood: '#947956', beam: '#c3a170', dark: '#44473b', water: '#608785', foam: '#c1d3c3',
  grass: '#b0b184', leaf: '#849065', pine: '#617457', red: '#ca4b35', snow: '#f3efe3', rock: '#a4a596'
};
const material = new THREE.MeshStandardMaterial({name:'Mineral, timber and river pigments', vertexColors:true,
  roughness:.89, emissive:'#a99b80', emissiveIntensity:.09});

function sculpt(name) {
  const parts = [];
  let serial = 0;
  function add(geometry, tint, x=0, y=0, z=0, yaw=0) {
    geometry.rotateY(yaw).translate(x,y,z);
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    const color = new THREE.Color(paint[tint] || tint);
    // Stable slight material variation preserves the hand-built reference quality.
    color.multiplyScalar(.96 + ((serial++ * 17) % 11) * .008);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for(let i=0;i<colors.length;i+=3) {colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    parts.push(g);
  }
  const box=(t,x,y,z,w,h,d,yaw=0)=>add(new THREE.BoxGeometry(w,h,d),t,x,y,z,yaw);
  const rock=(t,x,y,z,r,sx=1,sy=1,sz=1)=>add(new THREE.IcosahedronGeometry(r,0).scale(sx,sy,sz),t,x,y,z,x*11+z*7);
  function line(t,points,r=.01){add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(5,points.length*2),r,4,false),t);}
  function roof(x,y,z,w,d,h){
    // Curved roof silhouettes: raised eaves, a long ridge, hip ends.
    // Use a conventional hip roof for non-self-overlapping surfaces.
    const g=new THREE.BufferGeometry(),a=[-w/2,.025,-d/2],b=[w/2,.025,-d/2],c=[w/2,.025,d/2],e=[-w/2,.025,d/2],p=[-w*.31,h,0],q=[w*.31,h,0];
    g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...p,...b,...b,...p,...q,...b,...q,...c,...c,...q,...e,...e,...q,...p,...e,...p,...a],3));g.computeVertexNormals();
    add(g,'tile',x,y,z);
    box('ridge',x,y+h+.008,z,w*.65,.014,.025);
    for(const side of [-1,1]) {
      box('ridge',x,y+.018,z+side*d/2,w,.014,.018);
      // Broad tile seams remain legible at the 70px map scale.
      for(let i=0;i<10;i++) {
        const px=x+(i/9-.5)*w*.86;
        line('ridge',[[px,y+.027,z+side*d*.48],[px,y+h*.52,z+side*d*.22],[px,y+h+.005,z]],.0035);
      }
    }
  }
  function base(type='land'){
    const outline=[[-.59,-.37],[-.35,-.47],[.24,-.45],[.57,-.30],[.63,.15],[.40,.42],[-.26,.46],[-.61,.23]];
    const shape=new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,-z)));
    const slab=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:false}).rotateX(-Math.PI/2);
    add(slab,'edge',0,-.063,0);
    const top=new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2);
    add(top,type==='river'?'water':type==='snow'?'snow':'sand',0,.004,0);
    if(type==='land')for(let i=0;i<10;i++)rock(i%3?'grass':'earth',Math.cos(i*2.4)*.44,.027,Math.sin(i*2.4)*.30,.10,1,.25,.72);
  }
  function tree(x,z,size=.17,pine=false,y=0){
    box('wood',x,y+size*.43,z,.018,size*.86,.018);
    if(pine){
      for(let i=0;i<3;i++)add(new THREE.ConeGeometry(size*(.39-i*.07),size*.64,7),'pine',x,y+size*(.55+i*.23),z);
    }else{
      rock('leaf',x,y+size*.9,z,size*.44,1,.72,.84);
      rock('grass',x-size*.21,y+size*.98,z+.015,size*.30,1,.70,.80);
    }
  }
  function person(x,y,z,scale=1,flag=false){
    const s=scale;
    box('dark',x-.009*s,y+.022*s,z,.012*s,.042*s,.013*s);
    box('dark',x+.009*s,y+.022*s,z,.012*s,.042*s,.013*s);
    box('wood',x,y+.063*s,z,.039*s,.044*s,.023*s);
    rock('sand',x,y+.101*s,z,.015*s);
    box('tile',x,y+.113*s,z,.034*s,.008*s,.031*s);
    if(flag){box('wood',x+.033*s,y+.12*s,z,.006*s,.24*s,.006*s);box('red',x+.076*s,y+.19*s,z,.088*s,.055*s,.004*s);}
  }
  function boat(x,y,z,length=.32,width=.09,yaw=0){
    const points=[[-length*.50,0],[-length*.35,width*.5],[length*.36,width*.5],[length*.50,0],[length*.36,-width*.5],[-length*.35,-width*.5]];
    const shape=new THREE.Shape(points.map(([u,v])=>new THREE.Vector2(u,v)));
    const hull=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelSize:.007,bevelThickness:.008,bevelSegments:1,steps:1}).rotateX(-Math.PI/2);
    add(hull,'wood',x,y,z,yaw);
    box('dark',x,y+.039,z,length*.66,.008,width*.62,yaw);
    for(const n of [-1,0,1]){const u=n*length*.22;box('beam',x+Math.cos(yaw)*u,y+.048,z-Math.sin(yaw)*u,.022,.009,width*.75,yaw);}
  }
  function building(x,y,z,w=.40,d=.25,h=.24){
    box('plaster',x,y+h/2,z,w,h,d);
    roof(x,y+h,z,w*1.17,d*1.20,h*.45);
    for(const q of [-1,0,1]){
      box('dark',x+q*w*.28,y+h*.50,z+d/2+.002,w*.16,h*.60,.007);
      box('wood',x+q*w*.28,y+h*.50,z+d/2+.009,.008,h*.60,.009);
    }
    box('beam',x,y+.016,z+d/2+.023,w*1.07,.026,.045);
  }
  function finish(){
    const group=new THREE.Group();group.name=name;
    const merged=mergeGeometries(parts);
    const geometry=mergeVertices(merged,1e-5);merged.dispose();geometry.computeBoundingSphere();
    // Vertex pigments need only eight bits, saving download and GPU bandwidth.
    const source=geometry.attributes.color;
    const bytes=new Uint8Array(source.count*3);
    for(let i=0;i<bytes.length;i++)bytes[i]=Math.round(source.array[i]*255);
    geometry.setAttribute('color',new THREE.BufferAttribute(bytes,3,true));
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name+'_miniature';group.add(mesh);
    parts.forEach(g=>g.dispose());return group;
  }
  return {add,box,rock,line,roof,base,tree,person,boat,building,finish};
}

function yudu(){
  const s=sculpt('yudu');s.base('river');
  for(const side of [-1,1]){
    s.rock('sand',side*.50,.025,0,.23,.65,.24,1.7);
    s.tree(side*.49,.25,.14);
    for(let i=0;i<3;i++)s.box('stone',side*(.46+i*.023),.026+i*.013,-.005,.10,.026,.17);
  }
  for(let i=-3;i<=3;i++)s.boat(i*.124,.016,0,.25,.068,Math.PI/2);
  for(let i=-17;i<=17;i++)s.box(i%4?'beam':'wood',i*.024,.091,0,.022,.018,.13);
  // The bridge has no modern railing: boats, timber and shared labour define its silhouette.
  s.person(-.29,.101,0,.9);s.person(.19,.101,0,.9,true);s.person(.43,.066,.05,.8);
  for(let i=0;i<5;i++)s.line('foam',[[.19-i*.12,.012,-.29],[.24-i*.12,.013,-.20]],.003);
  return s.finish();
}
function xiangjiang(){
  const s=sculpt('xiangjiang');s.base('river');
  for(const side of [-1,1]){
    s.rock('sand',side*.47,.025,0,.23,.65,.34,1.6);
    for(let i=0;i<6;i++)s.rock('stone',side*.41+i*.009,.055,Math.sin(i*2.4)*.26,.045,1,.6,.8);
    s.tree(side*.48,-.20,.19);
  }
  s.boat(.04,.017,.07,.63,.16,-.18);
  // Canopy ferry and pebble banks, distinct from the nearby pontoon crossing.
  for(const x of [-.12,.15])for(const z of [.01,.13])s.box('wood',x,.13,z,.008,.15,.008);
  s.box('sand',.015,.212,.067,.36,.021,.19,-.18);
  s.person(-.20,.067,.07,.75);s.person(.22,.067,.07,.75,true);
  s.person(-.48,.075,.13,.9);return s.finish();
}
function zunyi(){
  const s=sculpt('zunyi');s.base();
  s.box('stone',0,.035,0,.89,.065,.63);
  s.box('brick',0,.247,-.10,.76,.36,.34);
  // The two-storey grey-brick former residence has a colonnaded front gallery.
  s.roof(0,.441,-.055,.94,.59,.14);
  s.box('stone',0,.257,.13,.82,.027,.16);
  for(let level=0;level<2;level++)for(let i=0;i<6;i++){
    const x=-.344+i*.137,y=.091+level*.183;
    s.box('dark',x+.046,y+.062,.076,.081,.13,.01);
    s.box('plaster',x,y+.073,.213,.026,.151,.029);
    s.line('plaster',Array.from({length:9},(_,j)=>[x+.066+.059*Math.cos(Math.PI*j/8),y+.106+.057*Math.sin(Math.PI*j/8),.213]),.012);
  }
  for(let i=0;i<24;i++)s.box('wood',-.37+i*.032,.292,.219,.008,.06,.012);
  s.box('beam',0,.325,.219,.78,.011,.017);
  for(let i=0;i<4;i++)s.box('stone',0,.021+i*.016,.36-i*.025,.31,.023,.07);
  s.tree(-.50,-.20,.21);s.tree(.50,.12,.18);s.person(.30,.07,.34,.8);
  s.box('red',0,.208,.223,.115,.028,.007);return s.finish();
}
function jiaoping(){
  const s=sculpt('jiaoping');s.base('river');
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const x=side*(.39+i*.043),z=(i-1.5)*.17;
    s.rock(i%2?'rock':'earth',x,.11+i*.017,z,.22,.66,1.30,.72);
  }
  s.rock('sand',.22,.021,.24,.23,1.10,.19,.72);
  s.boat(-.04,.016,.02,.46,.12,-.70);s.boat(.20,.016,.25,.30,.09,-.12);
  s.person(.02,.064,-.014,.75,true);s.person(.25,.06,.31,.8);
  for(let i=0;i<6;i++)s.line('foam',[[.05,.013,-.36+i*.13],[.10,.013,-.30+i*.13]],.003);
  return s.finish();
}
function luding(){
  const s=sculpt('luding');s.base('river');
  for(const side of [-1,1]){
    const x=side*.42;
    s.rock('rock',x,.045,0,.25,.70,.68,1.45);
    s.box('stone',x,.155,0,.23,.26,.27);
    s.box('plaster',x,.328,0,.20,.095,.22);
    for(const dx of [-.074,.074])for(const z of [-.082,.082])s.box('wood',x+dx,.395,z,.022,.11,.023);
    s.roof(x,.445,0,.30,.30,.105);s.box('red',x,.38,.119,.09,.023,.005);
  }
  const sag=x=>.305-.068*(1-(x/.42)**2);
  for(let i=0;i<9;i++)s.line('dark',Array.from({length:15},(_,k)=>{const x=(k/14-.5)*.84;return[x,sag(x),-.057+i*.014]}),.0045);
  for(const z of [-.077,.077])for(const h of [.04,.10])s.line('dark',Array.from({length:15},(_,k)=>{const x=(k/14-.5)*.84;return[x,sag(x)+h,z]}),.005);
  for(let i=-5;i<=5;i++){
    const x=i*.055;
    if(i<-2||i>3)s.box('beam',x,sag(x)+.009,0,.050,.015,.14);
    for(const z of [-.077,.077])s.line('dark',[[x,sag(x)+.015,z],[x,sag(x)+.10,z]],.0035);
  }
  s.person(-.16,sag(-.16)+.02,0,.67,true);s.person(.02,sag(.02)+.02,0,.67);
  for(let i=0;i<9;i++)s.line('foam',[[Math.sin(i*5)*.18,.014,-.4+i*.10],[Math.sin(i*5)*.18+.04,.015,-.35+i*.10]],.004);
  s.tree(-.50,.24,.17);return s.finish();
}
function jiajin(){
  const s=sculpt('jiajin');s.base('snow');
  // Angular snow ridge: layered rock mass, broken snowcaps, winding pass.
  for(const [x,z,r,h] of [[-.20,-.12,.36,1.8],[.20,-.11,.29,1.6],[-.02,.18,.30,1.1],[.37,.19,.20,1.3]]){
    s.rock('rock',x,.17,z,r,1,h,.72);
    s.rock('snow',x-.018,.28+r*h*.43,z-.016,r*.75,1,h*.58,.74);
  }
  s.line('path',[[-.52,.08,.29],[-.28,.19,.20],[-.06,.32,.15],[.03,.41,-.02],[-.09,.51,-.12]],.019);
  s.person(-.29,.20,.20,.61);s.person(-.13,.28,.17,.61,true);s.person(.02,.42,-.02,.61);
  s.tree(-.47,-.24,.14,true);return s.finish();
}
function songpan(){
  const s=sculpt('songpan');s.base('river');
  for(let i=0;i<35;i++){
    const a=i*2.39996,r=.12+.39*((i*7%35)/34),x=Math.cos(a)*r,z=Math.sin(a)*r*.72;
    if(Math.abs(x-Math.sin(z*13)*.10)<.062)continue;
    s.rock(i%4?'grass':'earth',x,.018,z,.10,1,.22,.77);
    for(let k=0;k<2;k++)s.line('sand',[[x+k*.012,.030,z],[x+k*.012+.009,.070,z-.01]],.003);
  }
  for(let i=0;i<6;i++)s.person(-.39+i*.13,.042,.10+Math.sin(i*1.6)*.035,.62,i===3);
  return s.finish();
}
function wuqi(){
  const s=sculpt('wuqi');s.base();
  s.rock('earth',0,.13,-.13,.55,1,.59,.65);
  s.box('sand',0,.17,-.065,.91,.30,.27);
  for(let i=-1;i<=1;i++){
    const shape=new THREE.Shape();shape.moveTo(-.085,0);shape.lineTo(.085,0);shape.lineTo(.085,.125);shape.absarc(0,.125,.085,0,Math.PI,false);shape.closePath();
    s.add(new THREE.ShapeGeometry(shape),'dark',i*.267,.025,.074);
    s.line('stone',Array.from({length:13},(_,j)=>[i*.267+.095*Math.cos(Math.PI*j/12),.15+.095*Math.sin(Math.PI*j/12),.082]),.014);
    s.box('wood',i*.267,.115,.087,.008,.16,.008);
    for(let q=-2;q<=2;q++)s.box('wood',i*.267+q*.026,.13,.087,.006,.13,.007);
  }
  s.building(-.36,.012,.26,.24,.15,.12);s.person(.04,.016,.22,.85,true);
  s.tree(-.43,-.22,.22);s.tree(.41,-.24,.17);return s.finish();
}
function huining(){
  const s=sculpt('huining');s.base();
  // Surviving Xijin Gate: arched passage, crenellated wall, double-eave upper pavilion.
  for(const side of [-1,1])s.box('brick',side*.29,.18,0,.35,.36,.24);
  s.box('brick',0,.326,0,.26,.068,.24);
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI,b=(i+1)/10*Math.PI,ra=.126,rb=.184;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([
      Math.cos(a)*ra,.15+Math.sin(a)*ra,.127,Math.cos(a)*rb,.15+Math.sin(a)*rb,.127,Math.cos(b)*ra,.15+Math.sin(b)*ra,.127,
      Math.cos(b)*ra,.15+Math.sin(b)*ra,.127,Math.cos(a)*rb,.15+Math.sin(a)*rb,.127,Math.cos(b)*rb,.15+Math.sin(b)*rb,.127],3));g.computeVertexNormals();s.add(g,'stone');
  }
  s.box('dark',0,.12,-.10,.23,.25,.008);
  for(let i=0;i<14;i++)s.box('stone',-.48+i*.074,.382,.098,.043,.063,.050);
  s.box('wood',0,.483,0,.52,.20,.26);s.roof(0,.57,0,.70,.40,.10);
  s.box('wood',0,.67,0,.44,.10,.20);s.roof(0,.72,0,.61,.34,.11);
  for(let i=-2;i<=2;i++)s.box('red',i*.102,.49,.14,.018,.15,.016);
  for(let i=0;i<4;i++)s.person(-.19+i*.12,.012,.29,.72,i===2);
  s.tree(-.49,-.22,.18);return s.finish();
}

export function makeMapMiniatures(){
  const group=new THREE.Group();group.name='Historical miniature landmarks — overview only';
  group.add(yudu(),xiangjiang(),zunyi(),jiaoping(),luding(),jiajin(),songpan(),wuqi(),huining());
  return group;
}
