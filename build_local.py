#!/usr/bin/env python3
"""Build an account-free standalone HTML and a portable ZIP from exact source."""
import base64,hashlib,json,re,zipfile
from pathlib import Path
R=Path(__file__).resolve().parent
OUT=R.parent/'deliverables'
OUT.mkdir(exist_ok=True)
def b64(raw):return base64.b64encode(raw).decode('ascii')
def safe_script(text):return re.sub(r'</script',r'<\/script',text,flags=re.I)
html=(R/'dist/index.html').read_text()
css=(R/'dist/style.css').read_text()
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
icon='data:image/svg+xml;base64,'+b64((R/'dist/mark.svg').read_bytes())
html=html.replace('./mark.svg',icon)
for name in ['engine.js','config.js','mod.js','file-import.js','app.js']:
    html=html.replace(f'<script src="./{name}" defer></script>','')
worker=(R/'dist/vendor/highs.js').read_text()+'\n'+(R/'dist/engine.js').read_text()+'\n'+(R/'dist/worker.js').read_text().split('\n',1)[1]
embedded='\n<script id="embeddedData" type="application/json">'+(R/'dist/data.json').read_text().replace('<','\\u003c')+'</script>'
embedded+='\n<script id="embeddedWasm" type="application/octet-stream">'+b64((R/'dist/vendor/highs.wasm').read_bytes())+'</script>'
embedded+='\n<script id="embeddedWorker" type="application/octet-stream">'+b64(worker.encode())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/engine.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/config.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/mod.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/file-import.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/app.js').read_text())+'</script>'
html=html.replace('</body>',embedded+'\n</body>')
# Validate required runtime assets are embedded, not loaded via file/http fetch.
assert all(f'id="{key}"' in html for key in ['embeddedData','embeddedWasm','embeddedWorker'])
assert not re.search(r'(?:src|href)="\./',html)
private_host=re.compile(rb'https?://[a-z0-9-]+[.][a-z0-9-]+[.]chatgpt[.]site',re.I)
project_id=re.compile(rb'appgprj_[a-z0-9]{10,}',re.I)
assert not private_host.search(html.encode())
assert not project_id.search(html.encode())
standalone=OUT/'SunbreakForge.html';standalone.write_text(html)
readme='''# 曙光配装工房 · 本地版

应用版本：0.3.5

说明更新：2026-10-25

为《怪物猎人崛起：曙光》最终内容版寻找配装：选择武器、填写想要的技能，程序会搜索防具、护石、防具炼化和普通珠子的插法。

本地版内置装备数据和求解引擎，无需登录，计算时无需联网。配装管理器 Mod 用于把结果带入游戏；只在本地模拟配装时，不需要安装该 Mod。

## 1. 打开本地版

1. 解压整个压缩包。
2. 用支持 WebAssembly 和 Web Worker 的现代浏览器打开 `SunbreakForge.html`。
3. 选择武器、添加技能，点击“开始配装”。

单文件入口是 `SunbreakForge.html`。`dist/index.html` 是本地服务器入口，不建议直接双击。

如果浏览器限制直接打开本地文件，可在已安装 Python 3 的电脑上使用启动脚本：

| 系统 | 启动方法 |
| --- | --- |
| Windows | 双击 `start-windows.bat` |
| macOS | 运行 `start-macos.command`，或在终端执行 `python3 start_local.py` |
| Linux | 执行 `sh start-linux.sh` 或 `python3 start_local.py` |

启动后会自动打开浏览器，默认地址为 `http://127.0.0.1:8787/`。端口被占用时会换用其他端口。运行期间保持启动窗口打开，按 `Ctrl+C` 停止。服务只监听本机。

## 2. 怎么配装

1. 在“01 选择武器”中选择武器种类和具体武器。
2. 在“02 目标技能”中添加技能，并设置需要的等级。
3. 在“03 搜索条件”中选择角色性别、防具范围、是否炼化、是否允许删除原生技能。
4. 点击“开始配装”，等待结果；需要时可停止搜索。
5. 查看每件防具的炼化词条、护石、最终技能和逐孔插珠位置。

目标技能是最低要求，允许结果多出技能或等级溢出。“允许删除原生技能”也包括你没有要求的技能，删除后可以返还炼化 cost。

最终技能按显示等级从高到低排列，同等级按技能 ID 升序排列。目标列表中的“排序”按钮需要手动点击；添加技能或修改等级不会自动改变顺序。

未找到结果不代表一定无解，可以延长搜索时限或调整条件。当前返回可行方案，不保证全局最优。

## 3. 分享网页条件：导入条件／复制条件

这两个按钮用于在网页或本地版之间分享武器、目标技能和搜索选项。

- **复制条件**：复制配置 JSON；浏览器不允许复制时，会下载文件。
- **导入条件**：粘贴 JSON、拖入 JSON 文件，或点击选择文件，再点击“应用条件”。
- 原有“导出 JSON”保存网页格式的完整计算结果，也可以交给“导入条件”读取其中的搜索条件。

这些网页格式文件不能直接交给游戏 Mod 加载。分享条件也不包含 Mod 模板。

两个导入弹窗均支持文件拖拽和选择，每次一个 `.json` 文件，最大 2 MB。读取文件只会填入文本，仍需点击按钮应用。

## 4. 把配装导入游戏：需要配装管理器 Mod

本工具对接的是原帖中的 **配装管理器 Mod Ver1.1**：

- 原帖：[《【MHRS】配装管理器MOD（一键配装）》](https://www.caimogu.cc/post/2330778.html)
- 作用：把游戏中的个人组合保存为文件，并从文件加载回游戏，便于保存和分享配装。
- 获取与安装：请前往原帖，按作者说明获取 Mod、安装前置并将文件解压到游戏根目录。本地包不附带该 Mod。

### 第一步：在游戏中导出一份模板

用 Mod 保存一套与目标武器**同类型**的配装，找到对应 JSON。它通常位于：

```text
MonsterHunterRise/reframework/data/EquipmentLoadouts/<武器类型>/
```

例如弓为 `Bow`，太刀为 `LongSword`，双刀为 `DualBlades`。

### 第二步：在工房中导入模板

点击“Mod 导入”，拖入或选择刚才的 JSON，也可以粘贴全文，然后选择：

| 方式 | 会发生什么 |
| --- | --- |
| 模板导入 | 保存模板，并同步武器；保留当前目标技能和搜索选项 |
| 全导入 | 保存模板、同步武器，并把原配装合计后的技能同步为目标技能；保留搜索选项 |

模板用于保留花链、替换技、武器强化、解锁状态和百龙珠等附属配置。模板与最近的搜索条件保存在当前浏览器中；更换浏览器或打开方式后，不会自动同步。

导入模板不会修改已经算出的旧方案。要用刚同步的武器重新配装，请再次点击“开始配装”。

### 第三步：计算并导出 Mod 文件

1. 计算出方案后，点击该方案的“Mod 导出”。
2. 填写希望在 Mod 列表和游戏中显示的配装名称。
3. 点击“保存 JSON”。名称会同步写入 `uiInfo.displayName` 和 `mySetInfo.Name`。
4. 将下载文件放入对应武器类型目录；以网页下载后的提示为准。

文件名沿用 Mod 的自动保存形式：`方案编号_62进制时间戳.json`。填写的显示名称不会替换这个文件名。

### 第四步：回到游戏加载

打开 Mod，点击“刷新列表”，找到配装并加载。

**加载目标是游戏中的第一套个人组合。** 按原作者说明，默认加载可能销毁该组合关联的装备；首次使用请先备份存档，并给第一套个人组合留空。是否启用“保留装备”，请按原帖说明选择。

## 5. 模板会保留哪些内容

当前会保留模板的替换技、花链、猎虫及关联信息、装备锁定标记，以及武器炼化和解锁状态。百龙珠按模板实际装备的记录保留，并同步到装备和配装备份数据。

导出武器仍以所选计算结果为准。同类换武器时，会检查模板已装备的强化条目是否适用、百龙孔是否放得下百龙珠；百龙孔扩张炼化也会计入检查。不满足时会提示更换模板或武器。

防具、护石和普通珠子会按计算结果重新生成，因此模板不是整份原样复制：

| 数据 | 当前处理 |
| --- | --- |
| 防具铠玉强化点数 | 同一件防具保留模板值；换成其他防具时归零 |
| 防具炼化附属状态 | 按新方案重建，炼化计数与类型字段重置 |
| 旧式百龙武器模型、百龙强化及历史记录 | 尚未完整保留，相关字段会重置 |
| 弩枪改装 | 保留装备记录中的值；若模板备份记录不同，目前会统一为装备记录的值 |

## 6. Mod 的选项为什么会影响加载结果

Mod 会在读取 JSON 后执行自己的附加设置：

| 选项 | 作用 |
| --- | --- |
| 保留装备 | 按作者说明控制加载时是否销毁原组合装备，并可能增加装备箱占用 |
| 武器炼化词条解锁 | 在 Ver1.1 创建或补入 RARE 10 武器的对应分支中，额外启用并解锁预设强化项目；不自动选择所有强化词条 |
| 防具强化等级“1级” | 将防具强化点数覆盖为 0 |
| 防具强化等级“满级” | 将防具强化点数覆盖为 99999，由游戏处理对应强化等级 |

不勾选额外武器解锁时，仍会恢复 JSON 已有的强化和解锁状态。防具强化两项均不勾选时，使用 JSON 中的强化点数。

这些加载选项不会改写你手上的原 JSON；重新用 Mod 保存配装时，才会把游戏中的状态导出到文件。

## 7. 配装范围与当前限制

- 资料面向曙光最终内容版；固定武器，只按原生普通孔位进行技能配装。武器炼化、百龙珠和花链用于模板导出保留，不参与技能求解。
- 每件防具最多七条内部炼化词条，cost 总和不超过预算。
- 原生技能种类＋新增技能种类不超过五种；删除技能不释放原生种类名额。
- 同件防具不能同时增加和删除同一技能；删除不得超过原生等级。
- 允许删除未要求的原生技能，按实际词条返还 cost。
- 检查最终状态，不验证防具随机生成顺序或种子可达性。
- 风雷合一的额外加成在全导入时计入目标，但求解模型仍按基础技能搜索，可能偏保守。
- 防御显示不含铠玉强化和保留的武器炼化效果，不是游戏最终面板防御；不计算伤害。
- 当前版本已通过 33 项自动测试，覆盖离线求解、导入导出及模板保留；尚未进行实际游戏内导入验证。

## 8. 致谢与资料来源

感谢[配装管理器 Mod 原帖](https://www.caimogu.cc/post/2330778.html)的作者开发并分享配装保存、加载和分享工具。本工具根据作者公开说明及 Ver1.1 的 JSON 格式制作导入导出适配；网页配装模拟器与该 Mod 是两个独立工具。Mod 的下载、前置、更新、使用要求和发布条件均以原帖为准。

也感谢以下项目和资料作者：

- [MHRice](https://mhrise.mhrice.info/)：游戏数据和解析资料。
- [MH Data Lab](https://mhdatalab.com/rise)：数据交叉核对与炼金规则资料。
- dtlnor：护石与怪异炼化数据整理。
- [HiGHS / highs-js](https://github.com/lovasoa/highs-js)：本地求解引擎，MIT 许可证见 `dist/vendor/LICENSE`。

进一步技术说明见 `docs/technical-notes.md`。
'''
(OUT/'readme.md').write_text(readme)
zip_path=OUT/'sunbreak-forge-local.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.write(standalone,'SunbreakForge/SunbreakForge.html')
    z.writestr('SunbreakForge/readme.md',readme)
    technical_readme=R/'README.md'
    if not technical_readme.is_file():technical_readme=R/'docs/technical-notes.md'
    z.write(technical_readme,'SunbreakForge/docs/technical-notes.md')
    for name in ['start_local.py','start-windows.bat','start-macos.command','start-linux.sh','package.json','build_local.py']:
        z.write(R/name,'SunbreakForge/'+name)
    for p in sorted((R/'dist').rglob('*')):
        if p.is_file():z.write(p,'SunbreakForge/'+p.relative_to(R).as_posix())
    for p in sorted((R/'tests').glob('*')):
        if p.is_file():z.write(p,'SunbreakForge/'+p.relative_to(R).as_posix())
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    for name in z.namelist():
        assert not any(v in name for v in ['.git/','.openai/','debug.lp'])
        raw=z.read(name)
        assert not private_host.search(raw),name
        assert not project_id.search(raw),name
print(json.dumps({'standalone':str(standalone),'html_bytes':standalone.stat().st_size,'zip':str(zip_path),'zip_bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest()},ensure_ascii=False))
