# 全景微缩地标

生成：`node tools/build_overview_models.mjs`。总模型 `assets/models/overview-landmarks.glb`，471,724 bytes，9 组地标、每组 1 个网格 / 1 个绘制调用。顶点色、索引复用、EXT_meshopt_compression；无外部纹理请求。`build_scene_models.mjs` 也会调用此入口。

设计依据本轮南、北段参考图的灰瓦、灰白石墙、木色、水面、雪脊与少量朱红色。全景模型为放大示意；地理坐标仍来自原站点数据，不表示实测尺寸，也不替代站点详情中的历史模型。

地标：于都浮桥、湘江渡船、遵义会址、皎平渡峡江、泸定铁索桥、夹金山雪脊、松潘草地、吴起窑洞、会宁会师楼。

主要造型依据：

- 于都：渔船与木板搭建的浮桥；不加现代栏杆。国防部，[走进江西省于都县](https://www.mod.gov.cn/gfbw/gfjy_index/16476460.html)；中国军网，[红军夜渡于都河](https://www.81.mil.cn/yljnt_208627/lsda_208656/16438861.html)。
- 湘江：渡船、卵石岸与渡河环境示意，避免把现代纪念设施当作 1934 年战场。人民网，[湘江战役](https://dangshi.people.com.cn/n1/2021/0604/c436975-32122510.html)。
- 遵义：灰砖青瓦、两层楼、前廊。天津市纪委监委，[遵义会议会址](https://www.tjjw.gov.cn/points/2021/06/23/detail_2021062344598.html)；人民网，[遵义会议会址确认记](https://cpc.people.com.cn/n1/2021/0129/c435238-32016040.html)。
- 泸定：9 根底索与左右各 2 根扶手索，桥头亭、部分桥板缺失。中央纪委国家监委，[红军强夺泸定桥时桥上的铁索链](https://v.ccdi.gov.cn/2022/03/07/VIDEaVys7iPfnr63s3GD8gqa220307.shtml)；国防部，[铁索链上刻着勇往直前](https://www.mod.gov.cn/gfbw/gfjy_index/zyhd/4847926.html)。
- 夹金山：角状雪脊、岩壁、蜿蜒垭口。四姑娘山地质公园，[夹金山](https://www.sgnsgeopark.cn/conservation/databases/581-2022-01-01-12-00-34)。
- 会宁：西津门拱门、砖墙、上下两层重檐歇山顶。会宁县人民政府，[会师楼](https://www.huining.gov.cn/mlhn/hncsmp/art/2023/art_53e4c1728bcf4052a0cd018ca0aeabf8.html)。
- 皎平渡、松潘、吴起采用本轮参考图的峡江木船、湿地草甸、黄土窑洞轮廓，环境与人物为示意。

可见性：`assets/overview-landmarks.js` 保持地理锚点，按屏幕投影距离抑制相邻模型相互覆盖，桌面约 90–108 像素、手机约 49–59 像素。全线初始视野可见 8 处；夹金山因紧邻泸定会收起，在更近区域总览出现（已验证 distance=660 同时可见泸定、草地、夹金山）。拉入真实站点近景时全景地标退出。

验证截图在 `output/playwright/`：`overview-desktop-final.png`、`overview-phone-final.png`、`overview-snow-reveal.png`。桌面 1440×960、手机 390×844；手机文档横向溢出为 0，8 个地标标签互不相交，全景总绘制调用 12。
