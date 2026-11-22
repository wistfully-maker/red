# 泸定节点制作与验收

地图保留现代地形。在泸定地标附近达到影像的清晰边界后，继续放大或点“进入历史桥头”会进入独立的米制模型。三个观察机位、步行距离与视线角度存于 `assets/luding/walk.json`，起点在西桥口，终点在东岸平台。

## 场景依据与素材

- 桥长、宽和构件关系取材于[四川景区发展集团](https://www.scjqfzjt.com/industy/project/2.html)和[泸定桥景区](https://www.scldq.cn/tourism/scenic/19.html)。完整铺板用于观察通行结构，人物、桥亭细部、街屋、平台位置和河谷气象属于讲解场景的艺术推演。
- 桥板采用 [Wood Planks](https://polyhaven.com/a/wood_planks)，岸岩采用 [Rock Face 03](https://polyhaven.com/a/rock_face_03)，天空采用 [Kloofendal 48d Partly Cloudy Pure Sky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)。三项均按 [CC0](https://polyhaven.com/license) 使用。自然材质与天空用于表现表面和光照，不作泸定实地照片。
- 两株河岸树的透明底素材为本项目生成，三维交叉面表现枝叶体积，树位跟随地形与岸线。研学照片的日期、作者与授权另见 `assets/journal/ATTRIBUTION.md`。

## 重建

准备好的表面图位于 `assets/luding/surfaces/`。在项目根目录用 Blender 运行下述命令即可重新导出完整 GLB、三张 Cycles 参考图和弱设备静帧。

```sh
blender --background --python-exit-code 17 --python tools/build_valley_scenes.py -- luding --proof
```

调色时才需要运行 `python tools/prepare_luding_surfaces.py`。其原始输入放在 `.workbuddy/luding-scans/`：两种材质各自的 2K JPEG 漫反射、OpenGL 法线、粗糙度图，文件分别取名为 `{材质ID}-Diffuse.jpg`、`{材质ID}-nor_gl.jpg` 和 `{材质ID}-Rough.jpg`，以及 2K 天空文件 `sky.hdr`。内嵌的木纹按梁柱长轴展开，水面颜色与法线独立取样。网页和离线参考直接使用同一几何、材质与机位。

## 对照方式

桌面 1440 × 900、减少动态效果开启，从西桥口、桥中、东岸平台分别截取完整画幅。对照 `output/luding-standard/blender-*.jpg` 与 `web-*.jpg`。核对桥亭轮廓、铁环遮挡、木板走势和水面反光，并在手机尺寸下另外检查视野与阅读面板。Cycles 的间接光照与网页实时阴影、雾和色调映射会产生明暗差异。
