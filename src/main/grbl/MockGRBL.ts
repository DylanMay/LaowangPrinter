import { MockSerialBackend } from '../serial/MockSerialPort'
import type { SerialBackend } from '../serial/types'

export type MockGrblHost = {
  onWrite?: (data: string | Buffer) => void
  simulateData(chunk: Buffer | string): void
}

export type MockGrblOptions = {
  version?: string
  omitTravel?: boolean
  settings?: Record<number, number>
  delayOkMs?: number
  delayMotionMs?: number
  /** 收到 ! 后保持 Hold:1 / 进给 > 0 的毫秒数，用来模拟减速。 */
  holdSettleMs?: number
  unknownSettings?: number[]
}

const DEFAULT_SETTINGS: Record<number, number> = {
  0: 10,
  1: 25,
  10: 1,
  20: 0,
  21: 0,
  22: 0,
  30: 1000,
  31: 0,
  32: 1,
  100: 80,
  101: 80,
  110: 5000,
  111: 5000,
  120: 300,
  121: 300,
  130: 300,
  131: 200,
  132: 50,
}

export class MockGRBL {
  state = 'Idle'
  version: string
  settings: Record<number, number>
  parserState = 'G0 G54 G17 G21 G90 G94 M5 M9 T0 F0 S0'
  position = { x: 0, y: 0, z: 0 }
  holdOk = false
  spindleOn = false
  delayMotionMs = 0
  holdSettleMs = 0
  holdPending = false
  feedRate = 0
  private unknownSettings: number[]
  private port: MockGrblHost | null = null
  private lineBuf = ''
  private pendingOk: (() => void) | null = null
  private holdTimer: ReturnType<typeof setTimeout> | null = null
  private motionTimer: ReturnType<typeof setTimeout> | null = null
  private motionIdleTimer: ReturnType<typeof setTimeout> | null = null
  private motionEndsAt = 0

  constructor(options: MockGrblOptions = {}) {
    this.version = options.version ?? '1.1h'
    this.settings = { ...DEFAULT_SETTINGS, ...options.settings }
    this.unknownSettings = options.unknownSettings ?? []
    for (const id of this.unknownSettings) delete this.settings[id]
    if (options.omitTravel) {
      delete this.settings[130]
      delete this.settings[131]
    }
    this.holdOk = (options.delayOkMs ?? 0) > 0
    this.delayMotionMs = options.delayMotionMs ?? 0
    this.holdSettleMs = options.holdSettleMs ?? 0
  }

  attach(port: MockGrblHost): this {
    this.port = port
    port.onWrite = (data) => this.handleWrite(data)
    return this
  }

  handleWrite(data: string | Buffer): void {
    if (isReset(data)) {
      this.reset()
      return
    }
    const text = toText(data)
    for (const char of text) {
      if (char === '?') {
        this.sendStatus()
        continue
      }
      if (char === '!') {
        if (this.state === 'Run' || this.state === 'Jog') this.enterHold()
        continue
      }
      if (char === '~') {
        this.state = 'Idle'
        continue
      }
      this.lineBuf += char
      if (char === '\n') {
        const line = this.lineBuf.replace(/[\r\n]/g, '').trim()
        this.lineBuf = ''
        this.handleLine(line)
      }
    }
  }

  async releaseOk(): Promise<void> {
    this.pendingOk?.()
    this.pendingOk = null
  }

  simulateAlarm(code: number): void {
    this.state = 'Alarm'
    this.emit(`ALARM:${code}\r\n`)
  }

  simulateError(code: number): void {
    this.emit(`error:${code}\r\n`)
  }

  private reset(): void {
    const moving =
      this.state === 'Run' ||
      this.state === 'Jog' ||
      (this.state === 'Hold' && (this.holdPending || this.feedRate > 0))
    this.clearHoldTimer()
    this.clearMotionTimer()
    this.clearMotionIdleTimer()
    this.motionEndsAt = 0
    this.lineBuf = ''
    this.pendingOk = null
    this.holdPending = false
    this.feedRate = 0
    this.state = 'Alarm'
    if (moving) this.emit('ALARM:3\r\n')
    this.emit(`Grbl ${this.version} ['$' for help]\r\n`)
    this.emit(`[MSG:'$H'|'$X' to unlock]\r\n`)
  }

  private handleLine(line: string): void {
    if (!line) {
      this.replyOk()
      return
    }
    if (this.state === 'Hold') {
      return
    }
    if (line === '$$') {
      this.emitSettings()
      this.replyOk(0, true)
      return
    }
    if (line === '$G') {
      this.emit(`[GC:${this.parserState}]\r\n`)
      this.replyOk(0, true)
      return
    }
    if (line === '$I') {
      this.emit(`[VER:${this.version}.20190825:]\r\n`)
      this.emit(`[OPT:V,15,128]\r\n`)
      this.replyOk(0, true)
      return
    }
    if (line === '$X') {
      this.state = 'Idle'
      this.emit("[MSG:Caution: Unlocked]\r\n")
      this.replyOk(0, true)
      return
    }
    const set = /^\$(\d+)=(-?\d+(?:\.\d+)?)$/.exec(line)
    if (set) {
      const id = Number(set[1])
      if (this.unknownSettings.includes(id)) {
        this.emit('error:3\r\n')
        return
      }
      this.settings[id] = Number(set[2])
      this.replyOk(0, true)
      return
    }
    if (line === '$H') {
      if ((this.settings[22] ?? 0) === 0) {
        this.emit('error:5\r\n')
        return
      }
      this.state = 'Home'
      this.position = { x: 0, y: 0, z: 0 }
      this.state = 'Idle'
      this.replyOk()
      return
    }
    if (this.state === 'Alarm') {
      this.emit('error:9\r\n')
      return
    }
    const jog = /^\$J=/i.exec(line)
    if (jog) {
      if (/\bM3\b|\bM4\b/i.test(line)) {
        this.emit('error:20\r\n')
        return
      }
      const x = /X(-?\d+(?:\.\d+)?)/i.exec(line)
      const y = /Y(-?\d+(?:\.\d+)?)/i.exec(line)
      if (x) this.position.x += Number(x[1])
      if (y) this.position.y += Number(y[1])
      this.state = 'Jog'
      this.replyOk()
      this.state = 'Idle'
      return
    }
    if (/^\$\d+$/.test(line)) {
      this.replyOk()
      return
    }
    if (/^G21\b|^G90\b|^G0\b|^G1\b|^M3\b|^M4\b|^M5\b|^S\d+/i.test(line)) {
      this.applyMotion(line)
      if (/^(G0|G1)\b/i.test(line) && this.delayMotionMs > 0) {
        this.scheduleMotion(this.delayMotionMs)
        this.replyOk(0)
        return
      }
      if (/^(M3|M4|M5)\b|^S\d+/i.test(line)) {
        this.replyOk(this.remainingMotionMs())
        return
      }
      this.replyOk()
      return
    }
    this.emit('error:20\r\n')
  }

  private applyMotion(line: string): void {
    const x = /X(-?\d+(?:\.\d+)?)/i.exec(line)
    const y = /Y(-?\d+(?:\.\d+)?)/i.exec(line)
    if (x) this.position.x = Number(x[1])
    if (y) this.position.y = Number(y[1])
    if (/^M3\b|^M4\b/i.test(line)) {
      this.spindleOn = true
      this.parserState = this.parserState.replace(/\bM5\b/, 'M3')
    }
    if (/^M5\b/i.test(line)) {
      this.spindleOn = false
      this.parserState = this.parserState.replace(/\bM3\b/, 'M5')
    }
    if (/^(G0|G1)\b/i.test(line) && this.state !== 'Hold') {
      this.state = 'Run'
    }
  }

  private emitSettings(): void {
    for (const [key, value] of Object.entries(this.settings)) {
      this.emit(`$${key}=${formatSetting(value)}\r\n`)
    }
  }

  private sendStatus(): void {
    const { x, y, z } = this.position
    const label =
      this.state === 'Hold' ? (this.holdPending ? 'Hold:1' : 'Hold:0') : this.state
    this.emit(
      `<${label}|MPos:${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}|FS:${this.feedRate},0>\r\n`,
    )
  }

  private enterHold(): void {
    this.state = 'Hold'
    this.clearHoldTimer()
    if (this.holdSettleMs > 0) {
      this.holdPending = true
      this.feedRate = 500
      this.holdTimer = setTimeout(() => {
        this.holdPending = false
        this.feedRate = 0
        this.holdTimer = null
      }, this.holdSettleMs)
      return
    }
    this.holdPending = false
    this.feedRate = 0
  }

  private clearHoldTimer(): void {
    if (!this.holdTimer) return
    clearTimeout(this.holdTimer)
    this.holdTimer = null
  }

  private scheduleMotion(ms: number): void {
    this.clearMotionIdleTimer()
    this.motionEndsAt = Date.now() + ms
    this.motionIdleTimer = setTimeout(() => {
      this.motionIdleTimer = null
      this.motionEndsAt = 0
      if (this.state === 'Run') this.state = 'Idle'
    }, ms)
  }

  private remainingMotionMs(): number {
    return Math.max(0, this.motionEndsAt - Date.now())
  }

  private clearMotionIdleTimer(): void {
    if (!this.motionIdleTimer) return
    clearTimeout(this.motionIdleTimer)
    this.motionIdleTimer = null
  }

  private replyOk(delayMs = 0, immediate = false): void {
    const send = () => {
      this.emit('ok\r\n')
      if (this.remainingMotionMs() > 0 && this.state === 'Run') return
      if (this.state === 'Run' || this.state === 'Jog') this.state = 'Idle'
    }
    if (this.holdOk && !immediate) {
      this.pendingOk = send
      return
    }
    if (delayMs > 0) {
      this.clearMotionTimer()
      this.motionTimer = setTimeout(() => {
        this.motionTimer = null
        send()
      }, delayMs)
      return
    }
    send()
  }

  private clearMotionTimer(): void {
    if (!this.motionTimer) return
    clearTimeout(this.motionTimer)
    this.motionTimer = null
  }

  private emit(text: string): void {
    this.port?.simulateData(text)
  }
}

export function createMockEngraverBackend(
  options: MockGrblOptions = {},
): SerialBackend & { firmware: MockGRBL; backend: MockSerialBackend } {
  const backend = new MockSerialBackend()
  backend.ports = [{ path: 'mock://engraver', manufacturer: 'Mock' }]
  const firmware = new MockGRBL(options)
  const originalOpen = backend.open.bind(backend)
  backend.open = async (path, baudRate) => {
    const port = await originalOpen(path, baudRate)
    const mock = backend.opened.get(path)
    if (mock) firmware.attach(mock)
    return port
  }
  return Object.assign(backend, { firmware, backend })
}

function isReset(data: string | Buffer): boolean {
  if (typeof data === 'string') return data.charCodeAt(0) === 0x18 && data.length === 1
  return data.length === 1 && data[0] === 0x18
}

function toText(data: string | Buffer): string {
  return typeof data === 'string' ? data : data.toString('utf8')
}

function formatSetting(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}
