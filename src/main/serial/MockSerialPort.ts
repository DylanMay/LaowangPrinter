import { PortBusyError, PortNotFoundError } from './errors'
import type { BaudRate, SerialBackend, SerialPortInfo, SerialPortLike } from './types'

type Handler<T> = (value: T) => void

export class MockSerialPort implements SerialPortLike {
  isOpen = false
  readonly written: Array<string | Buffer> = []
  private dataHandlers: Handler<Buffer>[] = []
  private errorHandlers: Handler<Error>[] = []
  private closeHandlers: Handler<void>[] = []

  constructor(
    readonly path: string,
    readonly baudRate: BaudRate,
  ) {}

  async open(): Promise<void> {
    this.isOpen = true
  }

  async close(): Promise<void> {
    if (!this.isOpen) return
    this.isOpen = false
    this.closeHandlers.forEach((handler) => handler())
  }

  async write(data: string | Buffer): Promise<void> {
    if (!this.isOpen) {
      throw new Error('Port is closed')
    }
    this.written.push(data)
  }

  onData(handler: Handler<Buffer>): void {
    this.dataHandlers.push(handler)
  }

  onError(handler: Handler<Error>): void {
    this.errorHandlers.push(handler)
  }

  onClose(handler: Handler<void>): void {
    this.closeHandlers.push(handler)
  }

  simulateData(chunk: Buffer | string): void {
    const data = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    this.dataHandlers.forEach((handler) => handler(data))
  }

  simulateError(error: Error): void {
    this.errorHandlers.forEach((handler) => handler(error))
  }

  simulateUnplug(): void {
    if (!this.isOpen) return
    this.isOpen = false
    this.closeHandlers.forEach((handler) => handler())
  }
}

export class MockSerialBackend implements SerialBackend {
  ports: SerialPortInfo[] = []
  busyPaths = new Set<string>()
  readonly opened = new Map<string, MockSerialPort>()

  async list(): Promise<SerialPortInfo[]> {
    return [...this.ports]
  }

  async open(path: string, baudRate: BaudRate): Promise<SerialPortLike> {
    if (!this.ports.some((port) => port.path === path)) {
      throw new PortNotFoundError(path)
    }
    if (this.busyPaths.has(path) || this.opened.has(path)) {
      throw new PortBusyError()
    }
    const port = new MockSerialPort(path, baudRate)
    await port.open()
    this.opened.set(path, port)
    port.onClose(() => this.opened.delete(path))
    return port
  }
}
