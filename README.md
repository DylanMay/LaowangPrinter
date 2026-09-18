# 老王打印机（LaowangPrinter）

激光雕刻机的桌面「打印软件」。用户选图案、选材料、调尺寸、点开始；GRBL、G-code 和串口留在软件内部。

> 让软件理解机器，让用户只需要理解自己想刻什么。

当前仓库处于 MVP 文档与 UI 原型阶段，应用代码按开发计划分 Phase 实现，完成后须停止等待下一指令。

## 文档

| 文档 | 内容 |
| --- | --- |
| [产品文档](docs/PRODUCT.md) | 定位、用户流程、页面、文案、安全、验收 |
| [UI 设计](docs/UI.md) | 视觉规范、三个核心页面、组件与文案 |
| [可点击原型](docs/ui/index.html) | 浏览器打开，走通主流程与异常状态 |
| [技术文档](docs/TECHNICAL.md) | 架构、模块、IPC、GRBL / SVG / G-code、测试 |
| [开发计划](docs/DEVELOPMENT_PLAN.md) | Phase 1–10，每阶段交付与停止条件 |

本地查看原型：

```bash
# 直接用浏览器打开 docs/ui/index.html
# 或
python3 -m http.server 4173 --directory docs/ui
```

## MVP 做什么

把一个 SVG 图案雕刻到材料上（第一版材料：木板）。

普通用户路径：

**图片 → 材料 → 尺寸 → 预览 → 开始**

软件内部路径：

**SVG → Path → 坐标转换 → G-code → GRBL → 串口 → 激光机**

## MVP 不做什么

DXF、灰度图雕刻、相机、AI、云账号、商城、复杂刀路优化。详见产品文档。

## 技术栈（规划）

Electron · React · TypeScript · Vite · serialport · Zustand · Tailwind CSS · Vitest

必须采用 Main / Preload / Renderer 三层，且 `contextIsolation: true`、`nodeIntegration: false`。

## 开发阶段

1. 项目基础架构
2. 串口
3. GRBL
4. 机器控制
5. SVG
6. Canvas
7. G-code
8. Sender
9. 傻瓜化 UX
10. 完整 MVP 验收

每个 Phase 结束后运行 `npm test` 与 `npm run build`，汇报变更与测试结果，然后停止。

## 命令（应用代码落地后）

```bash
npm install
npm run dev
npm test
npm run build
```
