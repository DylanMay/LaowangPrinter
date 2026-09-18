import { formatUserError, toAppError, USER_ERRORS } from '@shared/errors/appError'
import type { MachineConfig } from '@shared/types/machine'
import type { DeviceState, DeviceStatus, PublicDevice } from '@shared/types/state'
import { GrblController } from '../grbl/GrblController'
import { SerialManager } from '../serial/SerialManager'
import type { SerialPortInfo } from '../serial/types'

const DISPLAY_NAME = '我的雕刻机'
const WATCH_MS = 2000

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
      this.state = 'error'
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
      workArea:
        widthMm && heightMm
          ? { widthMm, heightMm }
          : undefined,
    }
  }

  getConfig(): MachineConfig | null {
    return this.grbl.config
  }

  async list(): Promise<PublicDevice[]> {
    const ports = await this.serial.listPorts()
    return likelyPorts(ports).map((port) => ({
      id: port.path,
      name: DISPLAY_NAME,
    }))
  }

  async connect(id?: string): Promise<DeviceStatus> {
    if (this.state === 'connected') return this.getStatus()
    if (this.connectLock) return this.getStatus()
    this.connectLock = true
    this.setState('detecting')
    try {
      const ports = likelyPorts(await this.serial.listPorts())
      const candidates = id
        ? ports.filter((port) => port.path === id)
        : ports
      if (id && candidates.length === 0) {
        candidates.push({ path: id })
      }
      if (candidates.length === 0) {
        this.setError('NO_DEVICE')
        return this.getStatus()
      }
      this.setState('connecting')
      let lastError: unknown
      for (const port of candidates) {
        try {
          await this.serial.connect(port.path)
          await this.grbl.identify()
          this.errorMessage = null
          this.setState('connected')
          return this.getStatus()
        } catch (error) {
          lastError = error
          this.grbl.stop()
          await this.serial.disconnect()
          if (isPortBusy(error)) break
        }
      }
      throw lastError
    } catch (error) {
      const appError = toAppError(error)
      this.errorMessage = formatUserError(appError)
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
    await this.grbl.halt()
    this.emit()
    return this.getStatus()
  }

  async reset(): Promise<DeviceStatus> {
    return this.runActivity('resetting', () => this.grbl.reset())
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
    await this.connect(ports[0].path)
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

export function likelyPorts(ports: SerialPortInfo[]): SerialPortInfo[] {
  return ports.filter((port) => isLikelyEngraverPort(port.path))
}

export function isLikelyEngraverPort(path: string): boolean {
  const value = path.toLowerCase()
  if (value.includes('bluetooth')) return false
  if (/ttys\d+$/.test(value)) return false
  if (value.startsWith('mock://')) return true
  if (/ttyusb|ttyacm|usbserial|usbmodem|wchusb|slab_usb|usbto|ch34|cp210|cu\.usb/.test(value)) return true
  if (/^com\d+/.test(value)) return true
  return false
}

function isPortBusy(error: unknown): boolean {
  return toAppError(error).code === 'PORT_BUSY'
}
