import { EventEmitter } from 'node:events'
import { PortNotFoundError, isBaudRate } from './errors'
import type { BaudRate, SerialBackend, SerialPortInfo, SerialPortLike } from './types'
import { DEFAULT_BAUD_RATE } from './types'

type SerialEvents = {
  data: [Buffer]
  error: [Error]
  connected: [{ path: string; baudRate: BaudRate }]
  disconnected: [{ reason: 'user' | 'unplug' }]
}

export class SerialManager {
  private readonly emitter = new EventEmitter()
  private port: SerialPortLike | null = null
  private closingByUser = false
  connectedPath: string | null = null
  baudRate: BaudRate = DEFAULT_BAUD_RATE

  constructor(private readonly backend: SerialBackend) {}

  on<K extends keyof SerialEvents>(event: K, listener: (...args: SerialEvents[K]) => void): void {
    this.emitter.on(event, listener as never)
  }

  off<K extends keyof SerialEvents>(event: K, listener: (...args: SerialEvents[K]) => void): void {
    this.emitter.off(event, listener as never)
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    return this.backend.list()
  }

  async connect(path: string, baudRate: BaudRate = DEFAULT_BAUD_RATE): Promise<void> {
    if (!isBaudRate(baudRate)) {
      throw new Error(`Unsupported baud rate: ${String(baudRate)}`)
    }
    if (this.port) {
      await this.disconnect()
    }
    const port = await this.backend.open(path, baudRate)
    this.port = port
    this.connectedPath = path
    this.baudRate = baudRate
    this.closingByUser = false
    port.onData((chunk) => this.emitter.emit('data', chunk))
    port.onError((error) => this.emitter.emit('error', error))
    port.onClose(() => this.handleClose())
    this.emitter.emit('connected', { path, baudRate })
  }

  async disconnect(): Promise<void> {
    if (!this.port) return
    this.closingByUser = true
    await this.port.close()
  }

  async write(data: string | Buffer): Promise<void> {
    if (!this.port) {
      throw new PortNotFoundError()
    }
    await this.port.write(data)
  }

  get connected(): boolean {
    return this.port !== null
  }

  private handleClose(): void {
    const reason = this.closingByUser ? 'user' : 'unplug'
    this.closingByUser = false
    this.port = null
    this.connectedPath = null
    this.emitter.emit('disconnected', { reason })
  }
}
