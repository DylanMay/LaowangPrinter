import { XINGGUANG_4N_BAUD_RATES } from '@shared/machine/Xingguang4N'
import { COPY } from '@shared/copy'
import { formatUserError, toAppError, USER_ERRORS } from '@shared/errors/appError'
import { formatDiagnostics } from '@shared/debug/formatDiagnostics'
import type { AdvancedSnapshot, DiagnosticsSnapshot, MachineConfig } from '@shared/types/machine'
import type { JobProgress } from '@shared/types/job'
import type { DeviceState, DeviceStatus, PublicDevice } from '@shared/types/state'
import { GrblController } from '../grbl/GrblController'
import { readDarwinUsbTree, usbLooksLikeSerialAdapter } from '../serial/darwinUsb'
import { discoverPorts, likelyPorts, toCalloutPath } from '../serial/portFilter'
import { isBaudRate } from '../serial/errors'
import { SerialManager } from '../serial/SerialManager'
import type { BaudRate } from '../serial/types'

const DISPLAY_NAME = '我的雕刻机'
const WATCH_MS = 2000
const UNRECOGNIZED =
  '找到了 USB 设备，但无法识别为雕刻机。请关掉其他雕刻软件，拔掉 USB 再插上后重试。'
const NEED_DRIVER =
  '电脑已经看到雕刻机，但还不能通信。驱动窗口点 Install 没反应时，请先到系统设置打开「驱动程序扩展」，再点 Install。'

export class DeviceService {
  private state: DeviceState = 'disconnected'
  private errorMessage: string | null = null
  private watchTimer: ReturnType<typeof setInterval> | null = null
  private readonly listeners = new Set<(status: DeviceStatus) => void>()
  private readonly grbl: GrblController
  private connectLock = false
  private lastMachineState: DeviceStatus['machineState'] = 'disconnected'
  private activity: DeviceStatus['activity']

  constructor(
    private readonly serial: SerialManager,
    grbl?: GrblController,
  ) {
    this.grbl = grbl ?? new GrblController(serial)
    this.serial.on('disconnected', ({ reason }) => {
      if (reason === 'unplug') {
        this.setError('DEVICE_DISCONNECTED')
      } else {
        this.setState('disconnected')
      }
    })
    this.serial.on('error', (error) => {
      const appError = toAppError(error)
      this.errorMessage = formatUserError(appError)
      this.state = 'error'
      this.emit()
    })
    this.grbl.on('alarm', (error) => {
      this.errorMessage = formatUserError(toAppError(error))
      this.emit()
    })
    this.grbl.on('status', () => {
      const next = this.grbl.machineState
      if (next !== this.lastMachineState) {
        this.lastMachineState = next
        this.emit()
      }
    })
  }

  onStatus(listener: (status: DeviceStatus) => void): void {
    this.listeners.add(listener)
  }

  getStatus(): DeviceStatus {
    const config = this.grbl.config
    const widthMm = config?.widthMm
    const heightMm = config?.heightMm
    return {
      state: this.state,
      displayName: this.state === 'connected' ? DISPLAY_NAME : undefined,
      errorMessage: this.errorMessage ?? undefined,
      machineState: this.activity === 'homing' ? 'homing' : this.grbl.machineState,
      needsSizeSetup: this.state === 'connected' && Boolean(config?.needsSizeSetup),
      activity: this.activity,
      laserOn: this.grbl.laserOn,
      workArea:
        widthMm && heightMm
          ? { widthMm, heightMm }
          : undefined,
    }
  }

  getConfig(): MachineConfig | null {
    return this.grbl.config
  }

  getAdvanced(): AdvancedSnapshot {
    const config = this.grbl.config
    return {
      portPath: this.serial.connectedPath,
      baudRate: this.serial.baudRate,
      firmware: config?.firmware ?? '',
      version: config?.grblVersion ?? '',
      widthMm: config?.widthMm ?? null,
      heightMm: config?.heightMm ?? null,
      maxPower: config?.maxPower ?? 1000,
      laserMode: Boolean(config?.laserMode),
      serialLog: this.serial.getLog(),
    }
  }

  getDiagnostics(appVersion: string, job?: JobProgress): DiagnosticsSnapshot {
    return {
      text: formatDiagnostics({
        appVersion,
        status: this.getStatus(),
        config: this.grbl.config,
        portPath: this.serial.connectedPath,
        baudRate: this.serial.baudRate,
        lastAlarm: this.grbl.lastAlarmCode,
        lastError: this.grbl.lastErrorCode,
        serialLog: this.serial.getLog(),
        job,
      }),
    }
  }

  getController(): GrblController {
    return this.grbl
  }

  getSerial(): SerialManager {
    return this.serial
  }

  async list(): Promise<PublicDevice[]> {
    const ports = await this.serial.listPorts()
    return likelyPorts(ports).map((port) => ({
      id: port.path,
      name: DISPLAY_NAME,
    }))
  }

  async connect(id?: string, mode: 'auto' | 'manual' = 'manual'): Promise<DeviceStatus> {
    if (this.connectLock) {
      await waitWhile(() => this.connectLock, 10_000)
    }
    if (this.state === 'connected') return this.getStatus()
    this.connectLock = true
    this.setState('detecting')
    try {
      const ports = discoverPorts(await this.serial.listPorts(), mode)
      const wanted = id ? toCalloutPath(id) : undefined
      const candidates = wanted
        ? ports.filter((port) => port.path === wanted)
        : ports
      if (wanted && candidates.length === 0) {
        candidates.push({ path: wanted })
      }
      if (candidates.length === 0) {
        this.errorMessage = await explainMissingDevice()
        this.state = 'disconnected'
        this.emit()
        return this.getStatus()
      }
      this.setState('connecting')
      let lastError: unknown
      for (const port of candidates) {
        for (const baudRate of baudsFor(port.path)) {
          try {
            await this.serial.connect(port.path, baudRate)
            await this.grbl.identify()
            this.errorMessage = null
            this.setState('connected')
            return this.getStatus()
          } catch (error) {
            lastError = error
            this.grbl.stop()
            await this.serial.disconnect()
          }
        }
      }
      throw lastError
    } catch (error) {
      const appError = toAppError(error)
      this.errorMessage = appError.code === 'NO_DEVICE' ? UNRECOGNIZED : formatUserError(appError)
      this.state = appError.code === 'NO_DEVICE' ? 'disconnected' : 'error'
      this.emit()
      return this.getStatus()
    } finally {
      this.connectLock = false
    }
  }

  async disconnect(): Promise<DeviceStatus> {
    this.grbl.stop()
    await this.serial.disconnect()
    return this.getStatus()
  }

  async setSize(widthMm: number, heightMm: number): Promise<DeviceStatus> {
    this.grbl.setWorkspaceSize(widthMm, heightMm)
    await this.grbl.syncTravel(widthMm, heightMm)
    this.emit()
    return this.getStatus()
  }

  async unlock(): Promise<DeviceStatus> {
    if (this.state !== 'connected') return this.getStatus()
    try {
      await this.grbl.unlock()
      this.errorMessage = null
    } catch (error) {
      this.errorMessage = formatUserError(toAppError(error))
    }
    this.emit()
    return this.getStatus()
  }

  async setLaser(on: boolean, confirmed = false): Promise<DeviceStatus> {
    if (on && !confirmed) {
      throw new Error(COPY.laserOnNeedsConfirm)
    }
    if (this.state !== 'connected') return this.getStatus()
    try {
      await this.grbl.setLaser(on)
      this.errorMessage = null
    } catch (error) {
      this.errorMessage = formatUserError(toAppError(error))
    }
    this.emit()
    return this.getStatus()
  }

  async home(): Promise<DeviceStatus> {
    return this.runActivity('homing', () => this.grbl.home())
  }

  async jog(axis: 'X' | 'Y', distanceMm: number, feed: 100 | 500 | 1000 | 3000): Promise<DeviceStatus> {
    return this.runActivity('jogging', () => this.grbl.jog({ axis, distanceMm, feed }))
  }

  async pause(): Promise<DeviceStatus> {
    await this.grbl.pause()
    this.emit()
    return this.getStatus()
  }

  async resume(): Promise<DeviceStatus> {
    await this.grbl.resume()
    this.emit()
    return this.getStatus()
  }

  async halt(): Promise<DeviceStatus> {
    if (this.grbl.laserOn) {
      await this.grbl.setLaser(false).catch(() => undefined)
    }
    await this.grbl.halt()
    this.emit()
    return this.getStatus()
  }

  async reset(): Promise<DeviceStatus> {
    return this.runActivity('resetting', async () => {
      this.grbl.clearLaserHeld()
      await this.grbl.reset()
    })
  }

  async testMove(): Promise<DeviceStatus> {
    return this.runActivity('testing', () => this.grbl.testMove())
  }

  async startWatching(): Promise<void> {
    if (this.watchTimer) return
    await this.connectIfIdle()
    this.watchTimer = setInterval(() => {
      void this.connectIfIdle()
    }, WATCH_MS)
  }

  stopWatching(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer)
      this.watchTimer = null
    }
  }

  private async connectIfIdle(): Promise<void> {
    if (this.state !== 'disconnected' || this.connectLock) return
    const ports = likelyPorts(await this.serial.listPorts())
    if (this.state !== 'disconnected' || this.connectLock) return
    if (ports.length === 0) return
    await this.connect(undefined, 'auto')
  }

  private async runActivity(
    activity: NonNullable<DeviceStatus['activity']>,
    task: () => Promise<void>,
  ): Promise<DeviceStatus> {
    if (this.state !== 'connected') return this.getStatus()
    this.activity = activity
    this.emit()
    try {
      await task()
      this.errorMessage = null
    } catch (error) {
      this.errorMessage = formatUserError(toAppError(error))
    } finally {
      this.activity = undefined
      this.emit()
    }
    return this.getStatus()
  }

  private setState(state: DeviceState): void {
    this.state = state
    if (state === 'connected' || state === 'detecting' || state === 'connecting') {
      this.errorMessage = null
    }
    if (state === 'disconnected') {
      this.errorMessage = null
    }
    this.emit()
  }

  private setError(code: 'NO_DEVICE' | 'DEVICE_DISCONNECTED'): void {
    this.state = code === 'NO_DEVICE' ? 'disconnected' : 'error'
    this.errorMessage = formatUserError({ code, ...USER_ERRORS[code] })
    this.emit()
  }

  private emit(): void {
    const status = this.getStatus()
    this.listeners.forEach((listener) => listener(status))
  }
}

function baudsFor(path: string): BaudRate[] {
  if (path.startsWith('mock://')) return [115200]
  return XINGGUANG_4N_BAUD_RATES.filter(isBaudRate)
}

async function explainMissingDevice(): Promise<string> {
  const tree = await readDarwinUsbTree()
  if (usbLooksLikeSerialAdapter(tree)) return NEED_DRIVER
  return formatUserError({ code: 'NO_DEVICE', ...USER_ERRORS.NO_DEVICE })
}

function waitWhile(condition: () => boolean, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (!condition() || Date.now() - started >= ms) {
        clearInterval(timer)
        resolve()
      }
    }, 50)
  })
}
