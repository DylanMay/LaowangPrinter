# 老王打印机（LaowangPrinter）

傻瓜式激光雕刻机桌面软件。用户选图案、选材料、调尺寸、点开始；串口、固件和路径指令留在软件内部。

> 让软件理解机器，让用户只需要理解自己想刻什么。

当前版本：**MVP 1.0**（Phase 1–10 已完成）。主路径：图片 → 材料 → 尺寸 → 预览 → 开始。

## 文档

| 文档 | 内容 |
| --- | --- |
| [产品文档](docs/PRODUCT.md) | 定位、用户流程、页面、文案、安全、验收 |
| [UI 设计](docs/UI.md) | 视觉规范、三个核心页面、组件与文案 |
| [可点击原型](docs/ui/index.html) | 浏览器打开，走通主流程与异常状态 |
| [技术文档](docs/TECHNICAL.md) | 架构、模块、IPC、固件 / SVG / 路径生成、测试 |
| [开发计划](docs/DEVELOPMENT_PLAN.md) | Phase 1–10 |
| [MVP 验收](docs/ACCEPTANCE.md) | 产品第 14 节清单对照 |
| [已知问题](docs/KNOWN_ISSUES.md) | 当前限制与未做事项 |

## 安装与开发

需要 Node.js 22+（或当前 LTS）、npm。

```bash
npm install
npm test
npm run lint
npm run typecheck
npm run dev
```

无真实雕刻机时，用模拟设备查看已连接界面（**仅开发**，默认关闭，不会出现在生产主路径）：

```bash
LAOWANG_SERIAL=mock npx electron . --no-sandbox --disable-gpu
```

Linux 无显示服务时需设置 `DISPLAY`。模拟设备会自动连接「我的雕刻机」，工作区域默认 300 × 200 mm。

## 构建

```bash
npm run build
npx electron .
```

产物在 `out/main`、`out/preload`、`out/renderer`。`npm run build` 会先跑 TypeScript 检查。

## Windows / macOS 打包

本仓库尚未接入安装包 CI。`npm run build` 只生成可被 Electron 加载的渲染与主进程文件。

后续建议用 [electron-builder](https://www.electron.build/)：

| 平台 | 建议目标 | 注意 |
| --- | --- | --- |
| Windows | NSIS 安装包 + portable | 需在 Windows 或对应构建机打包 |
| macOS | `.app` / `.dmg` | 未签名时 Gatekeeper 会拦截 |

串口模块 `serialport` 必须按 Electron ABI 重建，例如：

```bash
npx @electron/rebuild -f -w serialport
```

不要把 `LAOWANG_SERIAL=mock` 打进生产包。

## 硬件连接

1. 用雕刻机附带的 USB 线接到电脑。
2. 关掉 LaserGRBL、Candle 等会占用串口的软件。
3. 打开老王打印机，等待「雕刻机已连接」。
4. 失败时点「重新检测」或「连接帮助」。

普通用户不用选接口或通信速率。需要排查时，从「设置」进入高级设置查看。

若软件读不到工作区域，才会出现「设置工作区域」引导。

## 空载测试

第一次建议先空载（工作区默认选项）：

1. 导入 SVG，确认图案在工作区域内。
2. 材料选 3mm 木板、效果选标准。
3. 工作方式保持「空载测试」。
4. 预览路径与预计时间。
5. 开始空载测试。机器会移动，但不会开激光。

## 第一次低功率雕刻

空载成功、并确认工作区安全之后：

1. 放置适合的木板，压平、摆正，人员离开光路。
2. 工作方式改「低功率测试」。
3. 阅读「仍可能产生激光」警告，勾选全部确认项。
4. 点「开始低功率测试」。
5. 成功后再用「正常雕刻」+ 标准效果做正式任务。

低功率测试默认不会自动开始；未单独确认会被软件拒绝。

## MVP 范围

做：把一个 SVG 图案雕刻到材料上（默认 3mm 木板）。

不做：DXF、PNG/JPG、灰度图、相机、AI、云账号、商城。见产品文档第 15 节。

## 技术栈

Electron · React · TypeScript · Vite · Zustand · Tailwind CSS · Vitest

Main / Preload / Renderer 三层隔离：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
