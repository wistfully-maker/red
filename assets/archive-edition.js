import {archiveSeries, archiveCollection} from './archive-series-data.js?v=expanded-20261127';
export const editionFor = id => archiveSeries[id];

function el(tag, className, value) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(value)node.textContent=value;
  return node;
}
function sourceLink(label,url) {
  const a=el('a','',label+' ↗');
  a.href=url;a.target='_blank';a.rel='noopener';
  return a;
}

function documentFigure(media,className='edition-inline-image'){
  const figure=el('figure',className),image=el('img');
  image.src=media.src.startsWith('assets/valley/stills/')?media.src+'?v=numbered-people-20261128':media.src;
  image.alt=media.caption;image.loading='lazy';image.decoding='async';
  const caption=el('figcaption','',media.caption);
  if(media.credit)caption.append(document.createTextNode('　'+media.credit));
  if(media.source)caption.append(document.createTextNode('　'),sourceLink('来源',media.source));
  if(media.licenseUrl)caption.append(document.createTextNode('　'),sourceLink('许可',media.licenseUrl));
  figure.append(image,caption);return figure;
}

function collectionShelf() {
  const wrap=el('details','edition-collection');
  wrap.append(el('summary','','影像资料索引'));
  const grid=el('div','edition-collections');
  for(const group of archiveCollection){
    const section=el('section');
    section.append(el('h4','',group.title),el('p','',group.dek));
    for(const item of group.entries){
      section.append(sourceLink(item.label,item.url),el('small','',item.note));
    }
    grid.append(section);
  }
  wrap.append(grid);
  return wrap;
}

function evidenceSpread(station,photo){
  const panel=el('section','edition-atlas');
  panel.append(el('h4','','对照图页'));
  const images=el('div','edition-plates');
  const exhibits=[
    [`assets/terrain/${station.id}-near.webp`,station.name+'周边 · 现代地表影像'],
    photo?[photo.src,photo.caption]:[`assets/scene-studies/${station.id}.webp`,station.name+' · 场景艺术演绎']
  ];
  for(const [src,caption] of exhibits){
    const figure=el('figure'),img=el('img');
    img.src=src;img.alt=caption;img.loading='lazy';img.decoding='async';
    figure.append(img,el('figcaption','',caption));images.append(figure);
  }
  if(photo?.credit)images.lastElementChild.querySelector('figcaption').append(document.createTextNode('　'+photo.credit));
  panel.append(images);
  const map=el('a','edition-map-link','在三维地形中查看 ↗');
  map.href=station.id==='luding'?'#station/luding/terrain':'#station/'+station.id;
  map.addEventListener('click',e=>{
    e.preventDefault();
    const toggle=document.getElementById('toggleReader');
    if(toggle.getAttribute('aria-expanded')==='true')toggle.click();
    document.getElementById('useTerrain').click();
  });
  panel.append(map);return panel;
}

export function renderEdition(root,station,diary) {
  const article=archiveSeries[station.id];
  root.replaceChildren();
  if(!article)return;
  const hero=el('header','edition-cover');
  const intro=el('div','edition-intro');
  intro.append(el('p','edition-series',diary?'研学日记 · 当代查阅':'地点档案 · 影像与地理'),
    el('h3','edition-title',(diary?article.journalTitle:article.title).replace(/^.{2,4}日记[｜|·\s]+/,'')),
    el('p','edition-dek',diary?article.journal[0]:article.dek));
  const fig=el('figure','edition-figure');
  const photo=article.image, img=el('img');
  fig.classList.toggle('document-photo', Boolean(photo));
  img.src=photo?.src||'assets/scene-studies/'+station.id+'.webp';
  img.alt=photo?.caption||station.name+'场景设计图';img.decoding='async';
  const cap=el('figcaption','',photo?.caption||station.name+' · 场景艺术演绎');
  if(photo?.credit)cap.append(document.createTextNode('　'+photo.credit));
  if(photo?.source)cap.append(document.createTextNode('　'),sourceLink('原图',photo.source));
  fig.append(img,cap);hero.append(intro,fig);
  const spread=el('div','edition-spread'),margin=el('aside','edition-margin');
  margin.append(el('span','',diary?'记录地点':'历史坐标'),el('strong','',station.name),
    el('small','',station.region),el('small','',station.date));
  if(diary){
    const author=el('img','edition-author');
    author.src='assets/valley/recorder-portrait.webp';author.alt='';
    margin.prepend(author,el('span','','行记员 · 虚构研学向导'));
  }
  const text=el('div','edition-prose');
  const additional=(article.images||[]).filter(media=>new URL(media.src,document.baseURI).href!==img.src);
  const paragraphs=diary?article.journal.slice(1):article.paragraphs;
  paragraphs.forEach((paragraph,index)=>{
    text.append(el('p','',paragraph));
    if(index===1&&additional[0])text.append(documentFigure(additional[0]));
    if(index===3&&additional[1])text.append(documentFigure(additional[1]));
  });
  const inserted=paragraphs.length>3?2:paragraphs.length>1?1:0;
  if(additional.length>inserted){
    const gallery=el('div','edition-gallery');
    additional.slice(inserted).forEach(media=>gallery.append(documentFigure(media)));
    text.append(gallery);
  }
  spread.append(margin,text);
  const sources=el('section','edition-sources');
  sources.append(el('h4','','本篇依据'));
  for(const item of article.sources)sources.append(sourceLink(item.label,item.url));
  root.append(hero,spread,evidenceSpread(station,photo),sources,collectionShelf());
}
