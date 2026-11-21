# 长征图集建模参考图

## 沉浸式序章

现行首页从大渡河谷、于都渡口和遵义会址三幅原创场景图进入历史地景。序章采用低角度日光、夜渡灯影和室内侧光。现场手记沿用淡米纸、炭黑和朱红的印刷语言，分别展示设计图、叙事依据和相关史料。

十九站地表保留独立的高分辨率图像坐标和水陆掩码。先用 `python tools/prepare_cinema_plates.py` 处理城镇地表，再用 Blender 运行 `tools/build_valley_scenes.py`。泸定的桥面观察机位沿模型的垂曲线移动。桥板、铁索、浸水岩层和桥亭均有独立几何，街屋与桥上的行人属于场景推演。

## 行记员与渡口 · 提交版

行记员是虚构的研学引导者。软帽的低帽檐、斜背帆布包和带朱红扣带的随身手记共同构成识别轮廓。旧址、地貌与史料属于历史层，向导仅在选择相应机位时进入场景。封面用人物肖像进入档案，课堂用同一身份引导观察，模型近景用同一组识别点连接两者。

生成参考图采用正面、两侧和背面四个等比例视图。四向轮廓注册后生成封闭网格，Blender 中另外塑造面部、帽冠、耳廓、发辫、曲肘、指节、搭盖、书帖及笔杆。网页复用同一个角色母版，每站保留独立的站位与取景。五处渡口的人物、船身和岸线共用米制，参照与演绎范围记录在 `tools/field-scale.json`。

### 重建次序

1. `node tools/field_blockout.mjs` 生成可在三维软件中检查的米制粗模，分别比较成年人、船身和河段宽度。
2. Blender 后台运行 `tools/build_recorder_master.py` 生成角色母版。注册的基础网格保存在 `tools/recorder-sculpt.npz`，分件造型在 `tools/recorder_head.py` 和 `tools/recorder_parts.py`。
3. Blender 后台运行 `tools/build_valley_scenes.py` 与 `tools/build_valley_overview.py` 生成十九处现场和全图地标。人物动作、渡船和区域房屋分别在 `field_people.py`、`field_waterfronts.py`、`field_dwellings.py` 中编辑。
4. Blender 后台运行 `tools/build_geometry_review.py` 生成船体纵剖、屋盖抬升图和可编辑的构件工程。`output/model-review` 收录白模图、实体母版和审查结果。

## 航拍地景版

首页和各站的实时场景由 `tools/build_valley_scenes.py` 在 Blender 中生成，位于 `assets/models/landscapes/`。艺术地表和树冠原图位于 `assets/valley/`。历史建筑依据仍见同目录的南、北段建模记录。

制作地表时使用正俯视、边到边、无地平线的原创生成图。林地、河滩、石板街、夯土台地和高原湿地按站点取材。泸定远景用宽河谷图，桥畔用近岸图。长桥按 103.67 米跨径和约 3 米桥面建立，两端桥亭及村屋布置作叙事性推演。生成图不作旧址照片或地理测量数据使用。

重建时先运行 `python tools/trace_valley_plates.py` 配准河岸，并将逐栋描绘的屋脊与檐宽转换为建筑轮廓，再用 Blender 的 `--background --python` 分别运行 `tools/build_valley_scenes.py` 和 `tools/build_valley_overview.py`。前者生成分站地貌、植被与建筑网格，后者生成全线地图使用的简化网格。门户、树冠和城镇表面共用纹理；现场默认机位及交互在 `assets/history-view.js`。

以淡米纸、炭黑和少量信号红统一图集。标题用宋体，日期与图号用等宽字。封面模拟木刻的刻线和留纸，分镜用斜视微缩模型交代建筑、行人和地形的比例。以下为内置 ImageGen 生成时使用的完整提示词。

### 城镇与近景

遵义、黎平、巴西、哈达铺、会宁的外围房屋沿各自地表图的屋脊描线建模，院坝与街巷保留通行空间。巴西外围藏式民居采用平顶。遵义主楼的后翼、木构跨院、街面八间铺房及砖砌通道取材于[遵义会议纪念馆的会址介绍](https://news.12371.cn/2015/01/07/ARTI1420596304506715.shtml)，院落尺度、窗玻璃配色和陈设为场景演绎。桥亭近景与回廊近景的默认机位定义在 `assets/history-view.js` 的 `detailViews`。

立面使用青砖、栗色木构、颜色收敛的玻璃和凿面石材。新增纹理来自同一张四格原创材质图，四格分别为裸露片岩、凿面石灰岩、灰色顺砌砖墙和整块磨损阶石，均采用正投影漫射光。泸定扶手铁索设置远近两级网格，近景每圈交替转动并与下一圈相扣。

## south

Blender modeling reference contact sheet. Contemporary museum architectural models, elevated three-quarter view, superb craft and highly legible silhouettes. 1934–1936 China. Light pale beige #F5F1E8 paper, charcoal #30343A screened tones, tiny signal red #C83232 fabric accent only. Exposed paper, clay and carved timber structure, delicate cut stone layers, window mullions, miniature human scale. Separate equal cells, no typography, no grid lines, no labels, no modern buildings or memorials. Show entire diorama in each cell, restrained ground slabs and cast shadows, consistent camera. Reconstruction studies not measured records. EXACTLY 3 columns and 3 rows in reading order. R1 hilltop modest YUNSHISHAN Chinese temple courtyard and stair; YUDU pontoon gangway supported on small wooden skiffs; XIANGJIANG river crossing with low sandbank and traditional ferry. R2 LIPING terraced merchant courtyard on sloping slate street with stepped firewalls; ZUNYI Bai residence two-storey hipped-roof masonry and timber mansion with repeated arcaded verandas; CHISHUI Tucheng hillside river port with shophouses and stone steps. R3 JIAOPING Jinsha canyon shore and open wooden ferries; ANSHUNCHANG Dadu river cobble shoal, traditional wooden ferryboat and ferryman hut; LUDING delicate iron chain footbridge with stone abutments and Chinese tiled-roof bridge pavilions on both sides. Depict each unambiguously.


## north

Blender modeling reference contact sheet. Contemporary museum architectural models, elevated three-quarter view, superb craft and highly legible silhouettes. 1934–1936 China. Light pale beige #F5F1E8 paper, charcoal #30343A screened tones, tiny signal red #C83232 fabric accent only. Exposed paper, clay and carved timber structure, delicate cut stone layers, window mullions, miniature human scale. Separate equal cells, no typography, no grid lines, no labels, no modern buildings or memorials. Show entire diorama in each cell, restrained ground slabs and cast shadows, consistent camera. Reconstruction studies not measured records. EXACTLY 5 columns and 2 rows wide sheet. R1 JIAJIN sharp snow ridge, winding footpath and hikers; DAWEI timber bridge over rocky stream; LIANGHEKOU mountain temple meeting-site timber courtyard, pitched roof; SONGPAN open wetland with hummocks, dark rivulets and walking figures; BAXI modest highland temple gathering place on hillside. R2 LAZIKOU high cliff gate and small timber bridge over rushing gorge; HADAPU narrow market street, old Chinese timber shop and newspapers; WUQI loess hillside with arched cave dwelling and courtyard; HUINING historic walled gate with pavilion; JIANGTAIBAO rammed-earth plateau fortress, low walls and simple entry. Map and figures are illustrative.


## cover

Panoramic 3:2 full bleed museum print of the Luding iron-chain bridge over the Dadu River in Sichuan, historical landscape circa 1935. Ground-level human vantage slightly above one river bank, looking diagonally across a turbulent canyon. Delicate long and striking sagging bridge traverses foreground right towards center left, stone abutments with two low Chinese timber pavilions at either end. Massive shadowed mountain and terraced rock rise behind, jagged strata, little white water cuts; evocative true wood engraving, hand cut ridges, large light paper shapes, sharply cut charcoal drypoint and fine clustered halftone. Deliberate scale hierarchy. TWO print inks: charcoal #30343A in various screen densities on pale-beige paper #F5F1E8, tiny signal red #C83232 on one small cloth on bank. Main bridge in middle half, balanced atmospheric emptiness in upper left; panorama bleeds past image edges. Exhibition catalogue frontispiece, extremely accomplished, clean unaged paper; absolutely no writing, signage, labels or letters. No modern buildings, trucks, towers, weapons or tourists.

