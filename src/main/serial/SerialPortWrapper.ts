import { readdir } from 'node:fs/promises'
import { SerialPort } from 'serialport'
import { PortBusyError } from './errors'
import { mergePortLists, parseDevSerialNames, toCalloutPath } from './portFilter'
import type { BaudRate, SerialBackend, SerialPortInfo, SerialPortLike } from './types'

const LIST_TIMEOUT_MS = 3000
const OPEN_TIMEOUT_MS = 4000

export class SerialPortWrapper implements SerialPortLike {
  private dataHandler: ((chunk: Buffer) => void) | null = null
  private readonly queued: Buffer[] = []

  constructor(private readonly port: SerialPort) {
    this.port.on('data', (chunk: Buffer) => {
      if (this.dataHandler) this.dataHandler(chunk)
      else this.queued.push(Buffer.from(chunk))
    })
  }

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
    this.dataHandler = handler
    for (const chunk of this.queued.splice(0)) handler(chunk)
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
    const scanned = await scanOsSerialNodes()
    let listed: SerialPortInfo[] = []
    try {
      const ports = await withTimeout(SerialPort.list(), LIST_TIMEOUT_MS)
      listed = ports.map((port) => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber ?? undefined,
        vendorId: port.vendorId ?? undefined,
        productId: port.productId ?? undefined,
      }))
    } catch (error) {
      console.error('[laowang] serial list failed', error)
    }
    const merged = mergePortLists(listed, scanned)
    console.log('[laowang] serial ports', merged.map((port) => port.path).join(', ') || '(none)')
    return merged
  }

  async open(path: string, baudRate: BaudRate): Promise<SerialPortLike> {
    const resolved = toCalloutPath(path)
    const native = new SerialPort({
      path: resolved,
      baudRate,
      autoOpen: false,
      rtscts: false,
      hupcl: false,
    })
    const wrapper = new SerialPortWrapper(native)
    try {
      await withTimeout(wrapper.open(), OPEN_TIMEOUT_MS)
      // ESP32 / CH340 在 macOS 上默认 DTR/RTS 会把板子按在复位或下载模式。
      await pulseControlLines(native)
      return wrapper
    } catch (error) {
      await closeQuietly(native)
      throw error
    }
  }
}

async function scanOsSerialNodes(): Promise<SerialPortInfo[]> {
  try {
    const names = await readdir('/dev')
    return parseDevSerialNames(names)
  } catch {
    return []
  }
}

async function pulseControlLines(port: SerialPort): Promise<void> {
  await setControlLines(port, { dtr: true, rts: false })
  await sleep(50)
  await setControlLines(port, { dtr: false, rts: false })
  await sleep(80)
}

function setControlLines(port: SerialPort, flags: { dtr: boolean; rts: boolean }): Promise<void> {
  return new Promise((resolve) => {
    if (typeof port.set !== 'function') {
      resolve()
      return
    }
    port.set(flags, () => resolve())
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('serial timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function closeQuietly(port: SerialPort): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => resolve()
    try {
      if (typeof port.close === 'function') {
        port.close(() => finish())
        return
      }
    } catch {
      finish()
      return
    }
    finish()
  })
}

function normalizeNativeError(error: Error): Error {
  if (/access denied|eacces|ebusy|in use|cannot lock|resource busy|eperm/i.test(error.message)) {
    return new PortBusyError(error.message)
  }
  return error
}
