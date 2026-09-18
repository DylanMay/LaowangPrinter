import { formatUserError, toAppError, USER_ERRORS } from '@shared/errors/appError'
import type { DeviceState, DeviceStatus, PublicDevice } from '@shared/types/state'
import { SerialManager } from '../serial/SerialManager'
import type { SerialPortInfo } from '../serial/types'

const DISPLAY_NAME = '我的雕刻机'
const WATCH_MS = 2000

export class DeviceService {
  private state: DeviceState = 'disconnected'
  private errorMessage: string | null = null
  private watchTimer: ReturnType<typeof setInterval> | null = null
  private readonly listeners = new Set<(status: DeviceStatus) => void>()

  constructor(private readonly serial: SerialManager) {
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
  }

  onStatus(listener: (status: DeviceStatus) => void): void {
    this.listeners.add(listener)
  }

  getStatus(): DeviceStatus {
    return {
      state: this.state,
      displayName: this.state === 'connected' ? DISPLAY_NAME : undefined,
      errorMessage: this.errorMessage ?? undefined,
    }
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
      const path = id ?? ports[0]?.path
      if (!path) {
        this.setError('NO_DEVICE')
        return this.getStatus()
      }
      this.setState('connecting')
      await this.serial.connect(path)
      this.errorMessage = null
      this.setState('connected')
      return this.getStatus()
    } catch (error) {
      const appError = toAppError(error)
      this.errorMessage = formatUserError(appError)
      this.state = 'error'
      this.emit()
      return this.getStatus()
    }
  }

  async disconnect(): Promise<DeviceStatus> {
    await this.serial.disconnect()
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
