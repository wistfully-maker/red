import {peopleNotes} from './people-notes-data.js';

export const tableaux={
  ruijin:['离山前的报纸与行囊','灯、报纸和打好的铺盖把出发前的准备放在一张桌旁。印刷品可以随队携带，印刷所和读者却散在不同地方。','https://www.rjjng.com.cn/cp-content.thtml?cid=10951&id=22262'],
  yudu:['从家门到渡口','一扇门板原本隔开家与街，此时却要和别家的船连起来。看看手推车、门板和水边的落脚处。'],
  xiangjiang:['渡口旁的一次照护','临时遮棚里，一副担架占了两个人的位置。这里用照护现场追问，渡过一条河之后，谁还需要被扶持。'],
  liping:['翘街 · 从铺面到天井','从街沿的药材与货篮望向层层升高的院落。商号的铺面、生活空间和会议所在的院子各有用途。','https://www.ctnews.com.cn/paper/content/202011/17/content_52128.html'],
  zunyi:['二楼会客室 · 围桌而议','二十把木边藤心折椅围着栗色长桌，挂钟、壁柜和灯具提示这是由私人会客室转用的会议空间。此镜头剖开临镜头的屋盖和廊墙。','https://news.12371.cn/2015/01/07/ARTI1420596304506715.shtml'],
  chishui:['土城 · 补过的门板','两只木架托起带补片的门板。船工郑明福家保存的修补门板，将一次渡河与渡河以后漫长的生活连在一起。','https://www.sdcs1935.com/html/news/trends/202106/f331746fc52e91b9.shtml'],
  jiaoping:['石岸上的摆渡班次','船靠岸以后，桨、饮水和行囊都需要安放。比较洞口、候渡处和水面间的距离，理解船工持续劳动的分量。'],
  anshun:['船工的岸边工具','看放在架上的长桨，再比较它同翘首渡船和人体的尺度。地方船工对船与水的日常知识进入了这段历史。','https://cpc.people.com.cn/n1/2025/0802/c443712-40534962.html'],
  luding:['桥亭旁的歇脚处','茶壶、背负的铺盖和桥头集镇让人看到，铁索桥首先是一条连接两岸生活的道路。'],
  jiajin:['雪脊上的马灯','风口的灯与卷起的铺盖很小，周围雪坡很大。马灯是照明物件，也提示后来的人从何处寻找普通行军者的经验。'],
  dawei:['会师桥头的一瓢水','木桥原本就是当地居民来往的通路。桥头递水是情境演绎，两支队伍在达维相遇则有文献和遗址可考。','https://www.xiaojin.gov.cn/xjxrmzf/c101898/201909/36b3a51f60b24387a44870c618befceb.shtml'],
  lianghekou:['庙院里摊开的文件','看台阶、桌凳与纸张组成的临时议事空间。会合之后向哪里去，仍需经过讨论和决定。'],
  songpan:['草墩上的短暂停留','沿干处走到靠拢的铺盖与口粮袋旁。集体互助在这里有很具体的尺度，一人停下来，另一人就得等待。'],
  baxi:['寺院门前送来的文书','布包、马灯和纸页指向消息传递的劳动。此处以九月二日班佑寺会议为背景，需与其他日期的巴西会议区分。'],
  lazikou:['峡口过后的休整','从遮棚回望小桥，辨认可以安置水壶、担架和行囊的平地。照护点位置属于艺术推演。'],
  hadapu:['柜台旁读到的消息','读报者与听者共用一张小桌。这里重现阅读和传递信息的过程，报纸上的具体版面与对白保持开放。'],
  wuqi:['窑院 · 箍过的水缸','乡亲借出的器物在叙述中被称为“红军锅”。看陶缸的敞口、圆腹和修补的竹箍，器物后来又回到家庭生活。','https://news.youth.cn/hotnews_41880/202610/t20261029_16938342.htm'],
  huining:['西津门前备一席饭','碗、长凳与摆桌的人让会师成为可以坐在一起的一刻。馆藏会师桌提供线索，模型中席面的摆法为演绎。'],
  jiangtai:['堡前放下的盐盒','药品、盐与行囊的分量在远行中不同。打开有盖盐盒的观察镜头，从随身器物走近会合的普通人。']
};

export function showStudy(id,source){
  let panel=document.getElementById('studyPlateDialog');
  if(!panel){
    panel=document.createElement('dialog');panel.id='studyPlateDialog';panel.setAttribute('aria-labelledby','plateTitle');
    panel.innerHTML=`<div class="study-sheet-head"><span>山河之路　／　现场手记</span><button type="button" aria-label="关闭现场手记">合上 ×</button></div>
      <div class="folio-spread"><figure><img alt=""><figcaption>原创场景设计图 · 空间、光照与人物位置含艺术推演</figcaption></figure>
      <article><h2 id="plateTitle"></h2><p class="folio-look"></p><h3></h3><p class="folio-evidence"></p>
      <details><summary>查阅依据</summary><p class="folio-boundary"></p><div class="folio-sources"></div></details>
      <a class="folio-lesson">进入本站研学 →</a></article></div>`;
    panel.querySelector('button').onclick=()=>panel.close();
    panel.querySelector('.folio-lesson').onclick=()=>panel.close();
    window.addEventListener('hashchange',()=>{if(panel.open)panel.close();});
    document.body.append(panel);
  }
  const [title,note,url]=tableaux[id];
  const record=peopleNotes[id];
  panel.querySelector('h2').textContent=title;panel.querySelector('.folio-look').textContent=note;
  panel.querySelector('h3').textContent=record.title;
  panel.querySelector('.folio-evidence').textContent=record.note;
  panel.querySelector('.folio-boundary').textContent=record.boundary;
  const sources=new Map(record.sources.map(([label,href])=>[href,label]));
  if(!sources.has(url||source))sources.set(url||source,'现场复原资料');
  panel.querySelector('.folio-sources').replaceChildren(...[...sources].filter(([href])=>href).map(([href,label])=>{
    const a=document.createElement('a');a.href=href;a.textContent=label+' ↗';a.target='_blank';a.rel='noopener';return a;
  }));
  panel.querySelector('details').open=false;
  panel.querySelector('.folio-lesson').href='#station/'+id+'/study';
  const img=panel.querySelector('img');img.src='assets/scene-studies/'+id+'.webp';img.alt=title+'的建模构图参考';
  panel.showModal();panel.scrollTop=0;
}

