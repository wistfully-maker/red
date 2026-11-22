// 图源集中在此处：替换 src 时，一并更新 alt、badge、caption、credit、license、source、boundary 和 kind。
// kind: photograph（纪实照片）/ illustration（艺术演绎）/ diagram（结构示意）。
export const journalMedia = {
  bridge: {
    src: new URL('./journal/luding-2018-cc0.jpg', import.meta.url).href,
    alt: '2018年的泸定桥横跨大渡河，远岸有桥亭，桥上有人通行。',
    caption: '泸定桥与大渡河，2018年。今天的桥与城镇，帮助我们辨认地形和结构。',
    credit: 'Huangdan2060 / Wikimedia Commons',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Luding_Bridge_over_the_Dadu_River,_in_Luding_County,_Sichuan,_China,_2018.jpg',
    kind: 'photograph',
    badge: '纪实照片 · 2018',
    title: '2018 · 从河岸远望',
    boundary: '这张照片摄于2018年，不能作为1935年战斗现场的影像证据。文件说明中的具体月日有差异，此处只标年份。',
  },
  deck: {
    src: new URL('./journal/luding-deck-2026-cc-by-sa.jpg', import.meta.url).href,
    alt: '从西向东看泸定桥桥面，近处能辨认左右两侧相扣的铁环、两层扶手链及脚下纵横铺设的木板。',
    badge: '纪实照片 · 2026.02.05',
    caption: '走到桥面上，铁索才成为一枚枚相扣的铁环。原图按完整比例显示，未作调色或裁切；编号为本页观察标记。',
    credit: 'N509FZ / Wikimedia Commons',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Luding_Bridge_from_the_west_(20260205115349).jpg',
    kind: 'photograph',
    title: '2026 · 走到桥面上',
    boundary: '照片记录2026年的桥面与维护后的构造，不能直接推定1935年的铺板样式。编号只是观察指引，不是测绘点。',
  },
  life: {
    src: new URL('./scene-studies/luding.webp', import.meta.url).href,
    alt: '场景设计图：桥头茶摊、背负行李的行人和驮马，远处为铁索桥。',
    caption: '桥头的日常。图集既有场景设计图，用来提出观察问题。',
    credit: '山河之路 · 场景设计',
    license: '项目既有生成式设计素材',
    source: '',
    kind: 'illustration',
    badge: '艺术演绎 · 场景设计',
    title: '桥头日常 · 艺术演绎',
    boundary: '人物、茶摊、服装和建筑细节为艺术演绎；此图不是历史照片，也不能证明某位居民曾在此处活动。',
  },
  guide: {
    src: new URL('./valley/recorder-portrait.webp', import.meta.url).href,
    alt: '虚构行记员戴软帽、背帆布包，手持红扣带行记本。',
    caption: '行记员 · 虚构研学向导',
    credit: '山河之路 · 角色设计',
    license: '项目既有生成式角色素材',
    source: '',
    kind: 'illustration',
    badge: '艺术演绎 · 虚构角色',
    title: '行记员 · 虚构向导',
    boundary: '她负责引导观察与提问，不是历史人物，也不是战斗见证人。她的话是当代研学提示。',
  },
};

export const journalSources = [
  { id: 'S1', title: '泸定县人民政府 · 旅游资源', url: 'https://www.luding.gov.cn/gzldx/c101737/201705/e860e300f30e4f459e5b325c476c8050.shtml', note: '核对1705年动工、次年建成及桥梁作为交通设施的历史。' },
  { id: 'S2', title: '中国共产党新闻网 · 飞夺泸定桥', url: 'https://cpc.people.com.cn/n1/2025/0308/c443712-40434014.html', note: '2025年3月8日，来源《江西日报》。核对安顺场摆渡受限、两岸北进、22名突击队员、火力掩护及后续铺板。此文为后来的历史叙述。' },
  { id: 'S3', title: '国家民委 · 红军飞夺泸定桥纪念馆', url: 'https://www.neac.gov.cn/seac/c103547/202108/1152202.shtml', note: '2021年8月，纪念馆介绍。用于延伸参访与理解纪念地如何保存、讲述这段历史。' },
  { id: 'S4', title: '泸定桥景区 · 景点介绍', url: 'https://www.scldq.cn/tourism/scenic/19.html', note: '核对13根铁索的分工：9根底链、两侧合计4根扶手链。不同资料对桥长的数值不尽相同，本页不作精确测绘。' },
];

export const bridgeObservations = [
  { title: '底链：托住桥面', body: '9根铁链并排构成桥底，上铺木板。移去示意图中的桥板，看看原先被遮住的承重部分。', question: '木板与铁链，分别承担什么作用？', source: 'S4' },
  { title: '扶手链：分列两侧', body: '另外4根铁链分在桥的两侧作扶手。13根铁链承担的任务不同，不能把它们都理解成脚下的桥面。', question: '结构上的“13根”，怎样分成“9 + 4”？', source: 'S4' },
  { title: '桥台：把两岸接起来', body: '铁链需要固定在岸上的桥台中。观察时，除了看江上的桥身，还要看桥与两岸地形怎样连接。', question: '如果只画江上的一段，会漏掉哪些支撑？', source: 'S1' },
];

export const imageQuestion = {
  prompt: '给2026年的这张桥面照片写图注，哪一句有照片直接支持？',
  choices: [
    ['“1935年夺桥时，脚下的木板就是这样铺的。”', '照片记录的是2026年。要判断1935年的铺板方式，需要当时的材料与后续维修记录，不能把今天的画面移到过去。'],
    ['“照片近处可见相扣的铁环与木板桥面。”', '你把判断留在画面可见的范围内了。战斗日期和突击队人数，仍要另查历史叙述。'],
    ['“照片证明了22名突击队员的具体行进位置。”', '照片中没有记录1935年的行动。人物数量与行进叙述要从相应史料查证，不能由后来的照片推出。'],
  ],
  answer: 1,
};
