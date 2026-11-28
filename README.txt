山河之路 · 长征探索地图

本项目是 HTML / CSS / JavaScript 静态网站，三维地形与历史场景在浏览器端渲染。
assets/ 中包含网页所需的模型、贴图、影像、音频、数据与前端模块。

本地预览
1. 安装 Python 3.10 或更新版本。
2. Windows 可双击“打开图集.pyw”。
3. 也可在项目目录运行：python -m http.server 8873 --bind 127.0.0.1
4. 打开 http://127.0.0.1:8873/ 。网页需要通过 HTTP 服务访问。

项目目录
index.html                 网站入口
assets/                    全部网站运行资源
tools/                     建模、资源处理、验证、部署与交付工具
output/                    参考图、建模交接与验证记录
.workbuddy/                 完整交付包中附带的部分建模输入；不属于网站发布目录

三维资源编辑
直接浏览网站不需要 Blender。重新生成模型需要 Blender、相应 Python 工具及原始 Tripo 输入。
完整交付包保留了工作区内的相关源输入。部分准备脚本会读取当前用户 Downloads
中的原始 GLB；这些外部文件并非本项目目录内容，重新准备资产时需提供相应文件或修改输入路径。
已有优化资产和正式场景均位于 assets/，可直接使用。

服务器部署
当前服务目录：/opt/shanhe-atlas/
服务单元：shanhe-atlas-web.service
端口：18081
内存上限：400M
虚拟环境：/opt/shanhe-atlas/venv
日志：/opt/shanhe-atlas/logs/app.log，每份最多 2 MiB，保留 3 份备份。
部署实现见 tools/atlas_server.py、tools/shanhe-atlas-web.service 和 tools/ecs_*.py/sh。
SSH 密码由终端隐藏输入，不写入项目或压缩包。
ecs_initialize.sh 和 ecs_install.sh 用于首次部署，包含防止覆盖已有安装的检查。
已有生产系统的目录、端口、服务单元、Python 与网络配置不属于本应用的管理范围。

验证示例
node tools/check_scene_navigation.mjs
python tools/check_scene_people_fixes.py
python tools/test_atlas_server.py
node output/terrain-fixes-20261128/verify-results.mjs

交付包
tools/package_project.py 从本地 Git 提交生成完整 ZIP，并附加工作区中的相关源输入和参考资料。
ZIP 内“交付版本.json”记录提交号、文件数量、附加输入目录和排除范围。
Git 元数据、登录状态、主机信任文件、缓存、临时日志和重复服务器上传包不进入 ZIP。
