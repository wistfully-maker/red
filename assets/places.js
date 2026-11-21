export const chapters = [
  { title: '出发与突围', date: '1934.10–11', start: 'ruijin', question: '对照于都与湘江的位置。河流怎样改变了红军的行军与突围？' },
  { title: '转折与机动', date: '1934.12–1935.05', start: 'liping', question: '把黎平、遵义和赤水河放在一张图上看，行军方向发生了哪些变化？' },
  { title: '越险向北', date: '1935.05–10', start: 'anshun', question: '大渡河、夹金山和川西北草地，分别给行军带来了什么困难？' },
  { title: '胜利会师', date: '1936.10', start: 'huining', question: '吴起镇、会宁和将台堡三个地方，各自见证了什么？' }
];

export const places = {
  ruijin: {
    tag: '赣南丘陵', title: '群丘之间的云石山',
    look: '看周围低山和谷地怎样交错。云石山的旧址在赣南丘陵之间，沿河谷向西可通往于都。',
    distance: 11, pitch: .70, bearing: .72
  },
  yudu: {
    tag: '于都河谷', title: '从南北两岸看长征第一渡',
    look: '沿于都河辨认两岸平地与周边低丘。中央红军主力在这里集结，从多个渡口相继过河。',
    distance: 9, pitch: .78, bearing: -.52
  },
  xiangjiang: {
    tag: '湘江冲积平地', title: '河道与走廊',
    look: '把视角拉高，看湘江两侧的平地和外围山地。地图标在全州纪念园，战斗还发生在兴安、灌阳等地。',
    distance: 14.5, pitch: .88, bearing: -.38
  },
  liping: {
    tag: '黔东南山地', title: '山间的黎平城',
    look: '观察城镇平地如何嵌在群山之中。把视角拉远，可以沿章节顺序对照此前的湘江和此后的遵义。',
    distance: 10.8, pitch: .72, bearing: .45
  },
  zunyi: {
    tag: '黔北谷地', title: '群山围绕的遵义城区',
    look: '顺着城镇与山坡的边缘辨认河谷。遵义会议会址在城中，向西北进入赤水河沿线，山地和河谷更加逼仄。',
    distance: 11.6, pitch: .76, bearing: -.34,
    close: { label: '下潜至遵义会址', context: '遵义会议会址 · 外观示意', distance: .093, pitch: .51,
      bearing: .19, modelZoom: .065, mobileScale: 1.42 }
  },
  chishui: {
    tag: '川黔峡谷 · 精细地形', title: '赤水河绕过土城',
    look: '沿河弯看山脊和狭窄的谷底，观察渡口如何与山路相接。土城是四渡赤水的代表性地点，四次渡河涉及多处渡口。',
    distance: 9.2, pitch: .59, bearing: 1.10,
    close: { label: '俯看土城河弯', distance: 4.5, pitch: 1.23, bearing: .72 }
  },
  jiaoping: {
    tag: '金沙江深切河谷 · 精细地形', title: '皎平渡两岸的山壁',
    look: '从斜上方比较河面与两侧的高差。可见的水面和岸线取自现代卫星影像，历史渡口的位置见档案。',
    distance: 8.5, pitch: .59, bearing: -1.06,
    close: { label: '俯看金沙江两岸', distance: 4.2, pitch: 1.18, bearing: -.8 }
  },
  anshun: {
    tag: '大渡河中游', title: '安顺场河弯',
    look: '顺着弯曲的河道向上游看，安顺场和泸定桥是同一条大渡河上的两个节点。',
    distance: 11, pitch: .65, bearing: 1.35
  },
  luding: {
    tag: '大渡河峡谷 · 精细地形', title: '一道铁索横过大渡河',
    look: '跟随峡谷辨认河道、谷底城镇和两侧山脊。地标锚定在泸定桥位置，河谷与坡面来自实测高程和卫星影像。',
    distance: 6.2, pitch: .62, bearing: .12,
    close: { label: '下潜至泸定桥址', context: '大渡河 · 铁索桥结构示意', distance: .35, pitch: .48, bearing: .33, mobileScale: 1.64, modelZoom: .19 },
    historic: { history: true, context: '1935 年 5 月 29 日 · 夺桥前', distance: .192, pitch: .32, bearing: .40, mobileScale: 1.95, modelZoom: .145 }
  },
  jiajin: {
    tag: '川西高山 · 精细地形', title: '从山脚望向夹金山',
    look: '观察低处的谷地和后方的高山脊线。地图从纪念设施所在的山脚取景，向北看翻越雪山的方向。',
    distance: 11.2, pitch: .58, bearing: .42,
    close: { label: '望向高山脊线', distance: 8.1, pitch: .40, bearing: .22 }
  },
  dawei: {
    tag: '小金山谷', title: '会合于达维谷地',
    look: '看道路和聚落如何依着狭长的谷地延伸。达维是翻越夹金山之后的会师节点。',
    distance: 9.5, pitch: .68, bearing: -.78
  },
  lianghekou: {
    tag: '川西山地河谷', title: '两河口的谷地交汇',
    look: '从两侧坡面找到谷地汇合的位置，再把视角拉远，比较附近山脊的高度与延伸方向。',
    distance: 10.2, pitch: .68, bearing: -.35
  },
  songpan: {
    tag: '川西北高地 · 精细地形', title: '从纪念地看向高原湿地',
    look: '点位在川主寺纪念碑园。切换若尔盖湿地镜头，可以对照低平的草甸、水面和沼泽，理解过草地所面对的地理环境。',
    distance: 16.3, pitch: .65, bearing: .06,
    close: { label: '飞往若尔盖湿地', context: '若尔盖 · 花湖湿地', region: 'huahu', center: [33.902, 102.819], distance: 12.2, pitch: .96, bearing: .16 }
  },
  baxi: {
    tag: '若尔盖高地', title: '巴西的坡地与开阔谷地',
    look: '将地势较缓的谷地与周围山脊对照，理解草地之后补给和继续北上的地理条件。',
    distance: 13, pitch: .76, bearing: 2.14
  },
  lazikou: {
    tag: '甘南峡谷', title: '两道山壁之间的关口',
    look: '找出峡谷收窄的地方，比较正面的通道与两侧峭坡，理解为何侧翼迂回对战斗关键。',
    distance: 8.8, pitch: .61, bearing: 2.2
  },
  hadapu: {
    tag: '陇南山间谷地', title: '哈达铺的山间聚落',
    look: '辨认聚落、田地和周围山地的边界。哈达铺的休整与补给，让继续向北的部队获得了喘息。',
    distance: 10.4, pitch: .74, bearing: 2.61
  },
  wuqi: {
    tag: '陕北黄土沟壑', title: '沟谷之间的陕北落脚点',
    look: '抬高镜头观察支沟如何汇入主沟。与此前川西的高山峡谷相比，这里的黄土梁峁和沟壑呈现不同纹理。',
    distance: 11.8, pitch: .87, bearing: .52
  },
  huining: {
    tag: '陇中黄土丘陵', title: '河谷平地上的会宁',
    look: '观察城镇所在谷地与周围的黄土坡地。继续向东看将台堡，两站合读可以厘清会师时序。',
    distance: 11.5, pitch: .79, bearing: -.65
  },
  jiangtai: {
    tag: '宁南丘陵与河谷', title: '将台堡与附近的谷地',
    look: '从坡地转向较开阔的谷地，观察历史聚落所处的位置。回看会宁，比较两次会师发生的地理环境。',
    distance: 10.4, pitch: .80, bearing: -.17
  }
};
