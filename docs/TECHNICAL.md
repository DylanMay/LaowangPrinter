# 老王打印机（LaowangPrinter）技术文档

版本：MVP 1.0  
文档类型：架构与实现规范  
状态：待开发

本文描述第一版 MVP 的技术边界。实现时以本文与 [开发计划](./DEVELOPMENT_PLAN.md) 为准；产品行为以 [产品文档](./PRODUCT.md) 为准。

---

## 1. 技术目标

第一版不是追求功能最多，而是追求「第一次成功」。

优先级：

**可靠性 > 易用性 > 功能数量 > 高级性能**

内部链路必须打通：

```
SVG → SvgParser → Path[]
    → CoordinateTransformer
    → GCodeGenerator
    → GrblSender
    → SerialPort
    → GRBL
    → 激光雕刻机
```

普通用户界面只暴露：

```
图片 → 材料 → 尺寸 → 预览 → 开始
```

---

## 2. 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面壳 | Electron |
| UI | React + TypeScript |
| 构建 | Vite |
| 运行时 | Node.js（仅 Main） |
| 串口 | serialport |
| 状态 | Zustand |
| 样式 | Tailwind CSS |
| 测试 | Vitest |
| 质量 | ESLint + Prettier |

如果后续仓库中已有稳定技术栈，优先保持，不要为所谓最佳实践大规模重构。

---

## 3. Electron 架构

必须严格采用三层：

```
┌─────────────────────────────────────┐
│ Renderer                            │
│ UI / Canvas / 用户交互              │
│ 禁止：Node.js / fs / serialport     │
└──────────────▲──────────────────────┘
               │ contextBridge
┌──────────────┴──────────────────────┐
│ Preload                             │
│ 暴露最小 API：app / device /        │
│ machine / job / file                │
│ 禁止：暴露 ipcRenderer 全文         │
└──────────────▲──────────────────────┘
               │ IPC
┌──────────────┴──────────────────────┐
│ Main                                │
│ serialport / 文件 / GRBL / G-code / │
│ Sender / Machine / IPC / 错误处理   │
└─────────────────────────────────────┘
```

### 3.1 安全配置（必须）

```ts
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true, // 优先开启
  preload: pathToPreload,
}
```

Renderer 不允许：`require()`、`fs`、`serialport`、`process`、`child_process`。

不要把整个 Electron API 暴露给 Renderer。

### 3.2 职责边界

| 层 | 允许 | 禁止 |
| --- | --- | --- |
| Renderer | UI、Canvas、SVG 预览、参数输入、材料选择、任务展示、用户交互 | Node.js、fs、serialport、child_process、直接算 Y 翻转后发给机器 |
| Preload | `contextBridge` 暴露最小 API | 暴露 `ipcRenderer`、暴露完整 Electron API |
| Main | 串口、文件读取、GRBL、G-code 发送、机器管理、IPC、错误处理 | 把业务状态机散落到 React |

G-code Generator 不允许依赖 React、Electron、DOM。  
SVG Parser 不允许和 UI 混在一起。  
G-code Generator 不允许和 Canvas 混在一起。  
GRBL 细节不允许污染普通用户 UI。

---

## 4. 推荐项目结构

```
src/
├── main/
│   ├── index.ts
│   ├── serial/
│   │   ├── SerialManager.ts
│   │   ├── SerialPortWrapper.ts
│   │   └── types.ts
│   ├── grbl/
│   │   ├── GrblController.ts
│   │   ├── GrblParser.ts
│   │   ├── GrblSender.ts
│   │   └── types.ts
│   ├── machine/
│   │   ├── MachineManager.ts
│   │   ├── MachineConfig.ts
│   │   └── SafetyChecker.ts
│   ├── gcode/
│   │   ├── GCodeGenerator.ts
│   │   └── GCodeEstimator.ts
│   └── ipc/
│       └── handlers.ts
├── preload/
│   └── index.ts
├── renderer/
│   ├── App.tsx
│   ├── components/
│   │   ├── DeviceStatus.tsx
│   │   ├── Workspace.tsx
│   │   ├── MaterialSelector.tsx
│   │   ├── PropertyPanel.tsx
│   │   ├── JobControl.tsx
│   │   └── SafetyDialog.tsx
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── WorkspacePage.tsx
│   │   └── JobPage.tsx
│   ├── canvas/
│   │   ├── CanvasRenderer.ts
│   │   ├── CoordinateSystem.ts
│   │   └── Viewport.ts
│   ├── store/
│   │   └── appStore.ts
│   └── types/
├── shared/                 # 纯 TS，Main / Renderer / 测试共用
│   ├── svg/
│   │   ├── SvgParser.ts
│   │   ├── SvgUnitConverter.ts
│   │   └── bezier.ts
│   ├── geometry/
│   │   └── CoordinateTransformer.ts
│   ├── gcode/
│   │   └── GCodeGenerator.ts   # 也可放此处以便单测
│   ├── materials/
│   │   └── MaterialPreset.ts
│   ├── errors/
│   │   └── userFacingErrors.ts
│   └── types/
└── test/
    ├── mocks/
    │   ├── MockSerialPort.ts
    │   └── MockGRBL.ts
    └── ...
```

可根据实际情况调整，但必须保持职责清晰。核心算法模块优先放在 `shared/`，保证脱离 Electron 和真实硬件可测。

---

## 5. 状态机

禁止用大量互相冲突的 boolean（`isConnected` + `isRunning` + `isPaused` + `isError`）。  
优先使用明确状态枚举。

### 5.1 Device

```ts
type DeviceState =
  | 'disconnected'
  | 'detecting'
  | 'connecting'
  | 'connected'
  | 'error';
```

USB 拔出：立即停止发送，`Job = error`，`Device = disconnected`，通知用户。

### 5.2 Machine

```ts
type MachineState =
  | 'unknown'
  | 'idle'
  | 'running'
  | 'paused'
  | 'alarm'
  | 'homing'
  | 'disconnected';
```

由 GRBL 状态报告映射而来（见第 9 节）。普通用户文案见产品文档。

### 5.3 Job / Sender

```ts
type JobState =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'completed';

type SenderState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'completed';
```

Job 是产品层任务；Sender 是发送层实现。Job 状态由 Sender、设备、安全检查共同驱动，不要在 React 里另维护一套冲突状态。

---

## 6. IPC API

所有 API 通过 preload 的 `contextBridge` 暴露。命名建议：

```ts
window.app
window.device
window.machine
window.job
window.file
```

### 6.1 调用

```ts
device.list(): Promise<DeviceInfo[]>
device.connect(id?: string): Promise<void>
device.disconnect(): Promise<void>
device.getStatus(): Promise<DeviceStatus>

machine.home(): Promise<void>
machine.jog(params: JogParams): Promise<void>
machine.pause(): Promise<void>
machine.resume(): Promise<void>
machine.stop(): Promise<void>
machine.reset(): Promise<void>
machine.getConfig(): Promise<MachineConfig>

job.start(options: JobStartOptions): Promise<void>
job.pause(): Promise<void>
job.resume(): Promise<void>
job.stop(): Promise<void>
job.getProgress(): Promise<JobProgress>

file.openSvg(): Promise<OpenSvgResult | null>
file.readSvg(filePath: string): Promise<string>
file.saveGcode(): Promise<void>
```

`JogParams` 示例：

```ts
{
  axis: 'X' | 'Y',
  distanceMm: 1 | 10 | 100,
  feed: 100 | 500 | 1000 | 3000
}
```

内部发送：`$J=G91 G21 X10 F1000`

### 6.2 事件（Main → Renderer）

```ts
device:connected
device:disconnected
device:error

machine:status
machine:position

job:progress
job:paused
job:completed
job:error
```

Renderer 只订阅这些事件更新 UI，不直接解析串口原始数据。

---

## 7. 串口层

### 7.1 SerialManager

```ts
listPorts()
connect(path: string, baudRate?: number)
disconnect()
write(data: string | Buffer)
onData(handler)
onError(handler)
onClose(handler)
```

默认波特率：`115200`  
支持：`9600`、`19200`、`38400`、`57600`、`115200`、`250000`

普通用户默认不需要修改波特率。自动发现时按候选端口尝试检测 GRBL。

### 7.2 自动发现策略（MVP）

1. 列出串口
2. 过滤明显无关设备（可按厂商 ID / 路径启发式）
3. 尝试打开并等待 GRBL 欢迎信息或发送探测命令
4. 成功则连接并读取配置
5. 失败则对用户显示「没有检测到雕刻机」

不要把探测过程中的原始日志作为主 UI。

### 7.3 Mock

必须实现 `MockSerialPort`，使 SerialManager 可在无硬件环境下测试连接、断开、写入、错误、关闭。

---

## 8. GRBL Parser

独立模块 `GrblParser`。输入原始行，输出结构化对象。不依赖 Electron / React。

### 8.1 设置行

输入：`$30=1000`

输出：

```ts
{ key: '$30', value: 1000 }
```

### 8.2 状态报告

输入：`<Idle|MPos:0.000,0.000,0.000|FS:0,0>`

输出：

```ts
{
  state: 'Idle',
  position: { x: 0, y: 0, z: 0 },
  feed: 0,
  spindle: 0
}
```

支持状态：

`Idle` `Run` `Hold` `Jog` `Alarm` `Door` `Check` `Home` `Sleep`

### 8.3 应答

- `ok`
- `error:N`
- `ALARM:N`
- 版本欢迎信息（如 `Grbl 1.1h ['$' for help]`）

用户可见错误必须经 `userFacingErrors` 转换。高级设置可显示原始 `GRBL error:20`。

### 8.4 状态查询

通过 `?` 查询状态。默认间隔 **250ms**。

状态 polling **不得阻塞** G-code Sender。实时命令（`?`、`!`、`~`、`0x18`）走独立通道，不进入行发送队列。

---

## 9. GRBL 控制与配置

### 9.1 MachineConfig

连接成功后自动读取并保存：

- `$$`
- `$G`
- `$30` 最大功率
- `$31`
- `$32` Laser Mode
- GRBL version
- 机器尺寸
- 最大功率
- Laser Mode

```ts
type MachineConfig = {
  widthMm: number
  heightMm: number
  maxPower: number
  laserMode: boolean
  grblVersion: string
  firmware: string
}
```

无法自动获得机器尺寸时，才进入设置引导。

### 9.2 实时命令

| 用户操作 | 内部命令 | 用户文案 |
| --- | --- | --- |
| 暂停 | `!` | 雕刻已暂停 |
| 继续 | `~` | （继续雕刻） |
| 停止 | 先确认，停止发送；不要偷偷 Reset | 确定停止当前雕刻吗？ |
| 重置（高级） | `0x18`（Ctrl-X） | 正在重置雕刻机 |
| 回到原点 | `$H` | 正在寻找机器原点... |
| Jog | `$J=G91 G21 X10 F1000` | 机器控制 |

停止后需要重新开始任务。不要自动偷偷 Reset。

### 9.3 错误映射示例

| GRBL | 普通用户 | 高级设置 |
| --- | --- | --- |
| `error:20` | 雕刻机无法执行当前动作。可能是图案或机器设置存在问题。 | GRBL error:20 |
| Alarm | 雕刻机处于异常状态。请检查机器，然后重新归零。 | ALARM:N + 原始状态 |
| 串口占用 | 无法连接雕刻机。可能有其他软件正在使用这台设备。 | Access denied / 端口占用 |
| USB 拔出 | 雕刻机连接已断开。请检查 USB 连接。 | 端口关闭 / disconnected |

必须实现 `MockGRBL`，覆盖 status / ok / error / alarm。

---

## 10. G-code Sender

这是核心模块。绝对不能 `serial.write(allGcode)`。

### 10.1 MVP 发送策略

**逐行发送，等待 `ok`。**

```
发送 G0 X10 Y10  → 等待 ok
发送 M3 S200     → 等待 ok
发送 G1 X20 Y10 F1000 → 等待 ok
...
发送 M5          → 等待 ok
```

GRBL 有接收缓冲。第一版不要为了速度实现复杂 buffer planner。优先：稳定、可调试、不丢行、不重复执行。

### 10.2 API

```ts
start()
pause()
resume()
stop()
reset()
getProgress()
getCurrentLine()
```

进度对普通用户显示百分比与预计剩余时间；高级设置可显示当前行 `125 / 523` 与当前 G-code。

### 10.3 USB 断开

雕刻过程中 USB 被拔掉：

1. 立即停止发送
2. `Job = error`
3. `Device = disconnected`
4. 通知用户「雕刻机连接已断开」
5. 不要继续发送数据

### 10.4 空载测试

空载测试允许 XY 正常移动，禁止真正开启激光。

所有 `M3 Sxxx` 必须被安全处理，例如转换为 `M5`。  
该转换发生在 Sender 或 Job 启动前的安全层，且必须可测试。

低功率测试仍可能产生激光，必须用户明确确认，默认不自动执行。

---

## 11. SVG 架构

### 11.1 流水线

```
SVG DOM / 文本
  → SvgParser
  → Path[]
  → CoordinateTransformer
  → GCodeGenerator
```

**禁止** G-code Generator 直接处理 SVG DOM。  
**禁止** 在 React、Canvas、G-code generator 中分别处理 Y 翻转。

### 11.2 支持范围

元素：`line` `polyline` `polygon` `rect` `circle` `ellipse` `path`

Path 命令至少：`M` `L` `H` `V` `C` `Z`

### 11.3 单位：SvgUnitConverter

支持：`px` `mm` `cm` `in`  
支持：`width` `height` `viewBox`

单位转换必须独立模块。默认处理 SVG 常见单位。

### 11.4 内部数据结构

```ts
type Point = { x: number; y: number }

type Path = { points: Point[] }

type Document = {
  widthMm: number
  heightMm: number
  paths: Path[]
}
```

坐标在 Document 内使用 SVG 空间（左上原点，单位 mm）。机器空间转换只发生在 `CoordinateTransformer`。

### 11.5 Bezier

`C` 命令离散成线段。采样数量根据曲线长度和误差动态计算，不要固定 5 个点。MVP 可采用简单可靠方案，例如 20～50 个采样点，或按弧长 / 平坦度自适应。

### 11.6 导入后处理

1. 解析
2. 转换单位
3. 计算尺寸
4. 自动缩放（必要时适应工作区）
5. 自动居中
6. 显示在工作区域

---

## 12. 坐标系统

独立模块：`CoordinateTransformer`。

| 空间 | 原点 | 用途 |
| --- | --- | --- |
| SVG | 左上角 | 解析结果 |
| Workspace | 以工作区域为基准 | Canvas 预览、用户拖拽缩放 |
| Machine | 工作区域左下角为默认雕刻原点 | G-code |

流水线：

```
SVG 坐标 → Workspace 坐标 → Machine 坐标
```

所有 Y 翻转、缩放、平移、居中集中在 `CoordinateTransformer`。Canvas 只消费 Workspace 坐标；G-code 只消费 Machine 坐标。

用户调整（拖动、缩放、改宽高、锁定比例、居中、适应工作区）只改 Workspace 变换，再经 Transformer 得到机器坐标与 bounds。

---

## 13. G-code 架构

### 13.1 GCodeGenerator

纯函数模块，不依赖 React / Electron / DOM。

输入：

- `Path[]`（已是机器坐标，或接收 Path + transform + MachineConfig）
- `MachineConfig`
- `MaterialPreset`（及效果档位）

输出：

```ts
type GCodeDocument = {
  lines: string[]
  estimatedTime: number
  bounds: Bounds
}
```

### 13.2 生成内容

```
G21
G90
G0 X... Y...
M3 S...
G1 X... Y... F...
...
M5
```

只使用：`G21` `G90` `G0` `G1` `M3` `M5` `S` `F`

### 13.3 功率转换

不要硬编码 `S1000`。

```
S = maxPower * powerPercent / 100
```

例：`$30 = 1000`，用户选 20% → `S = 200`  
例：`$30 = 255`，20% → `S = 51`

空载测试时不得发出有效的 `M3 Sxxx` 开光。

### 13.4 时间估计

`GCodeEstimator` 根据路径长度与进给速度估算秒数，供预览与任务 UI 使用。允许简化模型（直线长度 / F），MVP 不要求运动学级精度。

---

## 14. 材料参数

```ts
type MaterialPreset = {
  material: 'wood' | 'bamboo' | 'cardboard' | 'leather' | 'acrylic'
  thickness: number
  light: { speed: number; power: number }
  standard: { speed: number; power: number }
  deep: { speed: number; power: number }
}
```

示例（木板 3mm）：

```ts
{
  material: 'wood',
  thickness: 3,
  light: { speed: 1500, power: 15 },
  standard: { speed: 1000, power: 20 },
  deep: { speed: 600, power: 30 }
}
```

`power` 为百分比；`speed` 为进给（mm/min）。这些只是默认建议。UI 必须声明实际效果因机器、激光功率和材料而异。

第一版必须落地木板；其他材料可预留结构和占位参数。

---

## 15. SafetyChecker

在用户点击「开始雕刻」之后、发送任何 `M3` 之前运行。

检查项：

1. 设备已连接
2. GRBL 状态正常
3. 图案存在
4. 图案没有超出工作区域
5. G-code 存在
6. 材料已选择
7. 参数有效
8. 当前不是 Alarm 状态
9. 机器处于可执行状态

任一项失败：阻止开始，给出中文原因。图案过大时提供「自动缩小」。

默认禁止自动开激光的场景见产品文档第 11 节。

---

## 16. Canvas / 预览

Renderer 内：

- `CanvasRenderer`：绘制工作区、图案、超出部分高亮、预览运动点
- `CoordinateSystem`：仅用于显示网格 / 尺寸标注（不要再做一套 Y 翻转）
- `Viewport`：缩放平移视口（MVP 可简化）

预览模式：用一个小圆沿路径模拟激光头移动。预览不得向机器发送运动或开光指令。

超出工作区域时立即视觉提示，并禁用开始或在最终检查拦截。

---

## 17. 错误处理架构

Main 捕获原始错误 → 映射为稳定的 `AppError` 码 → Renderer 只渲染中文文案。

```ts
type AppError = {
  code:
    | 'DEVICE_DISCONNECTED'
    | 'PORT_BUSY'
    | 'GRBL_ALARM'
    | 'GRBL_ERROR'
    | 'OUT_OF_BOUNDS'
    | 'PATTERN_TOO_LARGE'
    | 'EMPTY_JOB'
    | 'UNKNOWN'
  userMessage: string
  hint?: string
  technicalDetail?: string // 仅高级设置
}
```

普通 UI 永不展示 `TypeError`、`SerialPortError`、`ENOENT`、`error:20`、`Access denied`。

---

## 18. 测试架构

所有核心模块必须可以脱离真实硬件测试。

### 18.1 Mock

- `MockSerialPort`
- `MockGRBL`

### 18.2 必须单测的模块

- SerialManager
- GrblParser
- GrblSender
- SvgParser
- SvgUnitConverter
- CoordinateTransformer
- GCodeGenerator
- SafetyChecker

### 18.3 最低用例

**SVG**

- rect / circle / line / path / bezier / unit conversion

**Coordinate**

- Y axis / scaling / centering / bounds

**G-code**

- G21 / G90 / M3 / M5 / S / F
- 功率按 `$30` 换算
- 空载测试不发出开光 M3

**GRBL**

- status / ok / error / alarm

**Sender**

- start / pause / resume / stop / complete / error
- USB 断开中止发送

**Safety**

- out of bounds / disconnected / alarm / empty G-code

每个 Phase 结束后必须执行：

```bash
npm test
npm run build
```

并检查 TypeScript、ESLint、Electron security、IPC。

---

## 19. 构建与打包

开发与验收：

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run build` 产出 `out/`，用 `npx electron .` 加载。

Windows / macOS 安装包用 `electron-builder.yml`：

```bash
npm run dist:win   # 在 Windows 上：NSIS + portable
npm run dist:mac   # 在 macOS 上：universal dmg + zip
```

`serialport` 会 `npmRebuild`，并 `asarUnpack`。不要设置 `LAOWANG_SERIAL=mock`。步骤详见 [README](../README.md)。

实机测试、空载测试、第一次低功率雕刻见 [README](../README.md) 与 [验收对照](./ACCEPTANCE.md)。

---

## 20. 开发约束（强制）

不要：

- 为了「未来扩展」而过度设计
- 一次生成几千行代码
- 把所有业务逻辑放进 React
- 让 Renderer 直接操作串口
- 把 SVG parser 和 UI 混在一起
- 把 G-code generator 和 Canvas 混在一起
- 让 GRBL 细节污染普通用户 UI
- 在 MVP 自行增加 PNG/JPG、灰度雕刻、DXF、相机、AI、云账号等

始终记住：

> 让软件理解机器，让用户只需要理解自己想刻什么。
