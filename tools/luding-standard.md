# 泸定节点制作与验收

地图保留现代地形。在泸定地标附近达到影像的清晰边界后，继续放大或点“进入历史桥头”会进入独立的米制模型。三个观察机位、步行距离与视线角度存于 `assets/luding/walk.json`，起点在西桥口，终点在东岸平台。

## 场景依据与素材

- 桥长、宽和构件关系取材于[四川景区发展集团](https://www.scjqfzjt.com/industy/project/2.html)和[泸定桥景区](https://www.scldq.cn/tourism/scenic/19.html)。完整铺板用于观察通行结构，人物、桥亭细部、街屋、平台位置和河谷气象属于讲解场景的艺术推演。
- 桥板采用 [Wood Planks](https://polyhaven.com/a/wood_planks)，岸岩采用 [Rock Face 03](https://polyhaven.com/a/rock_face_03)，天空采用 [Kloofendal 48d Partly Cloudy Pure Sky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)。三项均按 [CC0](https://polyhaven.com/license) 使用。自然材质与天空用于表现表面和光照，不作泸定实地照片。
- 两株河岸树的透明底素材为本项目生成，三维交叉面表现枝叶体积，树位跟随地形与岸线。研学照片的日期、作者与授权另见 `assets/journal/ATTRIBUTION.md`。

## 重建

准备好的模型和表面图位于 `assets/luding/props/` 与 `assets/luding/surfaces/`。从项目根目录运行下述命令可导出完整 GLB 和 Cycles 审图。网页回退海报取自对应宽高比下的实时机位。

```sh
blender --background --python-exit-code 17 --python tools/build_valley_scenes.py -- luding --proof
```

调色时才需要运行 `python tools/prepare_luding_surfaces.py`。其原始输入放在 `.workbuddy/luding-scans/`：两种材质各自的 2K JPEG 漫反射、OpenGL 法线、粗糙度图，文件分别取名为 `{材质ID}-Diffuse.jpg`、`{材质ID}-nor_gl.jpg` 和 `{材质ID}-Rough.jpg`，以及 2K 天空文件 `sky.hdr`。内嵌的木纹按梁柱长轴展开，水面颜色与法线独立取样。网页和离线参考直接使用同一几何、材质与机位。

## 母图资产与莎草

桥亭、带侧阶的石台、脚夫、民居、两种岩石、木梁和铁环由用户提供。`tools/luding_keyframe.py` 编排这批模型。脚夫位于东岸，竹背篓沿用上一批实物。桌面入口使用模型内的母图机位，手机采用纵向全桥构图。

`tools/bake_luding_sedge.py` 按观赏草原模型的 UV 烘焙颜色、切线空间法线和粗糙度，并生成外围细叶条带与岸滩细节图。制作将原图替换为橄榄绿叶、枯黄叶鞘和沿叶脉分布的粗糙度。以下命令可从用户原件重制草芯；重复导出时在独立目录中运行，或给第二条命令加 `--force`。

```sh
python tools/bake_luding_sedge.py "观赏草3d模型.glb" .workbuddy/keyframe-grass/sedge-painted.glb
blender --background --factory-startup --python-exit-code 17 --python tools/prepare_tripo_prop.py -- .workbuddy/keyframe-grass/sedge-painted.glb assets/luding/props/kf-sedge.glb --triangles 2400 --texture-limit 1024 --image-quality 90
```

`tools/luding_sedge.py` 为草芯补出外围弯叶，使用地形网格的射线交点定位两岸 15 组草丛。砾石与湿土纹理按米重复，用顶点透明度沿岸滩边缘渐隐。检查 `output/luding-standard/blender-sedge.jpg` 可以辨认草根与砾石的交界。

## 对照方式

`tools/luding_art.py` 负责两座桥亭的叠瓦、桥头错缝石面和链端锚固。近树采用有折面的叶片网格，平台旁树和街屋退离桥亭视廊；远处树群疏密及峡谷肩线是美术推演。`output/luding-standard/blender-gorge.jpg` 为河道上方看全桥的额外审图机位，不改变步行配置。若 `assets/luding/props/bamboo-backbasket.glb` 存在，构建会将其缩放至最长水平跨度 0.52 米（含背带），底面对齐东岸石台 `(56.8,-2.2,10.0)`，转向 0.45 弧度以露出编织表面和右侧背带。在「回望桥亭」机位中检查整件背篓、地面接触阴影和柱脚间距。

桌面 1440 × 900、减少动态效果开启，从西桥口、桥中、东岸平台分别截取完整画幅。对照 `output/luding-standard/blender-*.jpg` 与 `web-*.jpg`。核对桥亭轮廓、铁环遮挡、木板走势和水面反光，并在手机尺寸下另外检查视野与阅读面板。Cycles 的间接光照与网页实时阴影、雾和色调映射会产生明暗差异。
