# 老王打印机（LaowangPrinter）开发计划

版本：MVP 1.0  
文档类型：分阶段实施计划  
关联：[产品文档](./PRODUCT.md) · [技术文档](./TECHNICAL.md)

---

## 0. 总则

### 0.1 目标

打通一条可完成第一次雕刻的链路：

**SVG → Path → 坐标转换 → G-code → GRBL → 串口 → 激光机**

用户侧只表现为：

**图片 → 材料 → 尺寸 → 预览 → 开始**

### 0.2 执行方式（强制）

不要一次性生成整个项目。严格按照 Phase 1 → Phase 10。

**每个 Phase 完成后必须：**

1. 运行 `npm test`
2. 运行 `npm run build`（Phase 1 起，工具链就绪后）
3. 检查 TypeScript、ESLint、Electron security、IPC（已涉及的部分）
4. 汇报：
   - 修改了哪些文件
   - 新增了什么功能
   - 如何测试
   - 测试结果
   - 当前已知问题
   - 下一步是什么
5. **停止。等待下一条指令。不要自动进入下一个 Phase。**

### 0.3 原则

- 可靠性 > 易用性 > 功能数量 > 高级性能
- 不要为未来扩展过度设计
- 不要一次生成几千行代码
- 业务逻辑不进 React；Renderer 不碰串口
- SVG Parser、坐标转换、G-code Generator、GRBL Sender 职责分离
- GRBL 细节不污染普通用户 UI
- 激光安全：除正式任务确认外，任何路径都不得自动开激光

### 0.4 范围冻结

本计划不包含：DXF、AI、PDF、灰度雕刻、相机、自动对焦、材料识别、Nesting、云、登录、商城、社区。  
下一阶段只在本文第 12 节提出，不在 MVP 实现。

---

## Phase 1 — 项目基础架构

### 目标

可运行的 Electron + React + TypeScript + Vite 空壳，三层架构与安全配置就位。

### 交付

- 工程初始化：依赖、脚本、`tsconfig`、ESLint、Prettier、Vitest、Tailwind
- Main / Preload / Renderer 三层目录
- `contextIsolation: true`、`nodeIntegration: false`、优先 `sandbox: true`
- Preload 用 `contextBridge` 暴露空的 `window.app`（或占位 API），**不**暴露 `ipcRenderer`
- Renderer 首页占位：标题「激光雕刻」、拖入区文案、设备状态占位「未检测到雕刻机」
- 共享类型目录 `src/shared/types`
- CI 本地可跑：`npm test`、`npm run build`

### 不做

- 串口、GRBL、SVG 解析、真实 Canvas 雕刻逻辑

### 验收

- [ ] 开发模式能打开窗口
- [ ] Renderer 无法 `require('fs')` / 无法直接访问 Node
- [ ] 单测框架可跑（可先有一个 smoke test）
- [ ] TypeScript 与 ESLint 通过

### 如何测试

```bash
npm test
npm run build
npm run dev   # 目视：窗口打开，首页极简，无技术参数墙
```

### 停止条件

架构可运行后停止，汇报后等待指令。

---

## Phase 2 — 串口

### 目标

Main 进程能够列出、连接、断开串口；USB 拔出可感知；Renderer 只能通过 preload API 使用。

### 交付

- `SerialManager` / `SerialPortWrapper`
- `MockSerialPort`
- IPC：`device.list` / `connect` / `disconnect` / `getStatus`
- 事件：`device:connected` / `device:disconnected` / `device:error`
- 默认 115200，支持 9600～250000
- USB 关闭 / 错误回调
- 用户文案：连接失败（端口占用）、断开（请检查 USB）
- 首页：已连接显示「雕刻机已连接 / 我的雕刻机」；失败显示「没有检测到雕刻机」+ [重新检测]

### 不做

- GRBL 协议解析、自动识别固件欢迎语（可预留探测钩子，真正检测放 Phase 3）

### 验收

- [ ] Mock 下 list / connect / write / disconnect / onClose 单测通过
- [ ] Renderer 无 serialport 引用
- [ ] 端口占用映射为中文错误，不展示 Access denied

### 停止条件

串口层稳定后停止。

---

## Phase 3 — GRBL

### 目标

识别 GRBL、解析状态与设置、读取 MachineConfig。

### 交付

- `GrblParser`：`ok`、`error:N`、`ALARM`、`<Idle|MPos:...|FS:...>`、`$30=1000`、版本行
- `GrblController`：连接后读 `$$` `$G` `$30` `$31` `$32`、版本
- `MachineConfig` 结构落地
- `?` 状态查询，默认 250ms，不阻塞后续 Sender（本 Phase 只需证明轮询与写入可并存设计）
- `MockGRBL`
- 自动发现：扫描串口 → 尝试检测 GRBL → 成功则「✓ 雕刻机已连接」
- 无法得到机器尺寸时，才进入最小设置引导（宽高 mm）
- `error:20` 等映射为用户中文；高级信息可暂存在内部/日志

### 验收

- [ ] Parser 单测覆盖 status / ok / error / alarm / settings
- [ ] 连接成功后得到 `MachineConfig`（含 mock 固件）
- [ ] 普通 UI 仍不展示 COM3 / 115200 / GRBL 版本（可先无高级页）

### 停止条件

GRBL 识别与配置读取可用后停止。

---

## Phase 4 — 机器控制

### 目标

Home / Jog / Pause / Resume / Stop / Reset 在 Main 可用，UI 放在弱化入口。

### 交付

- `machine.home` → `$H`，UI「正在寻找机器原点...」
- `machine.jog` → `$J=G91 G21 Xn Fn`
- 暂停 `!`、继续 `~`、Reset `0x18`
- Stop 需确认文案；不自动 Reset
- 机器状态枚举：unknown / idle / running / paused / alarm / homing / disconnected
- 「机器控制」或「高级」入口，不进入首页主路径
- 连接后 **不** 自动 Jog / Home / 开激光
- 第一次设备检测可提供低风险移动测试（Jog 小步，不开激光）

### 验收

- [ ] MockGRBL 下 home / jog / pause / resume / reset 单测
- [ ] 主流程页面仍只有连接与导入入口
- [ ] 任何控制路径不发送 M3

### 停止条件

机器控制可用且不污染主流程后停止。

---

## Phase 5 — SVG

### 目标

把 SVG 变成 `Document { widthMm, heightMm, paths }`。

### 交付

- `SvgParser`、`SvgUnitConverter`、Bezier 离散
- 支持 line / polyline / polygon / rect / circle / ellipse / path
- Path：M L H V C Z
- 单位：px mm cm in，以及 width / height / viewBox
- `file.openSvg` / 拖放文件经 Main 读取（Renderer 不直接 fs）
- 单测：rect、circle、line、path、bezier、单位转换

### 不做

- Canvas 精绘、G-code、发送

### 验收

- [ ] 给定夹具 SVG，解析出 mm 尺寸与点列
- [ ] Generator 仍不接触 SVG DOM（本 Phase 尚未做 Generator，但 Parser 输出必须是 Path[]）

### 停止条件

解析结果稳定后停止。

---

## Phase 6 — Canvas

### 目标

工作区可视化：居中、缩放、移动、越界提示。

### 交付

- 三个核心页面骨架：Home / Workspace / Job（Job 可先占位）
- `CoordinateTransformer`：SVG → Workspace → Machine（左下原点）
- `CanvasRenderer`：工作区尺寸标注（如 300×200 mm），图案绘制
- 拖动、缩放、改宽高、默认锁定比例、[居中]、[适应工作区]
- 超出工作区域：立即文案 + 视觉提示，禁用开始
- 图案过大：[自动缩小] 保持比例
- 导入后默认居中；不要默认显示 X0 Y0 Z0
- 单测：Y 轴翻转、scaling、centering、bounds

### 验收

- [ ] 导入 SVG 后出现在工作区中央
- [ ] 改宽度高度（锁比例）画布与内部 bounds 一致
- [ ] 越界无法进入开始（按钮禁用）
- [ ] Y 翻转只存在于 CoordinateTransformer

### 停止条件

工作区交互可用后停止。

---

## Phase 7 — G-code

### 目标

由 Path[] + MachineConfig + MaterialPreset 生成可发送的 G-code。

### 交付

- `GCodeGenerator`、`GCodeEstimator`
- 输出 `GCodeDocument { lines, estimatedTime, bounds }`
- 头部 `G21` `G90`；移动 `G0` `G1`；激光 `M3` `M5`；`S` `F`
- `S = maxPower * powerPercent / 100`
- 木板 3mm 三档：轻度 / 标准 / 深度；UI 声明效果因机器而异
- 预留竹子 / 纸板 / 皮革 / 亚克力结构
- 普通预览页：图案、范围、预计时间、材料、效果；不展示 G-code
- 高级：查看 G-code（可先简易对话框）
- 路径预览动画（激光头小圆），不向机器发指令
- 单测：G21/G90/M3/M5/S/F、功率换算、bounds

### 验收

- [ ] 生成器零 UI 依赖
- [ ] `$30=1000` 且 20% → S200；`$30=255` → S51
- [ ] 空载模式相关转换可在本 Phase 设计接口，真正拦截在 Phase 8 强制落地

### 停止条件

G-code 生成与预览可用后停止。

---

## Phase 8 — Sender

### 目标

可靠逐行发送，任务可暂停/继续/停止/完成/报错。

### 交付

- `GrblSender`：逐行等待 `ok`；实时命令不进队列
- 状态：idle / running / paused / stopped / error / completed
- `job.start/pause/resume/stop` + `job:progress/paused/completed/error`
- 进度：普通用户看百分比与剩余时间；高级看行号与当前行
- USB 断开：停发、Job=error、Device=disconnected
- 空载测试：所有 `M3 Sxxx` 转为安全形态（如 `M5`），XY 仍移动
- 低功率测试：独立确认，默认不自动跑
- 单测：start / pause / resume / stop / complete / error / 断开中止 / 空载无开光

### 验收

- [ ] 禁止整包 `write(allGcode)`
- [ ] MockGRBL 走完整件任务到 completed
- [ ] 空载任务的 lines 中无生效 M3 开光
- [ ] polling `?` 不阻塞行发送

### 停止条件

Sender 在 Mock 下闭环后停止。

---

## Phase 9 — 傻瓜化 UX

### 目标

把已有能力收成「打印机式」主流程，技术细节进高级设置。

### 交付

- 首页极简：拖入图案 + 设备状态
- 自动发现文案：「我的雕刻机」「✓ 雕刻机已连接」
- 材料 / 厚度 / 效果；默认 3mm 木板 + 标准
- 第一次建议空载测试
- 五步首次引导（一步一任务）
- 第一次设备：低风险移动测试文案
- 开始前 SafetyChecker + 确认清单（放置材料 / 工作区安全 / 材料适合）
- 只有确认后才允许 M3
- 任务中 UI：正在雕刻、进度条、剩余时间、暂停、停止确认
- 完成页：用时、再次雕刻、返回首页
- 高级设置：COM、波特率、GRBL 版本、机器尺寸、最大功率、Laser Mode、G-code、串口日志
- 文案全面中文化；空状态；Toast / inline 为主，仅开始/停止/Reset/删除用确认框
- 状态机在 UI 层与 Device / Machine / Job 对齐

### 验收

- [ ] 主流程不超过 Home / Workspace / Job
- [ ] 核心按钮只有：选择文件、预览、开始雕刻、暂停、停止
- [ ] 普通路径看不到 COM3、115200、G-code、M3、S/F
- [ ] SafetyChecker 单测：越界、断开、alarm、空 G-code

### 停止条件

傻瓜化主路径可走通（Mock）后停止。

---

## Phase 10 — 完整 MVP 验收

### 目标

端到端验收：不懂 GRBL 的人能完成第一次雕刻（先 Mock，再实机）。

### 交付

- 对照产品文档第 14 节清单逐项验收
- 补齐缺口测试与错误文案
- README：安装、开发、构建、Windows / macOS 打包说明
- 硬件连接、空载测试、第一次低功率雕刻说明
- 已知问题列表
- 下一阶段建议（只文档，不开发）

### 验收剧本（Mock + 实机）

1. 打开软件
2. 插入机器（或启用 MockGRBL）
3. 软件发现机器
4. 导入 SVG，自动居中
5. 调整尺寸
6. 选择木板 / 3mm / 标准
7. 预览路径与预计时间
8. 开始 → 安全确认 → 开始
9. 看到进度
10. 完成

### 实机安全顺序

1. 只连接、只读配置，确认不开激光
2. 空载测试看路径
3. 用户明确确认后的低功率测试
4. 木板标准参数正式雕刻

### 停止条件

MVP 验收通过或列出阻塞问题后停止。此后进入维护 / 下一阶段，不再擅自加功能。

---

## 11. 硬件验证说明（Phase 10 使用）

### 11.1 如何连接 GRBL

1. USB 连接雕刻机
2. 不要同时打开其他占用串口的软件（LaserGRBL、Candle 等）
3. 打开老王打印机，等待「雕刻机已连接」
4. 若失败：重新检测 → 连接帮助（检查线材、驱动、端口占用）

普通用户无需选择 COM 口与波特率。高级设置里可查看。

### 11.2 如何用 Mock 测试

开发机无硬件时：

```bash
npm test
```

使用 `MockSerialPort` + `MockGRBL` 覆盖 Parser、Sender、安全检查。  
可提供开发开关「模拟雕刻机」仅用于开发，默认关闭，且不得出现在生产主路径（若加入，须在 Phase 9/10 明确标注）。

### 11.3 空载测试

1. 导入图案，确认在工作区内
2. 选择「空载测试」
3. 走安全确认
4. 机器应移动，激光不应出光（M3 被安全处理）
5. 观察路径是否与预览一致

### 11.4 第一次低功率雕刻

1. 空载成功之后
2. 放置适合的木板，确认工作区无异物、防护到位
3. 选择低功率测试，阅读「仍可能产生激光」警告并确认
4. 人员避开光路，执行短任务
5. 成功后再用「标准」效果正式雕刻

---

## 12. 下一阶段（只提出，不实现）

- PNG / JPG 导入
- 图片灰度雕刻
- 更多材料与参数校准
- DXF
- 相机定位
- AI 图像处理
- 自动参数优化

---

## 13. 每阶段汇报模板

每个 Phase 结束时按此回复（不要自动开下一 Phase）：

```markdown
## Phase N 完成报告

### 修改了哪些文件
- ...

### 新增了什么功能
- ...

### 如何测试
- 命令：
- 步骤：

### 测试结果
- npm test：
- npm run build：
- 手工 / Mock：

### 当前已知问题
- ...

### 下一步是什么
- Phase N+1：...
```

---

## 14. 里程碑总览

| Phase | 名称 | 用户可感知结果 | 技术闭环 |
| --- | --- | --- | --- |
| 1 | 基础架构 | 打开一个极简窗口 | Electron 安全三层 |
| 2 | 串口 | 插上能显示连接/失败 | SerialManager |
| 3 | GRBL | 「我的雕刻机已连接」 | Parser + MachineConfig |
| 4 | 机器控制 | 高级里能点动、回原点 | 实时命令 |
| 5 | SVG | 能选文件（内部已是 Path） | SvgParser |
| 6 | Canvas | 看到图案、能缩放居中 | CoordinateTransformer |
| 7 | G-code | 预览路径与时间 | GCodeGenerator |
| 8 | Sender | 能跑完一次任务（含空载） | 逐行 ok |
| 9 | 傻瓜化 UX | 主路径像打印机 | 文案/引导/安全确认 |
| 10 | MVP 验收 | 5 分钟第一次雕刻 | 全链路 |

核心指标：用户第一次打开软件后，能否在约 5 分钟内完成第一次雕刻。
