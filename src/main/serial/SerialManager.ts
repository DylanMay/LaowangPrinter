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

const MAX_LOG = 800

export class SerialManager {
  private readonly emitter = new EventEmitter()
  private port: SerialPortLike | null = null
  private closingByUser = false
  private readonly logLines: string[] = []
  private rxLogBuf = ''
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
    port.onData((chunk) => {
      this.logIncoming(chunk)
      this.emitter.emit('data', chunk)
    })
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
    this.logOutgoing(data)
    await this.port.write(data)
  }

  get connected(): boolean {
    return this.port !== null
  }

  getLog(): string[] {
    return [...this.logLines]
  }

  private logOutgoing(data: string | Buffer): void {
    const text = formatSerialChunk(data)
    if (!shouldLog(text, '>')) return
    this.pushLog('>', text)
  }

  private logIncoming(chunk: Buffer): void {
    this.rxLogBuf += chunk.toString('utf8')
    const parts = this.rxLogBuf.split(/\r?\n/)
    this.rxLogBuf = parts.pop() ?? ''
    for (const part of parts) {
      const text = part.trim()
      if (!shouldLog(text, '<')) continue
      this.pushLog('<', text)
    }
  }

  private pushLog(direction: '>' | '<', text: string): void {
    this.logLines.push(`${direction} ${text}`)
    if (this.logLines.length > MAX_LOG) {
      this.logLines.splice(0, this.logLines.length - MAX_LOG)
    }
  }

  private handleClose(): void {
    const reason = this.closingByUser ? 'user' : 'unplug'
    this.closingByUser = false
    this.port = null
    this.connectedPath = null
    this.emitter.emit('disconnected', { reason })
  }
}

function formatSerialChunk(data: string | Buffer): string {
  if (typeof data === 'string') return data.replace(/\r?\n$/, '')
  if (data.length === 1) {
    const code = data[0]!
    if (code === 0x18) return '0x18'
    if (code === 0x3f) return '?'
    return String.fromCharCode(code)
  }
  return data.toString('utf8').replace(/\r?\n$/, '')
}

function shouldLog(text: string, direction: '>' | '<'): boolean {
  const value = text.trim()
  if (!value) return false
  if (direction === '>' && value === '?') return false
  if (direction === '<' && value.startsWith('<') && value.endsWith('>')) {
    return /<(Alarm|Hold|Door|Check|Sleep)/i.test(value)
  }
  return true
}
