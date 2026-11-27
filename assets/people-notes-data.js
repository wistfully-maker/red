// Historical roles retain their source type; unnamed people remain unnamed.
export const peopleThemes = {
  "print": "印刷与消息",
  "women": "妇女与劳动",
  "care": "救护与互助",
  "decisions": "协商与抉择",
  "crossings": "街巷与渡口",
  "supplies": "物资与记忆"
};

export const peopleNotes = {
  "ruijin": {
    "theme": "print",
    "subject": "铅印新闻纸",
    "title": "从瑞金寄出的消息",
    "note": "瑞金中央革命根据地纪念馆藏有1933年7月14日的《红色中华》第九十四期。那张黄褐色新闻纸用铅印制成。翻到旧报的版面，就能读到长征出发前苏区怎样用报纸发布消息、讲解政策。",
    "boundary": "这张实物报纸出版在长征出发之前。瑞金馆藏为刊期和纸张提供依据，排印工位与当时读者的情形需要进一步查证。",
    "sources": [
      [
        "瑞金中央革命根据地纪念馆 · 第九十四期《红色中华》",
        "https://www.rjjng.com.cn/cp-content.thtml?cid=10951&id=22262"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "编辑与排印者",
        "kind": "匿名历史岗位",
        "task": "把消息变成可传阅的版面",
        "detail": "从报刊的刊期和版面进入编辑、排字与印刷的分工，不替尚未核名的工人安排具体动作。",
        "limit": "尚需核对具体人员、工位与设备。"
      },
      {
        "id": "role-1",
        "name": "阅读与传达者",
        "kind": "匿名历史群体",
        "task": "让文字进入组织与生活",
        "detail": "报纸不仅是一张被保存的纸，也指向消息怎样被阅读和转述。具体读者与传播路径仍须逐件查证。",
        "limit": "不能由一份馆藏反推所有人的读报场面。"
      },
      {
        "id": "role-2",
        "name": "征集与保管者",
        "kind": "当代保护工作者",
        "task": "让一期报纸留下可追溯的来历",
        "detail": "收藏、编号与保存，使后来的人有机会核对刊名、日期与纸张。这里区分历史使用和后来的收藏工作。",
        "limit": "入藏经过应读馆方记录，不编造捐赠故事。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "一张纸的前后",
        "text": "先看刊名、刊期和保存说明，再问它如何被制作、传阅。版面能提供线索，但不是排印现场照片。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "文字怎样到达人",
        "text": "编辑、印刷、阅读和传达是不同工作。把它们连起来，才能看到消息背后的劳动，而不只记住报纸名称。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "馆藏与复原分开读",
        "text": "实物报纸、旧照片与后来搭建的编辑工位，属于不同证据类型。各自标明来源，才能共同帮助理解。"
      }
    ],
    "relation": "编辑排印 → 阅读传达 → 后来保存",
    "observation": "我先从刊期与版面读起，再去寻找制作和使用这份报纸的人。没有核名的岗位仍可以被看见，但不因此获得虚构姓名。",
    "image": {
      "src": "assets/archive/ruijin-museum.jpg",
      "caption": "瑞金中央革命根据地纪念馆的当代资料照片。不是云石山古寺现场，不作1934年原状证明。非行记员现场拍摄。",
      "credit": "郭 敏 · CC BY 2.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:%E7%91%9E%E9%87%91%E4%B8%AD%E5%A4%AE%E9%9D%A9%E5%91%BD%E6%A0%B9%E6%8D%AE%E5%9C%B0%E7%BA%AA%E5%BF%B5%E9%A6%86_(12733634133).jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
    },
    "imageContext": "主图为瑞金纪念馆当代实景背景，不是报纸原件或1933年排印现场。",
    "evidence": [
      {
        "kind": "馆藏条目线索",
        "title": "这条人物线索来自哪里",
        "text": "这张实物报纸出版在长征出发之前。瑞金馆藏为刊期和纸张提供依据，排印工位与当时读者的情形需要进一步查证。",
        "url": "https://www.rjjng.com.cn/cp-content.thtml?cid=10951&id=22262",
        "label": "瑞金中央革命根据地纪念馆 · 第九十四期《红色中华》"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为瑞金纪念馆当代实景背景，不是报纸原件或1933年排印现场。",
        "url": "https://commons.wikimedia.org/wiki/File:%E7%91%9E%E9%87%91%E4%B8%AD%E5%A4%AE%E9%9D%A9%E5%91%BD%E6%A0%B9%E6%8D%AE%E5%9C%B0%E7%BA%AA%E5%BF%B5%E9%A6%86_(12733634133).jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "yudu": {
    "theme": "women",
    "subject": "绣球草鞋",
    "title": "做鞋的人也在出发故事里",
    "note": "队伍在于都集结时，草鞋、船只和木料都与地方支援相连。编鞋妇女、提供物资者和组织通行者承担不同工作。绣球草鞋的地方叙事提供物件与人物线索，文中戏剧化对白仍需与馆藏和其他记录区别阅读。",
    "boundary": "草鞋的来历取自地方叙事与纪念馆报道。春秀的具体动作、表情和对话属于待查细节。",
    "sources": [
      [
        "于都县人民政府 · 绣球草鞋",
        "https://www.yudu.gov.cn/yudu/ydrw/202102/f95eb2d8938546a98afbe196e975b0c4.shtml"
      ],
      [
        "人民日报海外版 · 中央红军长征出发地馆访",
        "https://paper.people.com.cn/rmrbhwb/page/2019-06/14/05/rmrbhwb2019061405.pdf"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "赶制草鞋的妇女",
        "kind": "匿名历史群体",
        "task": "把纤维编成行军所需",
        "detail": "地方资料将草鞋劳动放入集结与出发的叙述。关注取料、编结和供给的关系，不把文学化对白当成即时记录。",
        "limit": "具体编鞋者、动作与对白应另核。"
      },
      {
        "id": "role-1",
        "name": "提供船只与木料者",
        "kind": "匿名地方群体",
        "task": "把日常物件接到临时通路上",
        "detail": "船只、木料和桥面材料使渡河能够组织起来。参与者的家庭生活与公共支援在这里发生联系。",
        "limit": "不将模型船指定为某户人的原船。"
      },
      {
        "id": "role-2",
        "name": "组织通行的红军人员",
        "kind": "匿名历史岗位",
        "task": "让队伍与通路相互配合",
        "detail": "集结、候渡、过河和离岸需要衔接；这项工作不能被一幅持续前进的画面全部替代。",
        "limit": "不自行补写逐分钟通行规程。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "草鞋与门板",
        "text": "一双鞋与一块木板都来自日常生活。先辨认用途怎样改变，再询问物件的具体来历。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "看见一条协作链",
        "text": "做鞋的人、提供物资的人与组织通行的人承担不同工作，不能都退成送行画面的背景。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "地方叙事的边界",
        "text": "绣球草鞋文章含文学化场景。它提供人物与物件线索，文中对白和神态不能不加区分地当作原始口述。"
      }
    ],
    "relation": "编鞋与备料 → 组织通行 → 队伍离岸",
    "observation": "我把人的劳动写在船与桥板旁边，也把地方故事的写法与能够独立核对的记录分开。",
    "image": {
      "src": "assets/archive/yudu-2014-cc-by-sa.jpg",
      "caption": "于都中央红军长征第一渡口（东门外渡口）的当代纪念地，2014年5月30日摄。照片中的纪念标识与铺装不是1934年原状；非行记员当场拍摄。",
      "credit": "Zhangzhugang · CC BY-SA 3.0 · Commons 960px缩略版本，无另行裁切或调色；该图像版本继续按CC BY-SA 3.0提供",
      "source": "https://commons.wikimedia.org/wiki/File:Yudu_Zhongyang_Hongjun_Changzheng_Diyi_Dukou_2014.05.30_11-27-58.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
    },
    "imageContext": "主图是2014年的渡口纪念地，不是编鞋场面、草鞋原件或1934年夜渡照片。",
    "evidence": [
      {
        "kind": "地方记述与纪念馆报道",
        "title": "这条人物线索来自哪里",
        "text": "草鞋的来历取自地方叙事与纪念馆报道。春秀的具体动作、表情和对话属于待查细节。",
        "url": "https://www.yudu.gov.cn/yudu/ydrw/202102/f95eb2d8938546a98afbe196e975b0c4.shtml",
        "label": "于都县人民政府 · 绣球草鞋"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图是2014年的渡口纪念地，不是编鞋场面、草鞋原件或1934年夜渡照片。",
        "url": "https://commons.wikimedia.org/wiki/File:Yudu_Zhongyang_Hongjun_Changzheng_Diyi_Dukou_2014.05.30_11-27-58.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "xiangjiang": {
    "theme": "care",
    "subject": "下立湾祠堂",
    "title": "一座祠堂临时收治伤员",
    "note": "湘江战役期间，灌阳新圩的下立湾祠堂曾作临时救护所。部分重伤员未能撤出，后在酒海井遇难。到今天，祠堂旧址与纪念园一起，留下关于战地救护、伤员处境和后人安葬烈士的记忆。",
    "boundary": "本站地图定位全州纪念园。祠堂与酒海井在灌阳，是同一战役在另一县留下的遗址。",
    "sources": [
      [
        "广西纪检监察网 · 酒海井红军纪念园",
        "https://www.gxjjw.gov.cn/staticpages/20231228/gxjjw658ce72c-187121.shtml"
      ],
      [
        "广西新闻网 · 灌阳新圩酒海井烈士遗骸安葬",
        "https://v.gxnews.com.cn/a/16796878"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "救护人员",
        "kind": "匿名历史岗位",
        "task": "在临时空间中照应伤员",
        "detail": "祠堂曾承担救护功能的记述，将建筑与伤员处境相连。医疗工作不应只作为战斗背景出现。",
        "limit": "器械、人员姓名与具体治疗场面需另查。"
      },
      {
        "id": "role-1",
        "name": "后卫与阻击部队",
        "kind": "匿名历史群体",
        "task": "为其他队伍争取通过时间",
        "detail": "渡河与两岸阻击相互关联，留在后方的人承担不同的任务和风险。",
        "limit": "不从一个POI推断全部战斗位置。"
      },
      {
        "id": "role-2",
        "name": "寻访与安葬工作者",
        "kind": "当代纪念群体",
        "task": "让姓名与安葬重新进入记忆",
        "detail": "后来对遗址、烈士与遗骸的寻访属于持续的纪念工作，与战时经历分属不同年代。",
        "limit": "不将后世纪念照片冒称战时救护影像。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "临时救护空间",
        "text": "祠堂的原有用途与战时使用需要分别说明。模型陈设只能提示问题，不能直接认定某件器械曾在场。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "河两边的人",
        "text": "把渡河、阻击与救护一起读，才看见一段通路与不在画面中心的人之间的关系。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "地名和年代都保留",
        "text": "下立湾与酒海井位于灌阳；本站地图节点在全州。纪念园、祠堂与战役区域不等于同一个地点。"
      }
    ],
    "relation": "阻击掩护 → 队伍通行；救护与后来安葬延续另一条时间线",
    "observation": "我不靠想象枪声进入这一页，而是把不同任务、不同地点和后来寻找姓名的工作放在一起读。",
    "image": {
      "src": "assets/archive/xiangjiang-museum.jpg",
      "caption": "全州湘江战役纪念馆当代资料照片。纪念馆与纪念陈列不是1934年战场的原始摄影。非行记员现场拍摄。",
      "credit": "N509FZ · CC BY-SA 4.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:Xiangjiang_Campaign_Memorial_Hall,_Quanzhou_(20250122171627).jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
    },
    "imageContext": "主图是全州纪念馆当代实景，不是灌阳临时救护所或1934年战场照片。",
    "evidence": [
      {
        "kind": "遗址报道与安葬记录",
        "title": "这条人物线索来自哪里",
        "text": "本站地图定位全州纪念园。祠堂与酒海井在灌阳，是同一战役在另一县留下的遗址。",
        "url": "https://www.gxjjw.gov.cn/staticpages/20231228/gxjjw658ce72c-187121.shtml",
        "label": "广西纪检监察网 · 酒海井红军纪念园"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图是全州纪念馆当代实景，不是灌阳临时救护所或1934年战场照片。",
        "url": "https://commons.wikimedia.org/wiki/File:Xiangjiang_Campaign_Memorial_Hall,_Quanzhou_(20250122171627).jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "liping": {
    "theme": "decisions",
    "subject": "十二月十八日的决定",
    "title": "把改向写成一份文件",
    "note": "通道讨论后，队伍先进入贵州。1934年12月18日，中央政治局在黎平讨论下一步方针，并形成书面决定。把这个日期和此前经过的地方排在一起，就能看出先行调整与正式决定各发生在何时。",
    "boundary": "档案能核对书面决定和日期。会场里的逐句讨论、座位和桌面物件另需史料支持。",
    "sources": [
      [
        "上海市委党史研究室 · 黎平会议与中央档案馆藏文件",
        "https://www.ccphistory.org.cn/shds/dsxx/content/96ef5450-033f-4388-b7b5-c51d9dbf9fab.html"
      ],
      [
        "国防部 · 通道转兵纪念馆走访",
        "https://www.mod.gov.cn/gfbw/gfjy_index/4844803.html"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "参加讨论者",
        "kind": "历史会议群体",
        "task": "面对下一段行军方向",
        "detail": "会议形成的战略决定能够核对；当场每个人怎样发言，需要各自材料支持。",
        "limit": "不由模型姿态补写逐句争论。"
      },
      {
        "id": "role-1",
        "name": "文书与传达岗位",
        "kind": "匿名工作角色",
        "task": "让决定进入实际部署",
        "detail": "书面决定与后续执行分属相连的工作。这里关注形成文字与落实行动之间的联系。",
        "limit": "不自行指定现场记录员或传令者姓名。"
      },
      {
        "id": "role-2",
        "name": "街屋的使用者",
        "kind": "地方生活群体",
        "task": "让会址保持日常的原有尺度",
        "detail": "商号原本属于街镇生活，后来成为会议见证。建筑并不是专为纪念而出现。",
        "limit": "房屋原有使用细节以地方资料为限。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "商号与文件",
        "text": "房屋提供空间，文件留下决定。看清建筑不等于读完会议，也不能仅凭文件还原室内全部陈设。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "讨论之后还有执行",
        "text": "将日期、书面决定与行动安排排在一起，能看出选择如何逐步落实。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "不把座次当证词",
        "text": "模型桌椅用于理解尺度；具体座位、灯光和动作没有独立依据时应保留为示意。"
      }
    ],
    "relation": "讨论方向 → 形成文件 → 安排行动",
    "observation": "我在街名旁边写上文件名，让一座商号与一次决定各自保留能够证明的内容。",
    "image": {
      "src": "assets/archive/liping-oldstreet.jpg",
      "caption": "黎平老街的当代资料照片，原文件标注为黎平会议所在地街区；不据街景推断会议室原状。非行记员现场拍摄。",
      "credit": "Joseph Yu · CC BY-SA 3.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:%E9%BB%8E%E5%B9%B3%E5%8E%BF%E8%80%81%E8%A1%97%EF%BC%88%E9%BB%8E%E5%B9%B3%E4%BC%9A%E8%AE%AE%E6%89%80%E5%9C%A8%E5%9C%B0%EF%BC%89_-_panoramio.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"
    },
    "imageContext": "主图是黎平老街当代资料照片，不是会议室内的即时记录。",
    "evidence": [
      {
        "kind": "会议文件与党史研究",
        "title": "这条人物线索来自哪里",
        "text": "档案能核对书面决定和日期。会场里的逐句讨论、座位和桌面物件另需史料支持。",
        "url": "https://www.ccphistory.org.cn/shds/dsxx/content/96ef5450-033f-4388-b7b5-c51d9dbf9fab.html",
        "label": "上海市委党史研究室 · 黎平会议与中央档案馆藏文件"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图是黎平老街当代资料照片，不是会议室内的即时记录。",
        "url": "https://commons.wikimedia.org/wiki/File:%E9%BB%8E%E5%B9%B3%E5%8E%BF%E8%80%81%E8%A1%97%EF%BC%88%E9%BB%8E%E5%B9%B3%E4%BC%9A%E8%AE%AE%E6%89%80%E5%9C%A8%E5%9C%B0%EF%BC%89_-_panoramio.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "zunyi": {
    "theme": "print",
    "subject": "《红星》报编辑室",
    "title": "从会址走到编辑室",
    "note": "遵义老城杨柳街有一处天主教堂旧址。红军在遵义期间，总政治部设在院里的学堂。今天当地纪念馆在这里陈列《红星》报编辑室，让人在会议之外，看到编辑、组织和传达消息也是一路上的工作。",
    "boundary": "编辑室属于纪念馆按调查资料作出的复原陈列。会址与总政治部旧址各有具体地址，采访原文附有旧址说明。",
    "sources": [
      [
        "遵义会议纪念馆馆长撰文 · 遵义城也有“总政”",
        "https://movement.gzstv.com/news/detail/zN5pg/"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "报刊编辑者",
        "kind": "匿名历史岗位",
        "task": "整理与组织消息",
        "detail": "编辑工作的线索让我们在会议之外看见信息的制作，但不能从复原陈列直接认定某人当时的工作状态。",
        "limit": "具体编辑名单与分工需另核。"
      },
      {
        "id": "role-1",
        "name": "政治工作与传达人员",
        "kind": "匿名历史群体",
        "task": "把文字与队伍联系起来",
        "detail": "消息还要被组织、解释和传达，报纸与读者之间并不是空白。",
        "limit": "不由一张报纸推定全部传阅路线。"
      },
      {
        "id": "role-2",
        "name": "旧址调查与陈列者",
        "kind": "当代保护工作者",
        "task": "把调查资料变成可阅读的展示",
        "detail": "会址和总政治部旧址各有地址，编辑室陈列属于后来依资料进行的复原。",
        "limit": "复原陈列不是1935年室内摄影。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "从一份报走向一间房",
        "text": "刊物与工作空间能够互相提出问题，却不能彼此代替证据。先辨清原件与陈列，再看场景。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "信息也是一路上的工作",
        "text": "会议、编辑、组织与传达承担不同任务。把它们并列，能让人物不只围在一张会议桌旁。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "两个旧址不合并",
        "text": "主楼会址与杨柳街总政治部旧址不是同一处。图像和文字应分别交代对象。"
      }
    ],
    "relation": "编辑组织 → 阅读传达 → 调查与复原陈列",
    "observation": "我从会址走向材料中的编辑室线索，但不把会址照片换个标题就当作编辑室照片。",
    "image": {
      "src": "assets/archive/zunyi-2018-cc-by-sa.jpg",
      "caption": "遵义会议会址，2018年2月20日实景资料照片。非1935年会议现场，非行记员当场拍摄。",
      "credit": "N509FZ · CC BY-SA 4.0 · Commons 960px缩略版本，无另行裁切或调色；该图像版本继续按CC BY-SA 4.0提供",
      "source": "https://commons.wikimedia.org/wiki/File:Site_of_Zunyi_Conference_(20180220101816).jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/"
    },
    "imageContext": "主图为遵义会议会址实景背景，不是《红星》报编辑室原状图。",
    "evidence": [
      {
        "kind": "馆方撰文与复原陈列说明",
        "title": "这条人物线索来自哪里",
        "text": "编辑室属于纪念馆按调查资料作出的复原陈列。会址与总政治部旧址各有具体地址，采访原文附有旧址说明。",
        "url": "https://movement.gzstv.com/news/detail/zN5pg/",
        "label": "遵义会议纪念馆馆长撰文 · 遵义城也有“总政”"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为遵义会议会址实景背景，不是《红星》报编辑室原状图。",
        "url": "https://commons.wikimedia.org/wiki/File:Site_of_Zunyi_Conference_(20180220101816).jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "chishui": {
    "theme": "women",
    "subject": "李伯钊与街头表演",
    "title": "街头也是女红军的工作地点",
    "note": "土城中国女红军纪念馆的讲解员介绍，一渡赤水前，在中央纵队做宣传工作的李伯钊曾在土城组织宣传，还参加街头演出。地方的纪念空间保存了女红军穿过这条街时承担的工作。",
    "boundary": "演出的线索来自纪念馆讲解员采访。剧本、观众人数、衣着及演出的具体位置有待查明。",
    "sources": [
      [
        "中国妇女报 · 四渡赤水纪念馆和中国女红军纪念馆走访",
        "https://epaper.cnwomen.com.cn/images/2021-03/18/4/04BLM04C318_h.pdf"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "李伯钊",
        "kind": "具名人物，见馆访记述",
        "task": "参与宣传与街头演出",
        "detail": "纪念馆讲解员采访提供了她在土城从事宣传的线索；表演内容和场面仍需具体材料。",
        "limit": "不补写剧本、台词或观众反应。"
      },
      {
        "id": "role-1",
        "name": "宣传工作者",
        "kind": "匿名历史群体",
        "task": "把工作带到街巷中",
        "detail": "宣传并不只在固定室内发生，街道也可能成为工作空间。",
        "limit": "不把所有模型路人指定为演出观众。"
      },
      {
        "id": "role-2",
        "name": "街镇居民",
        "kind": "未具名地方群体",
        "task": "保留街道原有的生活",
        "detail": "街巷有自己的生活与往来，不能全部改写成一场历史表演的布景。",
        "limit": "具体参与者身份与位置未知。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "街头的空间",
        "text": "先看街巷怎样容纳往来，再理解宣传活动与地方生活的联系。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "女红军的工作面向",
        "text": "宣传、组织与文化工作属于具体职责，不只作为行军队伍里的一个形象出现。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "采访支持到哪里",
        "text": "这条线索来自后来馆访。演出位置、服装、台词和人数不能由一幅绘图补齐。"
      }
    ],
    "relation": "宣传工作者 → 街头活动 → 与地方生活相遇",
    "observation": "我先辨认一份采访支持的工作线索，不替街头表演安排一场未经记录的戏。",
    "image": {
      "src": "assets/archive/chishui-maotai.jpg",
      "caption": "仁怀茅台镇赤水河岸的当代资料照片，用于区域读图，非1935年某次渡河现场。非行记员现场拍摄。",
      "credit": "Wahsaw · CC0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:Chishui_River_Bank_in_Maotai(Moutai)_Town,_Renhuai_City,_Zunyi,_Guizhou.jpg",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en"
    },
    "imageContext": "主图为茅台赤水河区域参照，不是土城演出地点或女红军活动原始摄影。",
    "evidence": [
      {
        "kind": "纪念馆讲解员采访",
        "title": "这条人物线索来自哪里",
        "text": "演出的线索来自纪念馆讲解员采访。剧本、观众人数、衣着及演出的具体位置有待查明。",
        "url": "https://epaper.cnwomen.com.cn/images/2021-03/18/4/04BLM04C318_h.pdf",
        "label": "中国妇女报 · 四渡赤水纪念馆和中国女红军纪念馆走访"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为茅台赤水河区域参照，不是土城演出地点或女红军活动原始摄影。",
        "url": "https://commons.wikimedia.org/wiki/File:Chishui_River_Bank_in_Maotai(Moutai)_Town,_Renhuai_City,_Zunyi,_Guizhou.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "jiaoping": {
    "theme": "crossings",
    "subject": "张朝满与两岸船工",
    "title": "船工的名字跨过金沙江",
    "note": "皎平渡两岸的船工用各自熟悉的水路帮助红军渡江。旧报采访留下了云南船工张朝满等人的回忆，调查也记下来自四川的船工姓名。把两岸的人一起写进渡口展签，才能看出这项协作如何跨越省界。",
    "boundary": "受水库蓄水影响，今日可见的江面和历史渡口水位属于两个时期。口述涉及的老地名须对照当时渡口记载。",
    "sources": [
      [
        "人民日报历史档案 · 皎平渡船工回访",
        "https://cn.govopendata.com/renminribao/1985/06/16/5/"
      ],
      [
        "云南日报 · 皎平渡船工名录与旧址水位",
        "https://www.yndaily.com/html/2021/yunguanzhu_0223/118570.html"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "张朝满等船工",
        "kind": "具名人物，见旧报回访",
        "task": "以熟悉水路的经验协助渡江",
        "detail": "回访与调查留下姓名线索，阅读时保留材料形成的年代，不把后来回忆当作现场录音。",
        "limit": "不同回忆中的细节需分别核对。"
      },
      {
        "id": "role-1",
        "name": "两岸船工",
        "kind": "匿名协作群体",
        "task": "反复往返而不只一次靠岸",
        "detail": "运送需要返回和接应，两岸的人共同构成渡江组织。",
        "limit": "不将模型某条船指定为某人的原船。"
      },
      {
        "id": "role-2",
        "name": "组织候渡与离岸者",
        "kind": "匿名历史岗位",
        "task": "让船与队伍衔接",
        "detail": "等待、登船和继续行进需要相互配合，不能只看江心的一个瞬间。",
        "limit": "逐批名单与运送时间没有在本页复原。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "船也要回来",
        "text": "把返回的方向画出来，才能看见连续运送的劳动。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "两岸一起进入叙述",
        "text": "省界不能截断协作；船工、候渡者与接应者承担不同任务。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "回忆与现状分开",
        "text": "旧报回访、船工名录与水库形成后的江面属于不同材料层次。"
      }
    ],
    "relation": "候渡组织 ↔ 两岸船工 ↔ 对岸接应",
    "observation": "我给船头画箭头，也给返航留位置，让运送者的劳动不在抵达的一刻结束。",
    "image": {
      "src": "assets/archive/jiaoping-modernbridge.jpg",
      "caption": "新皎平渡大桥与江谷的当代工程资料照片，不是1935年的木船渡口或当时岸线。非行记员现场拍摄。",
      "credit": "Zhangzj cet · CC BY-SA 4.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:New_Jiaopingdu_Bridge_2020A.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
    },
    "imageContext": "主图为新皎平渡大桥与当代江谷，不是1935年的木船或船工照片。",
    "evidence": [
      {
        "kind": "旧报回访与地方调查",
        "title": "这条人物线索来自哪里",
        "text": "受水库蓄水影响，今日可见的江面和历史渡口水位属于两个时期。口述涉及的老地名须对照当时渡口记载。",
        "url": "https://cn.govopendata.com/renminribao/1985/06/16/5/",
        "label": "人民日报历史档案 · 皎平渡船工回访"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为新皎平渡大桥与当代江谷，不是1935年的木船或船工照片。",
        "url": "https://commons.wikimedia.org/wiki/File:New_Jiaopingdu_Bridge_2020A.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "anshun": {
    "theme": "crossings",
    "subject": "船工名录与老街的热饭",
    "title": "从船工名单找到一个人",
    "note": "帅飞在口述中回忆，爷爷帅仕高擅长撑船，名字列在安顺场纪念馆的船工名录上。他还记下一件家人记得很清楚的小事：上船前，红军曾在老街煮饭招待船工。",
    "boundary": "煮饭细节出自船工后代的口述整理。船工名录用于核对姓名，展馆翘首木船为船形复制品。",
    "sources": [
      [
        "中国纪检监察报 · 帅飞口述《军民齐心越天险》",
        "https://www.qinfeng.gov.cn/info/5660/245460.htm"
      ],
      [
        "人民网 · 安顺场纪念馆走访",
        "https://dangshi.people.com.cn/BIG5/n1/2021/0611/c436975-32128887.html"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "帅仕高",
        "kind": "具名船工，见后代口述",
        "task": "参与摆渡的地方经验",
        "detail": "后代口述将家庭记忆与纪念馆船工名录相连，姓名异写仍需参照不同材料。",
        "limit": "不补写撑船当时的对白。"
      },
      {
        "id": "role-1",
        "name": "突击与组织人员",
        "kind": "历史行动群体",
        "task": "打开通路并衔接后续行动",
        "detail": "强渡与大部队随后通行是相连而不同的问题，军事行动与运送能力需要一起读。",
        "limit": "船形复制品不是战斗当日使用的原船。"
      },
      {
        "id": "role-2",
        "name": "帅飞等口述者",
        "kind": "当代家族记忆传递者",
        "task": "把家人记得的事情带入采访",
        "detail": "口述可以提供生活线索，也应保留讲述者与事件之间的代际距离。",
        "limit": "后代讲述不是本人即时见闻。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "一顿饭的材料类型",
        "text": "生活细节来自后代口述，应说明出处，不扩写锅灶、菜单和场面。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "船工与突击队",
        "text": "水路经验与作战行动在这里协作，两者都不应退成背景。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "名录、复制品、口述",
        "text": "三种材料能够互相帮助，但分别支持姓名、船形或记忆线索。"
      }
    ],
    "relation": "地方船工 ↔ 渡河人员；后代口述 → 后来理解",
    "observation": "我把名录与家族讲述并排，不要求一段口述独自还原整个渡口。",
    "image": {
      "src": "assets/archive/anshun-museum.jpg",
      "caption": "安顺场红军强渡大渡河纪念馆当代资料照片，不是渡河战斗的即时摄影。非行记员现场拍摄。",
      "credit": "N509FZ · CC BY-SA 4.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:Red_Army_Crossing_Dadu_River_Memorial_Hall_(20260204133413).jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
    },
    "imageContext": "主图是安顺场纪念馆当代实景，不是船工进餐或1935年渡河摄影。",
    "evidence": [
      {
        "kind": "船工名录与后代口述",
        "title": "这条人物线索来自哪里",
        "text": "煮饭细节出自船工后代的口述整理。船工名录用于核对姓名，展馆翘首木船为船形复制品。",
        "url": "https://www.qinfeng.gov.cn/info/5660/245460.htm",
        "label": "中国纪检监察报 · 帅飞口述《军民齐心越天险》"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图是安顺场纪念馆当代实景，不是船工进餐或1935年渡河摄影。",
        "url": "https://commons.wikimedia.org/wiki/File:Red_Army_Crossing_Dadu_River_Memorial_Hall_(20260204133413).jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "luding": {
    "theme": "crossings",
    "subject": "康熙年间的铁索桥",
    "title": "江上的桥先服务两岸生活",
    "note": "泸定桥在清康熙年间建成。原先需要靠溜索、渡船等方式跨过大渡河的人，从此多了一条通路。走到桥头时，先看看两岸街巷怎样接到桥上，再把1935年5月的历史放回这座用了两百多年的桥。",
    "boundary": "建桥年代、过河用途与1935年的桥史分别有出处。历史场景所示桥板、桥头陈设和过桥人物属示意。",
    "sources": [
      [
        "泸定县人民政府 · 泸定桥与当地交通",
        "https://www.luding.gov.cn/gzldx/c101737/201705/e860e300f30e4f459e5b325c476c8050.shtml"
      ],
      [
        "国家民委 · 红军飞夺泸定桥纪念馆",
        "https://www.neac.gov.cn/seac/c103547/202108/1152202.shtml"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "两岸居民与行旅者",
        "kind": "长期使用桥梁的匿名群体",
        "task": "让桥连接日常往来",
        "detail": "建桥史让桥先作为通路进入地方生活，而不只是一场战斗的舞台。",
        "limit": "不同年代的通行条件需分开。"
      },
      {
        "id": "role-1",
        "name": "夺桥与铺板参与者",
        "kind": "1935年历史行动群体",
        "task": "争取桥上通路",
        "detail": "夺取、掩护和后续通过是相连的行动，不能由一个模型姿态概括全部。",
        "limit": "完整铺板的展示状态不等于战斗某一瞬间。"
      },
      {
        "id": "role-2",
        "name": "保护与维修者",
        "kind": "后世保护工作群体",
        "task": "让桥继续被使用与理解",
        "detail": "维护、修缮和说明使后人能够观看桥，同时也留下新的时间层。",
        "limit": "不凭构件外观直接认定年代。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "先看桥怎样服务生活",
        "text": "桥台、街巷与桥面把两岸相接，平日用途与战时作用需要同时保留。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "一条通路背后的分工",
        "text": "不要只看冲向桥头的一个人，掩护、铺板与后续通过也属于行动关系。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "铁索与现代照片",
        "text": "构件文物、桥史介绍与当代实景分别提供尺度、背景与现状。"
      }
    ],
    "relation": "日常往来 → 1935年争取通路 → 后来维护与纪念",
    "observation": "我不让一场战斗取消桥的日常用途，也不把后来修缮过的构件统称为当年原物。",
    "image": {
      "src": "assets/journal/luding-2018-cc0.jpg",
      "caption": "泸定桥与大渡河，2018年实景资料照片。非行记员当场拍摄，非1935年战斗现场影像。",
      "credit": "Huangdan2060 · CC0 1.0 · 本地960px资料版本",
      "source": "https://commons.wikimedia.org/wiki/File:Luding_Bridge_over_the_Dadu_River,_in_Luding_County,_Sichuan,_China,_2018.jpg",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/"
    },
    "imageContext": "主图拍摄于2018年，非康熙建桥或1935年夺桥即时摄影。",
    "evidence": [
      {
        "kind": "地方桥史与构件文物说明",
        "title": "这条人物线索来自哪里",
        "text": "建桥年代、过河用途与1935年的桥史分别有出处。历史场景所示桥板、桥头陈设和过桥人物属示意。",
        "url": "https://www.luding.gov.cn/gzldx/c101737/201705/e860e300f30e4f459e5b325c476c8050.shtml",
        "label": "泸定县人民政府 · 泸定桥与当地交通"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图拍摄于2018年，非康熙建桥或1935年夺桥即时摄影。",
        "url": "https://commons.wikimedia.org/wiki/File:Luding_Bridge_over_the_Dadu_River,_in_Luding_County,_Sichuan,_China,_2018.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "jiajin": {
    "theme": "care",
    "subject": "担架与伤病员",
    "title": "走过雪线，也要把病人带过去",
    "note": "在夹金山翻越途中，坡陡、风雪和缺氧使伤病员与担架员都难以行进。宝兴党史研究者记载，王稼祥带伤下担架走路，想减轻担架员的负担。沿着山坡看，一副担架牵动的是几个人一起前进的速度。",
    "boundary": "王稼祥的经历由地方党史研究文章记录。担架样式、抬担架人员和动作细节可作情境示意，仍需其他材料核对。",
    "sources": [
      [
        "宝兴县委党史研究室朱樊刚 · 夹金山作证",
        "https://www.thepaper.cn/newsDetail_forward_12518805"
      ],
      [
        "人民网党史 · 茫茫雪山见证“雪”染的风采",
        "https://dangshi.people.com.cn/n1/2016/1011/c85037-28769403.html"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "王稼祥",
        "kind": "具名人物，见地方党史记述",
        "task": "带伤行进的个体线索",
        "detail": "地方研究记述他下担架行走以减轻负担，这一线索应连同来源阅读。",
        "limit": "不复原未有记录的个人表情与对白。"
      },
      {
        "id": "role-1",
        "name": "担架员",
        "kind": "匿名历史岗位",
        "task": "让伤病员与队伍一起前进",
        "detail": "抬担架把几个人的步伐与体力联系起来，救护也成为行军的一部分。",
        "limit": "担架样式、人员名单与站位未逐件考证。"
      },
      {
        "id": "role-2",
        "name": "后卫掩护部队",
        "kind": "匿名历史群体",
        "task": "承担不同步的山地任务",
        "detail": "先头、后续与后卫不是同一个越岭时刻，需要保留各自的行程。",
        "limit": "不为全军安排统一的登顶场景。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "担架不是一件孤物",
        "text": "先看承托与抬运如何把人联系起来，再问实物和记述能支持什么。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "不同任务的速度",
        "text": "伤病员、担架员与后卫各有处境，不能都压成同一支不断向前的队伍。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "山景不代替经历",
        "text": "现代坡面与积雪照片仅作环境参照，不能规定1935年每一天的天气。"
      }
    ],
    "relation": "伤病员 ↔ 担架员；前后部队 → 不同步的行程",
    "observation": "我把一副担架画成几个人之间的关系，而不把模型的姿势当成某位伤员的现场照片。",
    "image": {
      "src": "assets/archive/jiajin-southslope.jpg",
      "caption": "夹金山南坡当代地形资料照片。原上传日期不自动等于拍摄日期，不能据此判断1935年某日积雪。非行记员现场拍摄。",
      "credit": "aisccd · CC BY 3.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:%E5%A4%B9%E9%87%91%E5%B1%B1%E5%8D%97%E5%9D%A1-%E6%B5%81%E6%B5%AA%E7%9A%84%E7%8B%97%E7%8B%97_-_panoramio_-_aisccd_(1).jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
    },
    "imageContext": "主图是现代夹金山环境资料，不是王稼祥或担架员的长征摄影。",
    "evidence": [
      {
        "kind": "地方党史研究与行程记述",
        "title": "这条人物线索来自哪里",
        "text": "王稼祥的经历由地方党史研究文章记录。担架样式、抬担架人员和动作细节可作情境示意，仍需其他材料核对。",
        "url": "https://www.thepaper.cn/newsDetail_forward_12518805",
        "label": "宝兴县委党史研究室朱樊刚 · 夹金山作证"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图是现代夹金山环境资料，不是王稼祥或担架员的长征摄影。",
        "url": "https://commons.wikimedia.org/wiki/File:%E5%A4%B9%E9%87%91%E5%B1%B1%E5%8D%97%E5%9D%A1-%E6%B5%81%E6%B5%AA%E7%9A%84%E7%8B%97%E7%8B%97_-_panoramio_-_aisccd_(1).jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "dawei": {
    "theme": "crossings",
    "subject": "木桥与寺前空地",
    "title": "过完木桥，来到庆祝的人群里",
    "note": "达维的木桥原是河两岸居民往来的通道。6月12日，两支先头部队在达维相遇。随着中央和直属部队陆续抵达，会师庆祝大会在古镇后山寺前的开阔地举行。两处地方分别记住了相逢与庆祝。",
    "boundary": "桥与庆祝地点依据小金县的遗址介绍。图中人物和场景距离为画面示意，现场范围请参照今日旧址导览。",
    "sources": [
      [
        "小金县人民政府 · 达维会师桥",
        "https://www.xiaojin.gov.cn/xjxrmzf/c101898/201909/36b3a51f60b24387a44870c618befceb.shtml"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "先头与策应部队",
        "kind": "历史行动群体",
        "task": "在达维一带相遇",
        "detail": "先头相逢与后续抵达有各自日期，不能合并成一个瞬间。",
        "limit": "不为画面人物指定未经核实的姓名。"
      },
      {
        "id": "role-1",
        "name": "中央机关与后续人员",
        "kind": "历史行进群体",
        "task": "陆续抵达并进入下一段行程",
        "detail": "后续抵达让会师成为一个过程，不只是一幅相拥的画面。",
        "limit": "具体个人站位与相见对白未知。"
      },
      {
        "id": "role-2",
        "name": "桥两岸居民",
        "kind": "匿名地方群体",
        "task": "原有通行生活仍然存在",
        "detail": "木桥先是居民往来设施，后来又成为会师记忆的载体。",
        "limit": "不将现代游客或模型居民当成当年见证者。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "片石与圆木",
        "text": "材料与桥面说明通行结构；具体构件的年代须读保护资料。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "相逢与庆祝分开",
        "text": "桥边相逢、后续抵达与寺前庆祝各有地点和时间。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "别让会师只有一个镜头",
        "text": "公开介绍支持日期与行动关系，未必支持每个人当时的动作。"
      }
    ],
    "relation": "先头相逢 → 后续抵达 → 后来的会师纪念",
    "observation": "我给两个日期各留一行，也给桥原先的日常用途留一个位置。",
    "image": {
      "src": "assets/archive/dawei-bridge.jpg",
      "caption": "达维会师桥的当代资料照片。桥的保护与修缮状态须另核，非1935年会师即时摄影。非行记员现场拍摄。",
      "credit": "aisccd · CC BY 3.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:%E8%BE%BE%E7%BB%B4%E4%BC%9A%E5%B8%88%E6%A1%A5-%E6%B5%81%E6%B5%AA%E7%9A%84%E7%8B%97%E7%8B%97_-_panoramio.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
    },
    "imageContext": "主图是达维桥当代资料照片，非1935年相逢现场影像。",
    "evidence": [
      {
        "kind": "地方遗址介绍",
        "title": "这条人物线索来自哪里",
        "text": "桥与庆祝地点依据小金县的遗址介绍。图中人物和场景距离为画面示意，现场范围请参照今日旧址导览。",
        "url": "https://www.xiaojin.gov.cn/xjxrmzf/c101898/201909/36b3a51f60b24387a44870c618befceb.shtml",
        "label": "小金县人民政府 · 达维会师桥"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图是达维桥当代资料照片，非1935年相逢现场影像。",
        "url": "https://commons.wikimedia.org/wiki/File:%E8%BE%BE%E7%BB%B4%E4%BC%9A%E5%B8%88%E6%A1%A5-%E6%B5%81%E6%B5%AA%E7%9A%84%E7%8B%97%E7%8B%97_-_panoramio.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "lianghekou": {
    "theme": "decisions",
    "subject": "关帝庙与六月决定",
    "title": "会合之后还要坐下来议事",
    "note": "两河口的会址原是一座关帝庙。1935年6月26日，中央政治局扩大会议在这里开会，与会者讨论两支队伍会合后向哪里去。6月28日形成的书面决定写明北上创建川陕甘根据地的方针。",
    "boundary": "会址、会议日期与书面决定可从县政府介绍查到。庙堂情况及发言顺序以分别存留的材料为限。",
    "sources": [
      [
        "小金县人民政府 · 两河口会议会址",
        "https://xiaojin.gov.cn/xjxrmzf/c101898/201909/dafbb36dbd3a4555837af84485bd7db0.shtml"
      ],
      [
        "人民网党史 · 两河口会议专题",
        "https://dangshi.people.com.cn/gb/n1/2016/0923/c406450-28736970.html"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "参加会议者",
        "kind": "历史会议群体",
        "task": "讨论会合之后的方向",
        "detail": "相逢以后仍需要决定行动，会议与后续部署应前后阅读。",
        "limit": "不补写逐句发言与座次。"
      },
      {
        "id": "role-1",
        "name": "文书与联络岗位",
        "kind": "匿名工作角色",
        "task": "让书面方针与队伍发生联系",
        "detail": "文件形成与传达是需要继续核对的工作线索，不自动对应某个模型人物。",
        "limit": "现场记录者与具体传递路径未核名。"
      },
      {
        "id": "role-2",
        "name": "今天的旧址阅读者",
        "kind": "当代观察者",
        "task": "辨认庙院与会址的两层用途",
        "detail": "关帝庙原有使用、会议发生与后来的展示应分开认识。",
        "limit": "当代观察不冒作1935年见闻。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "庙院不是专为会议建造",
        "text": "先辨认建筑原有用途，再读它如何进入会议史。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "相逢之后仍需协调",
        "text": "讨论、形成决定与执行安排是相连而不同的环节。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "文件与陈列各有作用",
        "text": "书面方针可核日期与内容，陈列只能在说明范围内帮助理解空间。"
      }
    ],
    "relation": "会合后的问题 → 会议与文件 → 后续安排",
    "observation": "我不让河流交汇的图形替人作决定，而把地理与会议材料分别放稳。",
    "image": {
      "src": "assets/archive/lianghekou-xiaojin.jpg",
      "caption": "小金县区域实景资料照片，仅作两河口所在县域的景观参照，不指认为会议会址或1935年原状。非行记员现场拍摄。",
      "credit": "jetsun · CC BY-SA 3.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:Xiaojin,_Aba,_Sichuan,_China_-_panoramio_(39).jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"
    },
    "imageContext": "主图仅是小金县区域环境，不是两河口会址认定依据或会议原始影像。",
    "evidence": [
      {
        "kind": "会议文件与地方会址介绍",
        "title": "这条人物线索来自哪里",
        "text": "会址、会议日期与书面决定可从县政府介绍查到。庙堂情况及发言顺序以分别存留的材料为限。",
        "url": "https://xiaojin.gov.cn/xjxrmzf/c101898/201909/dafbb36dbd3a4555837af84485bd7db0.shtml",
        "label": "小金县人民政府 · 两河口会议会址"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图仅是小金县区域环境，不是两河口会址认定依据或会议原始影像。",
        "url": "https://commons.wikimedia.org/wiki/File:Xiaojin,_Aba,_Sichuan,_China_-_panoramio_(39).jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "songpan": {
    "theme": "supplies",
    "subject": "割麦证",
    "title": "粮食为什么要留下凭据",
    "note": "松潘的长征纪念馆收藏了一块长约九十厘米的木板。红军获取青稞，留下木牌作凭证，给后来返回的藏族粮主留出兑取补偿的凭据。木板让吃饭和补给的历史连回种粮人。",
    "boundary": "「割麦证」是展品名称，报道写明所取的是青稞。川主寺的碑园是纪念地，草地行程跨越多个地方。",
    "sources": [
      [
        "国防部 ·《苍茫松潘》及馆藏割麦证",
        "https://www.mod.gov.cn/gfbw/gfjy_index/js_214151/16480515.html"
      ],
      [
        "若尔盖县人民政府 · 长征革命遗址、遗迹",
        "https://www.ruoergai.gov.cn/regxrmzf/c105376/202303/f66ee6ab86f044019bfbc9170a6fe707.shtml"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "种粮者",
        "kind": "匿名地方群体",
        "task": "让补给重新连回粮食来源",
        "detail": "割麦证的叙述提示粮食有主人，不能只作为队伍前进的无名物资。",
        "limit": "具体粮主身份与后续情况需继续查证。"
      },
      {
        "id": "role-1",
        "name": "供给与留据人员",
        "kind": "匿名历史岗位",
        "task": "把取粮与责任记录下来",
        "detail": "凭据将补给与补偿责任相连，但留据不自动证明每次后来都已兑付。",
        "limit": "不补写制作木牌的现场。"
      },
      {
        "id": "role-2",
        "name": "征集与讲解者",
        "kind": "当代保护群体",
        "task": "让一块木板继续被阅读",
        "detail": "展品名称、报道与收藏说明需要并排核对。",
        "limit": "割麦证的名称不能把青稞误写成其他作物。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "一块木板写了什么",
        "text": "先核对名称、尺寸与报道中的作物，再问凭据对应怎样的责任。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "补给也有另一方",
        "text": "将队伍与种粮人一起放进叙述，物资就不再只是数字。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "留据与兑付不是一件事",
        "text": "材料证明的范围要清楚；没有记录时不代写后续补偿结果。"
      }
    ],
    "relation": "种粮者 ↔ 供给留据者 → 后来保存与讲解",
    "observation": "我把粮食背后的人写回笔记，也把一份凭据能够证明的范围保留下来。",
    "image": {
      "src": "assets/archive/hongyuan-2012-cc0.jpg",
      "caption": "红原县草地，2012年资料照片，仅作川西北湿地环境参照，不能据此定位1935年的具体行军点。不是松潘县城照片，非行记员当场拍摄。",
      "credit": "Mantoutou · CC0 1.0 · Commons 960px缩略版本；文件页说明与EXIF月日不一致，故仅标年份",
      "source": "https://commons.wikimedia.org/wiki/File:Hongyuan_Grasland.JPG",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/"
    },
    "imageContext": "主图为红原湿地的区域参照，不是松潘割麦证实物或当年取粮现场。",
    "evidence": [
      {
        "kind": "馆藏报道与地方遗址资料",
        "title": "这条人物线索来自哪里",
        "text": "「割麦证」是展品名称，报道写明所取的是青稞。川主寺的碑园是纪念地，草地行程跨越多个地方。",
        "url": "https://www.mod.gov.cn/gfbw/gfjy_index/js_214151/16480515.html",
        "label": "国防部 ·《苍茫松潘》及馆藏割麦证"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为红原湿地的区域参照，不是松潘割麦证实物或当年取粮现场。",
        "url": "https://commons.wikimedia.org/wiki/File:Hongyuan_Grasland.JPG",
        "label": "查看图像原始出处"
      }
    ]
  },
  "baxi": {
    "theme": "decisions",
    "subject": "班佑寺里的筹粮会议",
    "title": "走出草地之后，先议口粮",
    "note": "若尔盖的遗址资料记载，8月29日，红军在巴西班佑寺召开筹粮会议，议定筹粮时间和分区。当地寺院也见证了随后的北上讨论。从缺粮到再出发，粮食供应和去向都是队伍需要一起商议的事。",
    "boundary": "巴西地区在8月底至9月初召开了多次会议。筹粮和继续北上各有会议记录，会址定位也经过后来的调查。",
    "sources": [
      [
        "若尔盖县人民政府 · 长征革命遗址、遗迹",
        "https://www.ruoergai.gov.cn/regxrmzf/c105376/202303/f66ee6ab86f044019bfbc9170a6fe707.shtml"
      ],
      [
        "阿坝州地方志 · 巴西会议会址确认经过",
        "https://dfzb.abazhou.gov.cn/abzdfsbgs/c104049/201901/9b43d892e7f54ce1a070fba0cd502882.shtml"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "筹粮工作者",
        "kind": "匿名历史岗位",
        "task": "协调缺粮后的供应",
        "detail": "地方遗址资料提供筹粮会议线索，具体分区与后续执行须按各自记载核对。",
        "limit": "不由会议安排推定全部完成情况。"
      },
      {
        "id": "role-1",
        "name": "当地粮主与居民",
        "kind": "未具名地方群体",
        "task": "保留供给涉及的地方生活",
        "detail": "粮食供应与地区生活相连，不能只把当地人放作景观背景。",
        "limit": "具体个人参与方式与姓名未核定。"
      },
      {
        "id": "role-2",
        "name": "会址调查者",
        "kind": "当代研究与保护群体",
        "task": "辨清不同会议和地名",
        "detail": "巴西范围、班佑寺与牙弄相关讨论应分别保留来源。",
        "limit": "不以单篇文章宣布唯一新结论。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "口粮不是抽象的数字",
        "text": "看见筹集、记录和地方生活之间的关系。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "几次会议不压成一次",
        "text": "筹粮与北上等讨论各有时间，不能共享一个未经说明的室内场面。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "地名范围先核清",
        "text": "区域入口不等于已经确认的某一间会场。"
      }
    ],
    "relation": "供应问题 → 筹粮协调；后来调查 → 辨认会址",
    "observation": "我先把会议分开，再讨论房屋；不让地图的一枚点迫使历史只剩一个场面。",
    "image": {
      "src": "assets/archive/baxi-baozuo.jpg",
      "caption": "若尔盖包座地区聚落的当代资料照片，作巴西区域研究的地理对照，不指认为某次会议的会址。非行记员现场拍摄。",
      "credit": "Philippe Semanaz from Paris, France · CC BY-SA 2.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:Baozuo_communities.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
    },
    "imageContext": "主图为包座地区聚落参照，不指认为班佑寺或牙弄会议现场。",
    "evidence": [
      {
        "kind": "地方遗址资料与会址辨析",
        "title": "这条人物线索来自哪里",
        "text": "巴西地区在8月底至9月初召开了多次会议。筹粮和继续北上各有会议记录，会址定位也经过后来的调查。",
        "url": "https://www.ruoergai.gov.cn/regxrmzf/c105376/202303/f66ee6ab86f044019bfbc9170a6fe707.shtml",
        "label": "若尔盖县人民政府 · 长征革命遗址、遗迹"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为包座地区聚落参照，不指认为班佑寺或牙弄会议现场。",
        "url": "https://commons.wikimedia.org/wiki/File:Baozuo_communities.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "lazikou": {
    "theme": "supplies",
    "subject": "杨积庆的粮仓",
    "title": "峡口之前，已经有人开仓",
    "note": "中央红军进入甘南迭部时缺少粮食。甘南卓尼土司杨积庆为红军提供了粮仓补给。今天读腊子口的历史，可以从狭窄的关口往外看，发现峡口前已经发生的地方协助。",
    "boundary": "开仓叙事来自党史专家访谈和后来的报道。本站地景展示峡口，粮仓的具体位置和外观还需地方资料。",
    "sources": [
      [
        "国防部 · 腊子口历史访谈",
        "https://www.mod.gov.cn/gfbw/gfjy_index/js_214151/4887931.html?big=fan"
      ],
      [
        "人民日报海外版 · 甘南地方口述与实地采访",
        "https://paper.people.com.cn/rmrbhwb/page/2019-08/19/02/rmrbhwb2019081902.pdf"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "杨积庆",
        "kind": "具名地方人物，见史料访谈",
        "task": "为红军提供粮食补给的线索",
        "detail": "相关介绍把地方供给与进入甘南的行动联系起来。",
        "limit": "粮仓不等同于本站关隘，具体位置另核。"
      },
      {
        "id": "role-1",
        "name": "供给与运送者",
        "kind": "匿名协作群体",
        "task": "让粮食进入实际行动",
        "detail": "粮食需要筹集和运送，地方协助不能只在叙述末尾一笔带过。",
        "limit": "具体经办者与运送场面没有在此复原。"
      },
      {
        "id": "role-2",
        "name": "夺隘与掩护部队",
        "kind": "历史行动群体",
        "task": "在狭窄地形中争取通路",
        "detail": "关隘行动与此前供应属于相连而不同的任务。",
        "limit": "不为无名参与者补造姓名或对白。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "粮仓与峡口分开看",
        "text": "补给故事发生的范围与隘口地形不同，需要各自的图像和说明。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "到达关口以前的协助",
        "text": "不只看正面冲锋，也看支撑行军的供给与合作。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "采访线索如何使用",
        "text": "访谈可提示事件关系，不能据此补齐粮仓外观和逐次运送清单。"
      }
    ],
    "relation": "地方补给 → 持续行进 → 争取隘口通路",
    "observation": "我从峡口把目光移向补给，却不把别处的粮仓直接搬到桥头。",
    "image": {
      "src": "assets/archive/lazikou-diebu-region.jpg",
      "caption": "迭部县扎尕那山地的区域实景参照，与腊子口是不同地点，不能据此认定关隘、旧桥或战斗路线。非行记员现场拍摄。",
      "credit": "Jonashtand · CC BY-SA 4.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:202609_Zhagana_Scenic_Area_133.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
    },
    "imageContext": "主图为迭部扎尕那区域参照，非腊子口关隘或杨积庆粮仓实景。",
    "evidence": [
      {
        "kind": "党史访谈与地方报道",
        "title": "这条人物线索来自哪里",
        "text": "开仓叙事来自党史专家访谈和后来的报道。本站地景展示峡口，粮仓的具体位置和外观还需地方资料。",
        "url": "https://www.mod.gov.cn/gfbw/gfjy_index/js_214151/4887931.html?big=fan",
        "label": "国防部 · 腊子口历史访谈"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为迭部扎尕那区域参照，非腊子口关隘或杨积庆粮仓实景。",
        "url": "https://commons.wikimedia.org/wiki/File:202609_Zhagana_Scenic_Area_133.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "hadapu": {
    "theme": "print",
    "subject": "邮政代办所",
    "title": "山里小镇怎样收到外省的报",
    "note": "驻镇商人有订阅外省报刊的需求。地方党史考证指出，颜协增利用自家商铺办邮政代办所，经手报刊和信件。红军从哈达铺搜集的多份旧报里读到陕北的消息，邮路和集镇生意也因此进入了长征故事。",
    "boundary": "旧址陈列的报纸有复制件。不同回忆涉及多种报纸，邮政旧址能帮助理解流通，具体每份报纸的来源仍需逐件核对。",
    "sources": [
      [
        "新华社 · 哈达铺邮政代办所旧址采访",
        "https://www3.xinhuanet.com/politics/20261020/a7d4521b2aca4aae818492cba48219df/c.html"
      ],
      [
        "中央党史和文献研究院 · 哈达铺与红军长征相关问题研究",
        "https://www.dswxyjy.org.cn/n1/2025/0402/c427167-40452311.html"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "颜协增",
        "kind": "具名人物，见地方邮政考证",
        "task": "让商铺与邮路相连",
        "detail": "邮政代办所线索帮助理解报刊怎样进入集镇。",
        "limit": "不据一处旧址认定所有报纸均由此取得。"
      },
      {
        "id": "role-1",
        "name": "商人和报刊订户",
        "kind": "匿名地方群体",
        "task": "让外省消息进入日常往来",
        "detail": "商贸与订阅需求提示小镇的信息联系，不只作为偶然得报的背景。",
        "limit": "具体报刊的订阅者仍需逐件核对。"
      },
      {
        "id": "role-2",
        "name": "搜集与阅读报刊者",
        "kind": "历史工作群体",
        "task": "把消息与行动方向联系起来",
        "detail": "多种回忆与研究说明报纸的信息作用，报种与获取细节并非都一致。",
        "limit": "不把一张复制报纸当作已确认的原件。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "旧报与复制报纸",
        "text": "先问原件、复制件和报种，再讨论它提供了什么消息。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "邮路与判断之间",
        "text": "流通带来信息，阅读和判断仍是另一项工作。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "一处旧址不是全部证据",
        "text": "邮政建筑、回忆与报刊研究需要相互核对，不拼凑成无缝现场。"
      }
    ],
    "relation": "订阅与邮路 → 搜集报刊 → 阅读与判断",
    "observation": "我先核对报纸的名称、日期与出处，再去理解消息怎样进入一支队伍的选择。",
    "image": {
      "src": "assets/archive/hadapu-postoffice.jpg",
      "caption": "哈达铺邮局相关建筑当代资料照片，不据此认定关键报纸从此取得，也不视作1935年陈设原状。非行记员现场拍摄。",
      "credit": "N509FZ · CC BY-SA 4.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:Hadapu_Post_Office_(20260202170444).jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
    },
    "imageContext": "主图是邮局相关建筑当代实景，不证明某一份关键报纸恰由此递出。",
    "evidence": [
      {
        "kind": "专题研究与旧址采访",
        "title": "这条人物线索来自哪里",
        "text": "旧址陈列的报纸有复制件。不同回忆涉及多种报纸，邮政旧址能帮助理解流通，具体每份报纸的来源仍需逐件核对。",
        "url": "https://www3.xinhuanet.com/politics/20261020/a7d4521b2aca4aae818492cba48219df/c.html",
        "label": "新华社 · 哈达铺邮政代办所旧址采访"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图是邮局相关建筑当代实景，不证明某一份关键报纸恰由此递出。",
        "url": "https://commons.wikimedia.org/wiki/File:Hadapu_Post_Office_(20260202170444).jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "wuqi": {
    "theme": "supplies",
    "subject": "张宪杰家的水缸",
    "title": "一口水缸为什么叫「红军锅」",
    "note": "吴起村民张宪杰把家里的水缸借给红军煮饭，水缸被火烧裂。后来，他请人修补水缸，1966年将它捐给纪念馆。今天从展柜里还能看到缸身外用来加固的竹条。",
    "boundary": "烧饭和捐赠经过依据馆藏采访，实物照片可见修补痕迹。烧火的灶台和彼时的室内陈设仍待查证。",
    "sources": [
      [
        "光明日报 · 吴起纪念馆「红军锅」实物与采访",
        "https://news.youth.cn/hotnews_41880/202610/t20261029_16938342.htm"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "张宪杰",
        "kind": "具名物主，见馆藏采访",
        "task": "出借水缸并保存修补后的物件",
        "detail": "报道将借物、烧裂、修补和后来捐赠连接起来，应保留不同时间层。",
        "limit": "不补写借缸时的对话与室内场景。"
      },
      {
        "id": "role-1",
        "name": "借物与炊事人员",
        "kind": "匿名历史岗位",
        "task": "让队伍的吃饭与地方生活相接",
        "detail": "炊事用品提醒我们到达后仍有具体生活需要。",
        "limit": "具体使用者姓名和灶台原貌未核定。"
      },
      {
        "id": "role-2",
        "name": "后来征集与保管者",
        "kind": "当代保护工作者",
        "task": "让修补痕迹成为可读信息",
        "detail": "实物、采访与捐赠说明共同提供材料，不仅仅是一个物件名称。",
        "limit": "模型陶罐不是这只馆藏水缸原件。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "水缸为什么进入炊事",
        "text": "原有用途、临时使用与修补留下不同线索。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "借物连接两种生活",
        "text": "物主与使用者之间的关系，使一件器物不再只是营地装饰。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "痕迹需要和说明一起读",
        "text": "竹条和裂痕等报道细节应对照实物照片，不由艺术绘图代为证明。"
      }
    ],
    "relation": "物主出借 → 临时使用与修补 → 后来捐赠保存",
    "observation": "我把物件的使用与保存分成几步，不用一个灶台模型补写全部生活。",
    "image": {
      "src": "assets/archive/wuqi-shaanxi-region.jpg",
      "caption": "陕西区域地貌实拍资料，原文件未确认具体县域，仅供陕北环境类型比读，不指认为吴起镇或其旧址。非行记员现场拍摄。",
      "credit": "w0zny · CC BY-SA 3.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:Shaanxi_landscape_IGP4867.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"
    },
    "imageContext": "主图为陕西区域地貌参考，不是吴起馆藏红军锅或其使用现场照片。",
    "evidence": [
      {
        "kind": "馆藏采访与物件来历记述",
        "title": "这条人物线索来自哪里",
        "text": "烧饭和捐赠经过依据馆藏采访，实物照片可见修补痕迹。烧火的灶台和彼时的室内陈设仍待查证。",
        "url": "https://news.youth.cn/hotnews_41880/202610/t20261029_16938342.htm",
        "label": "光明日报 · 吴起纪念馆「红军锅」实物与采访"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为陕西区域地貌参考，不是吴起馆藏红军锅或其使用现场照片。",
        "url": "https://commons.wikimedia.org/wiki/File:Shaanxi_landscape_IGP4867.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "huining": {
    "theme": "women",
    "subject": "一张席子和几双旧鞋",
    "title": "会师之后，帮冻脚的人穿好鞋",
    "note": "会宁居民王文汉回忆，父母以蒸馍卖饭为生。红军到会宁时，他的母亲拿家中的席子给露宿的战士挡雨，还把旧鞋缝补后给冻伤脚的小战士穿。馆访也记录了当地妇女纺线、织袜、缝衣等劳作。",
    "boundary": "席子和旧鞋的情节来自居民后代的家族口述。物件的确切样式及使用现场仍待核实。",
    "sources": [
      [
        "南粤清风网 · 会宁馆访及王文汉家族口述",
        "https://www.gdjct.gd.gov.cn/zhyw/content/post_211559.html"
      ],
      [
        "会宁县人民政府 · 会师楼",
        "https://www.huining.gov.cn/mlhn/hncsmp/art/2023/art_53e4c1728bcf4052a0cd018ca0aeabf8.html"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "王文汉",
        "kind": "家族口述者",
        "task": "把父母的生活记忆带入采访",
        "detail": "席子和旧鞋的线索来自家族讲述，需要保留代际距离。",
        "limit": "口述不是1936年的即时录音。"
      },
      {
        "id": "role-1",
        "name": "缝补与照料者",
        "kind": "匿名地方妇女群体",
        "task": "用日常用品提供帮助",
        "detail": "纺线、织袜和缝补是有具体劳动的事情，不只是欢迎画面的背景。",
        "limit": "不自造每一位劳动者的姓名和动作。"
      },
      {
        "id": "role-2",
        "name": "露宿与需要鞋袜的战士",
        "kind": "未具名历史群体",
        "task": "让会合之后的生活需要可见",
        "detail": "到达以后仍需要休息、衣物和照料。",
        "limit": "不将后世模型人物直接认作某位口述中的小战士。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "席子与旧鞋",
        "text": "日常物件可以进入历史，具体样式仍需来源支持。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "会师之后还有照料",
        "text": "不只看会合的瞬间，也看休息和穿衣所需的劳动。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "家族记忆的角度",
        "text": "讲述者说明了他如何知道，应当与物证和地方记录并读。"
      }
    ],
    "relation": "地方照料者 → 休息与衣物帮助 → 后代讲述",
    "observation": "我把会师后的生活需要写进这一页，也不让家族口述承担它未曾声称的全景。",
    "image": {
      "src": "assets/archive/huining-gate.jpg",
      "caption": "会宁会师门当代资料照片。建筑历经修缮，照片不能替代1936年会师过程的原始记录。非行记员现场拍摄。",
      "credit": "DarthVachel · CC BY-SA 3.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:%E4%BC%9A%E5%B8%88%E9%97%A8.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"
    },
    "imageContext": "主图为会师门当代实景，不是缝衣、赠鞋或1936年会师现场摄影。",
    "evidence": [
      {
        "kind": "居民家族口述与馆访",
        "title": "这条人物线索来自哪里",
        "text": "席子和旧鞋的情节来自居民后代的家族口述。物件的确切样式及使用现场仍待核实。",
        "url": "https://www.gdjct.gd.gov.cn/zhyw/content/post_211559.html",
        "label": "南粤清风网 · 会宁馆访及王文汉家族口述"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为会师门当代实景，不是缝衣、赠鞋或1936年会师现场摄影。",
        "url": "https://commons.wikimedia.org/wiki/File:%E4%BC%9A%E5%B8%88%E9%97%A8.jpg",
        "label": "查看图像原始出处"
      }
    ]
  },
  "jiangtai": {
    "theme": "supplies",
    "subject": "棕皮盐盒",
    "title": "一只盐盒如何讲述纪律",
    "note": "将台堡相关展陈讲述了一件军民往来中的小事：一名小战士弄坏老乡的瓷碗，拿出随身的棕皮盐盒作补偿。粮食、盐和碗都要跟着人走，这件小物为当时的相处方式留下了线索。",
    "boundary": "盐盒来历来自纪念展讲解员的采访记录。具体人物姓名和当时对话仍待查证。",
    "sources": [
      [
        "中央纪委国家监委 · 将台堡纪念展陈采访",
        "https://www.ccdi.gov.cn/toutiaon/202610/t20261022_518214_m.html"
      ],
      [
        "中央纪委国家监委 · 将台堡三军会师纪念馆基本陈列",
        "https://www.ccdi.gov.cn/bwgsgn/issue9/201810/t20181030_41183.html"
      ]
    ],
    "people": [
      {
        "id": "role-0",
        "name": "瓷碗的物主",
        "kind": "未具名地方人物",
        "task": "物件损坏涉及日常生活",
        "detail": "纪念展讲述从一只碗进入军民往来，而不是只看宏大的会师场面。",
        "limit": "姓名、碗的样式与现场位置未核。"
      },
      {
        "id": "role-1",
        "name": "随身带盐盒的小战士",
        "kind": "未具名叙事人物",
        "task": "以物作补偿的纪律线索",
        "detail": "材料来自纪念展讲解员采访，不能扩写为逐句对话或指定人物生平。",
        "limit": "盐盒的入藏记录与具体来历应另核。"
      },
      {
        "id": "role-2",
        "name": "纪念展讲述者",
        "kind": "当代材料转述者",
        "task": "把一个物件故事交给后来读者",
        "detail": "讲解采访与当年经历之间需要保留材料类型的区别。",
        "limit": "不把讲解内容自动当成第一人称亲历。"
      }
    ],
    "lenses": [
      {
        "id": "material",
        "label": "看物件",
        "title": "盐与碗都属于生活",
        "text": "从随身小物看纪律与相处，不把它们只作展示道具。"
      },
      {
        "id": "cooperation",
        "label": "看协作",
        "title": "补偿关系如何呈现",
        "text": "故事提示物主与战士之间的关系，具体过程仍以材料为限。"
      },
      {
        "id": "record",
        "label": "看记录",
        "title": "讲解、物证与回忆",
        "text": "先辨认所见材料属于哪一类，再决定它能支持怎样的叙述。"
      }
    ],
    "relation": "物件损坏与补偿线索 → 纪念展讲述 → 当代核对",
    "observation": "我愿意把一个小故事认真读下去，也保留它尚需物证与来历说明的部分。",
    "image": {
      "src": "assets/archive/jiangtai-xiji-county.jpg",
      "caption": "宁夏西吉县当代航拍资料，作将台堡所在县域的地理参照，不将县城全景指认为会师旧址。非行记员现场拍摄。",
      "credit": "Windmemories · CC BY-SA 4.0 · Commons缩略资料版本，无另行裁切或调色，沿用原许可",
      "source": "https://commons.wikimedia.org/wiki/File:20240321_Aerial_photo_of_Xiji_County,_Ningxia.jpg",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
    },
    "imageContext": "主图为西吉县域当代航拍，不是将台堡盐盒、瓷碗或会师旧址的直接摄影。",
    "evidence": [
      {
        "kind": "纪念展讲解员采访",
        "title": "这条人物线索来自哪里",
        "text": "盐盒来历来自纪念展讲解员的采访记录。具体人物姓名和当时对话仍待查证。",
        "url": "https://www.ccdi.gov.cn/toutiaon/202610/t20261022_518214_m.html",
        "label": "中央纪委国家监委 · 将台堡纪念展陈采访"
      },
      {
        "kind": "当代资料图像",
        "title": "图像与人物之间的距离",
        "text": "主图为西吉县域当代航拍，不是将台堡盐盒、瓷碗或会师旧址的直接摄影。",
        "url": "https://commons.wikimedia.org/wiki/File:20240321_Aerial_photo_of_Xiji_County,_Ningxia.jpg",
        "label": "查看图像原始出处"
      }
    ]
  }
};
