import { SerialPort } from 'serialport'
import { PortBusyError } from './errors'
import type { BaudRate, SerialBackend, SerialPortInfo, SerialPortLike } from './types'

export class SerialPortWrapper implements SerialPortLike {
  constructor(private readonly port: SerialPort) {}

  get path(): string {
    return this.port.path
  }

  get isOpen(): boolean {
    return this.port.isOpen
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.open((error) => {
        if (error) reject(normalizeNativeError(error))
        else resolve()
      })
    })
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port.isOpen) {
        resolve()
        return
      }
      this.port.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  write(data: string | Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.write(data, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  onData(handler: (chunk: Buffer) => void): void {
    this.port.on('data', handler)
  }

  onError(handler: (error: Error) => void): void {
    this.port.on('error', handler)
  }

  onClose(handler: () => void): void {
    this.port.on('close', handler)
  }
}

export class NodeSerialBackend implements SerialBackend {
  async list(): Promise<SerialPortInfo[]> {
    try {
      const ports = await SerialPort.list()
      return ports.map((port) => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber ?? undefined,
      }))
    } catch {
      return []
    }
  }

  async open(path: string, baudRate: BaudRate): Promise<SerialPortLike> {
    const wrapper = new SerialPortWrapper(new SerialPort({ path, baudRate, autoOpen: false }))
    await wrapper.open()
    return wrapper
  }
}

function normalizeNativeError(error: Error): Error {
  if (/access denied|eacces|ebusy|in use|cannot lock|resource busy|eperm/i.test(error.message)) {
    return new PortBusyError(error.message)
  }
  return error
}
