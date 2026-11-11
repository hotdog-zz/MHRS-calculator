# 开发与本地打包

[返回文档目录](README.md)

## 源码位置

| 路径 | 内容 |
| --- | --- |
| `dist/index.html`、`dist/style.css`、`dist/app.js` | 网页入口、样式与交互 |
| `dist/engine.js`、`dist/search-pool.js`、`dist/worker.js` | 配装建模、双 Worker 调度与求解 |
| `dist/resource-templates.js`、`dist/extensions.js`、`dist/extension-ui.js`、`dist/extension-worker.js` | 技能扩展模板、搜索、显示与候选校验 |
| `dist/augment-sim.js`、`dist/augment-ui.js`、`dist/augment-worker.js` | 炼化模拟 |
| `dist/mod.js`、`dist/inventory.js`、`dist/share.js` | 游戏格式适配、库存与分享 |
| `dist/EquipmentLoadoutsManager.lua` | 游戏配装管理与库存扩展 |
| `dist/data.json`、`dist/vendor/` | 游戏数据与内置依赖 |
| `tests/`、`benchmarks/` | 自动检查与已有基准案例 |

## 检查与打包

本地网页使用浏览器计算，不需要构建前端框架或安装服务器依赖。开发检查需要 Node.js；打包脚本使用 Python 3 标准库。

```sh
python3 build_local.py
node --test --test-concurrency=1 tests/*.test.cjs
```

先打包，再运行涉及离线单文件的检查。打包结果默认写入项目同级的 `deliverables/`，包括 `SunbreakForge.html`、`README.md` 和版本化压缩包。

版本号以 `package.json` 为打包命名来源。压缩包去掉版本号中的点，例如 `0.7.1` 对应 `MHRScalculator-071.zip`；包内根目录保持 `MHRScalculator/`。包中保留使用说明、完整 `docs/`、网页文件、本地启动脚本、测试文件及打包工具；仅 `benchmarks/` 不随用户包分发。测试需要的基准输入请从完整源码仓库获取，运行全部检查应使用完整源码。

发布时还需同步网页页脚、条件导出版本及库存方案导出中的版本标识。技能扩展功能旁的“试用”标记独立于应用版本号。

## 已有测试资料

以下目录位于源码仓库，不包含在用户压缩包中。

- `benchmarks/resource-analysis-0.7.1/`：资源骨架案例。
- `benchmarks/socket-pairs-0.7.2/`：双1级孔案例。
- `benchmarks/generic-substitutions-0.7.3/`：通用候选补全案例。
- `benchmarks/resource-templates-0.8.0/`：资源模板案例。

基准目录中的版本名称保留测试当时的记录，不代表当前发布版本，也不保证在不同设备上有相同用时或内存占用。已有测试不是对全部游戏抽选路径的穷举证明。
