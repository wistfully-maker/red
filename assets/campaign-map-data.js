// Directional campaign graphics are regional interpretation, never surveyed tracks.
// Coordinates: [latitude, longitude], intentionally rounded for pressure graphics.
export const campaignSources={
  xiang:{title:'国防部｜1934年：红军主力开始长征',url:'https://www.mod.gov.cn/gfbw/gfjy_index/js_214151/4852696.html'},
  chishui:{title:'国防部｜“土城会议”——拉开四渡赤水的序幕',url:'https://www.mod.gov.cn/gfbw/gfjy_index/js_214151/16440082.html'},
  manoeuvre:{title:'共产党员网｜“图步”长征路',url:'https://www.12371.cn/2021/10/21/ARTI1634810104798403.shtml'},
  dadu:{title:'人民周刊｜十八勇士战狂涛 大渡河上逞英豪',url:'https://paper.people.com.cn/rmzk/html/2022-11/03/content_25947029.htm'},
  grass:{title:'人民网党史｜第十七章 过草地',url:'https://dangshi.people.com.cn/n1/2016/0826/c406330-28669055.html'},
  lazi:{title:'国防部｜攻克腊子口天险 打通红军北上通道',url:'https://www.mod.gov.cn/gfbw/gfjy_index/zyhd/4848357.html'},
  wuqi:{title:'人民网党史｜探寻到达吴起后的故事',url:'https://dangshi.people.com.cn/n1/2018/0824/c85037-30249535.html'},
  meeting:{title:'国防部｜红军长征中的会师',url:'https://www.mod.gov.cn/gfbw/gfjy_index/jt_214147/16418520.html'},
  jingning:{title:'静宁县志办｜红军长征过静宁',url:'https://www.gsjn.gov.cn/zjjn/jnfz/art/2022/art_f50ab4aff934446c8967070a69859278.html'}
};

export const campaignNodes=[
 ['ruijin','瑞金·云石山'],['yudu','于都'],['xiangjiang','湘江'],['liping','黎平'],['zunyi','遵义'],
 ['chishui','赤水河'],['jiaoping','皎平渡'],['anshun','安顺场'],['luding','泸定桥'],['jiajin','夹金山'],
 ['dawei','达维'],['lianghekou','两河口'],['songpan','松潘草地'],['baxi','巴西'],['lazikou','腊子口'],
 ['hadapu','哈达铺'],['wuqi','吴起镇'],['huining','会宁'],['jiangtai','将台堡']
].map(([id,name],index)=>({id,name,number:String(index+1).padStart(2,'0')}));

const pressure=(label,coords,sources)=>({label,coords,sources,kind:'pursuit'});
const block=(label,coords,sources)=>({label,coords,sources,kind:'blockade'});
const march=(label,coords,sources)=>({label,coords,sources,kind:'march'});

export const campaignStages=[
 {id:'all',short:'全程',title:'长征全线 · 阶段行动图',date:'1934—1936',
  summary:'沿红线回看中央红军主线，再分阶段观察追击与封堵。会宁、将台堡另属1936年会师；松潘为区域参照节点。',
  nodes:campaignNodes.map(n=>n.id),sources:['xiang','chishui','dadu','grass','wuqi','meeting'],features:[]},
 {id:'xiangjiang',short:'湘江突围',title:'突破封锁 · 转向黔北',date:'1934.10—12',
  summary:'中央红军自赣南西进，突破湘江防线后转入贵州。国民党军形成前堵后追、两侧夹击的局面。',
  nodes:['ruijin','yudu','xiangjiang','liping'],sources:['xiang'],
  features:[
   pressure('中央军等 · 后方追击',[[26.0,113.9],[25.8,112.7],[25.7,111.55]],['xiang']),
   pressure('湘军 · 北侧堵截',[[26.7,111.8],[26.3,111.4],[25.98,111.05]],['xiang']),
   pressure('桂军 · 南侧封堵',[[25.15,110.35],[25.40,110.58],[25.68,110.78]],['xiang']),
   block('湘江防线 · 区域示意',[[26.03,111.10],[25.82,110.96],[25.61,110.68]],['xiang'])]},
 {id:'chishui',short:'四渡赤水',title:'四渡赤水 · 迂回机动',date:'1935.01—03',
  summary:'红军在川黔滇边反复机动，回师黔北后再向南渡乌江。箭头只概括各路军压力方向，不细画每个部队的行程。',
  nodes:['liping','zunyi','chishui'],sources:['chishui','manoeuvre'],
  features:[
   march('赤水河反复机动',[[27.69,106.92],[28.10,106.82],[28.28,106.00],[27.86,105.05],[28.05,106.10],[28.10,106.82],[27.69,106.92],[27.86,106.37],[28.08,106.02],[27.90,106.38],[27.1,106.7]],['manoeuvre']),
   pressure('川军 · 川南堵截',[[28.85,105.70],[28.59,105.96],[28.35,106.10]],['chishui']),
   pressure('中央军等 · 黔北追逼',[[26.85,106.95],[27.15,106.98],[27.50,106.85]],['chishui']),
   block('川黔边重兵区域',[[28.42,105.70],[28.43,106.05],[28.40,106.42]],['chishui'])]},
 {id:'jinsha',short:'转兵云南',title:'佯逼贵阳 · 巧渡金沙江',date:'1935.04—05',
  summary:'红军南渡乌江后佯逼贵阳，利用滇军东调的空隙向云南急进，继而北渡金沙江。',
  nodes:['chishui','jiaoping'],sources:['manoeuvre'],
  features:[
   march('南下转兵 · 北渡金沙',[[27.1,106.7],[26.58,106.7],[26.1,105.7],[25.55,104.5],[25.4,103.3],[25.5,102.7],[26.29,102.38]],['manoeuvre']),
   pressure('滇军东调 · 贵阳方向',[[25.1,102.8],[25.8,104.4],[26.50,106.35]],['manoeuvre']),
   pressure('追兵 · 黔西南方向',[[26.5,106.3],[26.1,105.5],[25.8,104.6]],['manoeuvre'])]},
 {id:'dadu',short:'大渡河',title:'抢渡大渡河 · 翻越雪山',date:'1935.05—06',
  summary:'后方中央军追近，川军在大渡河渡口布防。红军抢渡安顺场、夹江北上夺取泸定桥，随后翻越夹金山。',
  nodes:['jiaoping','anshun','luding','jiajin','dawei','lianghekou'],sources:['dadu'],
  features:[
   pressure('中央军薛岳等部 · 南侧北追',[[28.1,102.8],[28.5,102.6],[28.95,102.40]],['dadu']),
   block('川军 · 大渡河渡口设防',[[29.23,102.28],[29.52,102.19],[29.91,102.23]],['dadu'])]},
 {id:'grass',short:'草地北上',title:'绕松潘设防区 · 出腊子口',date:'1935.07—09',
  summary:'胡宗南部在松潘集结，川军从东、南面施压。红军经草地北上，再突破鲁大昌部防守的腊子口。主线不穿过松潘县城。',
  nodes:['lianghekou','songpan','baxi','lazikou','hadapu'],sources:['grass','lazi'],
  features:[
   block('胡宗南部 · 松潘设防区',[[32.42,103.6],[32.65,103.62],[32.87,103.65]],['grass']),
   pressure('川军 · 东南侧逼近',[[32.15,104.15],[32.37,103.72],[32.60,103.36]],['grass']),
   block('鲁大昌部 · 腊子口阻截',[[34.08,103.72],[34.11,103.90],[34.18,104.05]],['lazi'])]},
 {id:'wuqi',short:'落脚陕北',title:'到达吴起 · 阻击尾追骑兵',date:'1935.09—10',
  summary:'中央红军由甘南继续北上到达吴起。随后在吴起以西一带反击尾随的东北军和宁夏骑兵，结束长期尾追。',
  nodes:['lazikou','hadapu','wuqi'],sources:['wuqi'],
  features:[pressure('东北军、宁夏骑兵 · 尾追方向',[[36.0,107.0],[36.45,107.65],[36.80,108.0]],['wuqi'])]},
 {id:'meeting',short:'三军会师',title:'会宁、将台堡 · 三军会师',date:'1936.10',
  summary:'会宁和将台堡标记1936年的会师。红色短箭头仅提示会合方向，不把1935年吴起终点接成一条连续南返路线。',
  nodes:['huining','jiangtai'],sources:['meeting','jingning'],
  features:[
   march('红四方面军 · 会宁会合方向',[[35.10,104.65],[35.40,104.95],[35.69,105.05]],['meeting','jingning']),
   march('红二方面军 · 将台堡会合方向',[[35.20,105.46],[35.52,105.67],[35.82,105.84]],['meeting']),
   pressure('胡宗南等部 · 西兰公路方向',[[34.65,105.4],[35.12,105.45],[35.44,105.55]],['jingning']),
   block('静宁—会宁方向堵截示意',[[35.55,104.9],[35.60,105.35],[35.53,105.75]],['jingning'])]}
];

export const campaignBoundary='双方线条概括区域行动方向，不代表精确兵力、阵地边界或逐日轨迹；箭头未标绘的地方不等于没有军事行动。';
