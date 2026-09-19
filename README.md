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

## 构建（开发运行）

```bash
npm run build
npx electron .
```

产物在 `out/main`、`out/preload`、`out/renderer`。`npm run build` 会先跑 TypeScript 检查。这只是开发用的编译结果，还不是安装包。

## 如何构建 Windows / macOS 安装包

用 [electron-builder](https://www.electron.build/)，配置在仓库根目录的 `electron-builder.yml`。

**必须在目标系统上打包：** Windows 安装包在 Windows 上打，macOS 安装包在 macOS 上打。不要在 Linux 上交叉出正式包（`serialport` 原生模块对平台敏感）。

打包前不要设置 `LAOWANG_SERIAL=mock`。模拟雕刻机只用于开发，不能打进安装包。

先装依赖并编译：

```bash
npm install
npm run rebuild:native
npm run build
```

`rebuild:native` 会按当前 Electron 版本重建 `serialport`。配置里已经把 `serialport` / `@serialport` 从 asar 里拆出来，避免运行时找不到 `.node`。

### Windows（在 Windows 上执行）

需要：

- Windows 10/11 x64
- Node.js 22+ 与 npm
- 首次打包如提示缺编译工具，安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，勾选「使用 C++ 的桌面开发」

```bash
git clone <本仓库>
cd LaowangPrinter
npm install
npm run dist:win
```

`dist:win` = `npm run build` + `electron-builder --win --x64`。

完成后看 `release/`：

| 文件 | 用途 |
| --- | --- |
| `LaowangPrinter-0.1.0-win-x64-setup.exe` | NSIS 安装包，可改安装目录 |
| `LaowangPrinter-0.1.0-win-x64-portable.exe` | 绿色版，不解压安装 |

安装包默认会建桌面快捷方式「老王打印机」。未签名时 Windows SmartScreen 可能提示「未知发布者」，选「仍要运行」即可。

### macOS（在 Mac 上执行）

需要：

- macOS（建议 13+）
- Node.js 22+ 与 npm
- Xcode Command Line Tools：`xcode-select --install`

```bash
git clone <本仓库>
cd LaowangPrinter
npm install
npm run dist:mac
```

`dist:mac` = `npm run build` + `electron-builder --mac`，打 **universal**（Intel + Apple Silicon）的 `.dmg` 和 `.zip`。

完成后看 `release/`：

| 文件 | 用途 |
| --- | --- |
| `LaowangPrinter-0.1.0-mac-universal.dmg` | 拖入「应用程序」的安装镜像 |
| `LaowangPrinter-0.1.0-mac-universal.zip` | 压缩的 `.app` |

未签名、未公证时，第一次打开会被 Gatekeeper 拦住。用户可在「系统设置 → 隐私与安全性」里允许，或在终端执行：

```bash
xattr -cr /Applications/老王打印机.app
```

要上架或免拦截，需要 Apple Developer 证书，在打包机上配置后再加签名 / 公证。本仓库默认 `forceCodeSigning: false`，方便本机先打出能用的包。

### 只编译、不打安装包

已经 `npm run build` 之后，也可以分步：

```bash
npx electron-builder --win --x64 --config electron-builder.yml
npx electron-builder --mac --config electron-builder.yml
```

### 打包时注意

- 产物目录是 `release/`，已在 `.gitignore` 里。
- `serialport` 必须是 `dependencies`（已经是），不能只放在 `devDependencies`，否则安装包里没有串口模块。
- 若真机连不上，先确认打的是对应系统的包，再在本机重跑 `npm run rebuild:native` 后重新 `dist:win` / `dist:mac`。
- 安装包体积会包含 Electron 运行时，大约几百 MB，属正常。

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
