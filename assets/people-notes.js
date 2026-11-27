import { peopleNotes, peopleThemes } from './people-notes-data.js?v=people-v2-20261127';

function element(tag, className, text) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined&&text!==null)node.textContent=String(text);
  return node;
}
function externalUrl(value) {
  try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}
  catch {return null;}
}
function imageUrl(value) {
  if(typeof value!=='string'||!/^assets\/[a-z0-9_()./\-]+\.(?:jpe?g|png|webp)$/i.test(value)||value.split('/').includes('..'))return null;
  return new URL(value,document.baseURI).href;
}
function sourceLink(label,value) {
  const href=externalUrl(value)||imageUrl(value),node=element(href?'a':'span','people-source-link',label);
  if(href){node.href=href;node.target='_blank';node.rel='noopener noreferrer';}
  return node;
}
function disclosure(label,...children) {
  const details=element('details','people-disclosure');details.append(element('summary','',label),...children);return details;
}
function tabGroup(items,label,idPrefix,onSelect) {
  const list=element('div','people-tabs');list.setAttribute('role','tablist');list.setAttribute('aria-label',label);
  const buttons=items.map((item,index)=>{
    const button=element('button','people-choice');button.type='button';button.id=idPrefix+'-'+index;
    button.setAttribute('role','tab');button.setAttribute('aria-controls',idPrefix+'-panel');
    button.append(element('span','people-choice-number',String(index+1).padStart(2,'0')),element('strong','',item.name||item.label));
    if(item.kind)button.append(element('small','',item.kind));return button;
  });
  const panel=element('div','people-tab-panel');panel.id=idPrefix+'-panel';panel.setAttribute('role','tabpanel');
  const select=(index,focus=false)=>{
    buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
    panel.setAttribute('aria-labelledby',buttons[index].id);onSelect(items[index],panel,index);
    if(focus)buttons[index].focus();
  };
  buttons.forEach((button,index)=>{
    button.addEventListener('click',()=>select(index));
    button.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%buttons.length;
      else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+buttons.length-1)%buttons.length;
      else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;
      if(next!==undefined){event.preventDefault();select(next,true);}
    });
  });
  list.append(...buttons);select(0);return {list,panel};
}
export function createPeopleNotes(overview,stations) {
  if(!document.querySelector('link[data-people-notes]')){
    const stylesheet=element('link');stylesheet.rel='stylesheet';stylesheet.dataset.peopleNotes='';
    stylesheet.href=new URL('./people-notes.css?v=people-v2-20261127',import.meta.url).href;document.head.append(stylesheet);
  }
  const root=element('section','people-notes');root.hidden=true;root.setAttribute('aria-labelledby','peopleNoteTitle');overview.before(root);
  const knownIds=new Set(stations.map(s=>s.id));
  return {root,render(station) {
    const note=peopleNotes[station.id];if(!note){root.replaceChildren();return;}
    root.dataset.station=station.id;
    const opening=element('header','people-card');
    opening.append(element('p','people-byline',`${station.number||''} / 19　${peopleThemes[note.theme]}`));
    const heading=element('h3','',note.title);heading.id='peopleNoteTitle';
    opening.append(heading,element('p','people-subject',note.subject),element('p','people-note',note.note));
    const figure=element('figure','people-figure'),photo=imageUrl(note.image?.src);
    if(photo){const img=element('img');img.src=photo;img.alt=note.image.caption;img.loading='lazy';img.decoding='async';
      img.addEventListener('error',()=>{img.hidden=true;figure.classList.add('image-unavailable');});figure.append(img);}
    const badge=/参照|区域|对照|比读/.test((note.image?.caption||'')+' '+note.imageContext)?'区域资料参照':'当代实景资料',caption=element('figcaption');
    caption.append(element('span','people-image-kind',badge),element('p','',note.imageContext));figure.append(caption);
    const imageRights=disclosure('查看图像的日期与出处',element('p','',note.image?.caption),element('p','people-credit',note.image?.credit));
    if(note.image?.source)imageRights.append(sourceLink('原始文件页 ↗',note.image.source));
    if(note.image?.licenseUrl)imageRights.append(sourceLink('图像许可 ↗',note.image.licenseUrl));
    const roles=element('section','people-role-section');roles.append(element('h4','people-section-title','这一站，谁在行动'));
    const roleGroup=tabGroup(note.people,'切换本站人物角色','peopleRole',(person,panel)=>{
      panel.replaceChildren(element('p','people-person-kind',person.kind),element('h4','',person.task),element('p','',person.detail),element('p','people-person-limit','材料边界 · '+person.limit));
    });roles.append(roleGroup.list,roleGroup.panel);
    const relation=element('div','people-relation');relation.append(element('span','','行动关系'),element('p','',note.relation));roles.append(relation);
    const reading=element('section','people-reading');reading.append(element('h4','people-section-title','换一种读法'));
    const lensGroup=tabGroup(note.lenses,'切换观察角度','peopleLens',(lens,panel)=>{panel.replaceChildren(element('h4','',lens.title),element('p','',lens.text));});
    reading.append(lensGroup.list,lensGroup.panel);
    const evidence=element('section','people-evidence');evidence.append(element('h4','people-section-title','材料放在旁边读'));
    for(const record of note.evidence)evidence.append(disclosure(record.title,element('p','people-evidence-kind',record.kind),element('p','',record.text),sourceLink(record.label+' ↗',record.url)));
    const sources=element('ul','people-sources');
    for(const [label,url] of note.sources){const li=element('li');li.append(sourceLink(label+' ↗',url));sources.append(li);}
    evidence.append(disclosure('全部文字出处与复原边界',element('p','people-boundary',note.boundary),sources));
    const guide=element('aside','people-observation');guide.setAttribute('aria-label','行记员的当代观察');
    const portrait=element('img');portrait.src=imageUrl('assets/valley/recorder-portrait.webp');portrait.alt='当代虚构行记员的插画形象';portrait.loading='lazy';
    const guideText=element('div');guideText.append(element('p','people-byline','行记员的当代观察'),element('p','',note.observation),element('small','','当代虚构研学引导者，不是历史事件的亲历者。'));guide.append(portrait,guideText);
    const filter=element('select');filter.id='peopleTheme';filter.replaceChildren(...Object.entries(peopleThemes).map(([id,name])=>new Option(name,id)));filter.value=note.theme;
    const label=element('label','people-theme-filter','沿同一条人文线索继续读');label.htmlFor=filter.id;label.append(filter);
    const links=element('ul','people-theme-links'),themes=disclosure('串读六条人文线索',label,links);
    const renderTheme=()=>{
      const linked=stations.filter(s=>peopleNotes[s.id]?.theme===filter.value);
      links.replaceChildren(...linked.map(candidate=>{
        const current=station.id===candidate.id,li=element('li'),entry=element(current?'span':'a','people-theme-entry');
        if(current)entry.setAttribute('aria-current','location');else if(knownIds.has(candidate.id))entry.href='#station/'+encodeURIComponent(candidate.id)+'/people';
        entry.append(element('strong','',candidate.name),element('small','',peopleNotes[candidate.id].subject));li.append(entry);return li;
      }));
    };filter.addEventListener('change',renderTheme);renderTheme();
    overview.textContent=station.people;const additional=disclosure('本站人物速览',overview);
    root.replaceChildren(opening,figure,imageRights,roles,reading,evidence,guide,themes,additional);
  }};
}
