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
      machineState: this.grbl.machineState,
      needsSizeSetup: this.state === 'connected' && Boolean(config?.needsSizeSetup),
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
    if (this.state !== 'disconnected') return
    const ports = likelyPorts(await this.serial.listPorts())
    if (ports.length === 0) return
    await this.connect(ports[0].path)
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
  if (/ttyusb|ttyacm|usbserial|usbmodem|wchusb/.test(value)) return true
  if (/^com\d+/.test(value)) return true
  return false
}

function isPortBusy(error: unknown): boolean {
  return toAppError(error).code === 'PORT_BUSY'
}
