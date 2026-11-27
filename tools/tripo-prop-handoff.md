# 泸定近景实物交接

首件建议为川西老式竹编背篓，用于桥头生活场景。它属于场景艺术演绎，不标作某件历史文物的测绘复原。

图生模型使用[背篓参考图](../output/luding-tripo/bamboo-backbasket.png)，文生模型可复制下方描述。

## Tripo Studio 提示词

```text
单独一个20世纪上半叶川西山地行旅使用的老式手工竹编背篓，完整独立实物，直立放置，椭圆形敞口，口沿有一圈厚实卷竹加固，篓身上宽下窄、略向后倾，平整窄底，背面两条粗麻绳肩带自然贴着篓身垂落；深浅不一的旧竹篾交错编织，编织纹理清晰而有真实尺度，局部磨损、烟褐色旧痕和少量竹纤维，整体灰黄棕色、低饱和、粗糙哑光，写实实物扫描质感。篓内为空，内壁同样有竹编纹理，薄壁有合理厚度，轮廓干净。只有背篓，无人物、无场景、无地面、无底座、无文字、无徽标、无悬浮碎片，不要卡通，不要夸张装饰，不要把明暗阴影画死在贴图上。
```

选择单个静态物件，开启纹理和 PBR。若当前页面提供面数和纹理设置，以 1.5–2 万三角面、2K 纹理作为首轮目标。版本名称与可选项以用户当前 Studio 页面为准。这是人工生成与下载交接，不调用付费 API。

下载前转一圈检查：肩带与篓身保持完整，篓内有内壁，底部没有大洞，没有生成地台或背景。若编织孔洞已经糊成一团，优先保留真实的整体轮廓和清楚的编织贴图。

## 文件约定与整理命令

将用户下载的**带贴图 GLB** 原件放到：

```text
.workbuddy/luding-tripo/bamboo-backbasket-source.glb
```

在项目根目录，以单独的 Blender 后台进程运行：

```powershell
& 'C:/Users/李冠桥/WorkBuddy/2026-09-13-13-29-54/blender-setup/blender-5.2.1-windows-x64/blender.exe' --background --factory-startup --python-exit-code 17 --python tools/prepare_tripo_prop.py -- .workbuddy/luding-tripo/bamboo-backbasket-source.glb assets/luding/props/bamboo-backbasket.glb --triangles 18000 --texture-limit 2048 --preview
```

通用调用为 `blender --background --factory-startup --python-exit-code 17 --python tools/prepare_tripo_prop.py -- 原件.glb 成品.glb --preview`。脚本只清空后台进程中的场景，保留原件；默认不覆盖已有输出，明确重做时加 `--force`。

输出为同名 GLB、JSON 报告，以及 `-front.png`、`-back.png`、`-top.png`。预览从最终导出的 GLB 重新导入后渲染。报告包含源文件 SHA-256、前后面数、贴图尺寸、输出大小、轴向与归一尺度。

脚本烘焙导入层级变换、合并多个网格、保留材质和 UV，按三角面数减面。最长水平跨度归一为 **1 米**，原点位于底面中心；Blender 为 Z 向上，GLB 为 Y 向上。可以用 `--yaw 90` 调整朝向。颜色贴图维持 sRGB，法线与粗糙度维持 Non-Color；只缩小超出目标尺寸的贴图。默认内嵌 WebP、质量 90，与现有网页 GLB 流程一致。需要 PNG/JPEG 兼容交接时用 `--image-format AUTO`。

## 放入场景

成品保存为 `assets/luding/props/bamboo-backbasket.glb` 后，按[泸定场景构建说明](luding-standard.md)重新导出模型和静帧。Blender 会将背篓底部对齐东岸桥亭石台，水平宽度设为 52 厘米。在网页选择「回望桥亭」检查背带朝向、落地阴影及与人物的比例。

材质包含 `ludingFinish=true`，避免全场景表面整理时覆盖用户提供的 PBR。`sourceAsset` 和 `sourceSHA256` 保留在 GLB extras；JSON 报告只供制作与追溯，不应作为页面历史来源。

## 验证

```powershell
& 'C:/Users/李冠桥/WorkBuddy/2026-09-13-13-29-54/blender-setup/blender-5.2.1-windows-x64/blender.exe' --background --factory-startup --python-exit-code 17 --python tools/check_tripo_prop.py
```

检查覆盖：父级变换、多网格合并、三角面预算、材质/UV、色彩/法线/粗糙度通道、WebP 内嵌、导出后重导入的尺寸与底心原点、原件哈希以及覆盖保护。测试输出仅位于已忽略的 `.workbuddy/tripo-prop-check/`。
