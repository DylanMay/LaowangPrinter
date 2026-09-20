import { EventEmitter } from 'node:events'
import type { JogParams, MachineConfig } from '@shared/types/machine'
import type { MachineState } from '@shared/types/state'
import { SerialManager } from '../serial/SerialManager'
import { GrblAlarmError, GrblCommandError, LaserBlockedError, NotGrblError } from './errors'
import { feedGrblBuffer, parseGrblLine } from './GrblParser'
import { REALTIME_HOLD, REALTIME_RESET, REALTIME_RESUME, REALTIME_STATUS, STATUS_POLL_MS } from './types'
import type { GrblStatusReport } from './types'

const LINE_TIMEOUT_MS = 1500
const MOTION_TIMEOUT_MS = 60_000
const VERSION_WAIT_MS = 2000

type GrblEvents = {
  status: [GrblStatusReport]
  alarm: [GrblAlarmError]
  error: [GrblCommandError]
  config: [MachineConfig]
}

export class GrblController {
  private readonly emitter = new EventEmitter()
  private buffer = ''
  private version: string | null = null
  private parserState: string | null = null
  private settings = new Map<number, number>()
  private okWaiter: { resolve: () => void; reject: (error: Error) => void } | null = null
  private okTimer: ReturnType<typeof setTimeout> | null = null
  private chain: Promise<void> = Promise.resolve()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private lastReport: GrblStatusReport | null = null
  config: MachineConfig | null = null

  constructor(private readonly serial: SerialManager) {
    this.serial.on('data', (chunk) => this.pushBytes(chunk))
    this.serial.on('disconnected', () => this.handleDisconnect())
  }

  on<K extends keyof GrblEvents>(event: K, listener: (...args: GrblEvents[K]) => void): void {
    this.emitter.on(event, listener as never)
  }

  get machineState(): MachineState {
    if (!this.serial.connected) return 'disconnected'
    return mapMachineState(this.lastReport?.state)
  }

  get lastStatus(): GrblStatusReport | null {
    return this.lastReport
  }

  async identify(): Promise<MachineConfig> {
    this.resetSession()
    await this.writeRealtime(Buffer.from([REALTIME_RESET]))
    const welcomed = await this.waitFor(() => this.version !== null, VERSION_WAIT_MS)
    if (!welcomed) {
      await this.writeRealtime('$I\n')
      await this.waitFor(() => this.version !== null, 800)
    }
    if (!this.version) {
      throw new NotGrblError()
    }
    await this.sendLine('$$')
    await this.sendLine('$G')
    this.config = this.buildConfig()
    this.startPolling()
    this.emitter.emit('config', this.config)
    return this.config
  }

  startPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      void this.writeRealtime(REALTIME_STATUS)
    }, STATUS_POLL_MS)
  }

  stopPolling(): void {
    if (!this.pollTimer) return
    clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  async writeRealtime(data: string | Buffer): Promise<void> {
    if (!this.serial.connected) return
    await this.serial.write(data)
  }

  sendLine(line: string, timeoutMs = LINE_TIMEOUT_MS, allowLaser = false): Promise<void> {
    try {
      if (!allowLaser) assertNoLaser(line)
    } catch (error) {
      return Promise.reject(error)
    }
    const run = this.chain.then(() => this.sendLineNow(line, timeoutMs))
    this.chain = run.catch(() => undefined)
    return run
  }

  async home(): Promise<void> {
    await this.sendLine('$H', MOTION_TIMEOUT_MS)
  }

  async jog(params: JogParams): Promise<void> {
    const command = buildJogCommand(params)
    await this.sendLine(command, MOTION_TIMEOUT_MS)
  }

  async pause(): Promise<void> {
    await this.writeRealtime(REALTIME_HOLD)
  }

  async resume(): Promise<void> {
    await this.writeRealtime(REALTIME_RESUME)
  }

  async halt(): Promise<void> {
    await this.writeRealtime(REALTIME_HOLD)
  }

  async reset(): Promise<void> {
    this.version = null
    this.rejectOk(new Error('reset'))
    await this.writeRealtime(Buffer.from([REALTIME_RESET]))
    const welcomed = await this.waitFor(() => this.version !== null, VERSION_WAIT_MS)
    if (!welcomed) throw new NotGrblError()
  }

  async testMove(): Promise<void> {
    await this.jog({ axis: 'X', distanceMm: 1, feed: 100 })
  }

  setWorkspaceSize(widthMm: number, heightMm: number): MachineConfig {
    if (!this.config) {
      throw new Error('Not connected')
    }
    if (!isValidSize(widthMm) || !isValidSize(heightMm)) {
      throw new Error('Invalid size')
    }
    this.config = {
      ...this.config,
      widthMm,
      heightMm,
      needsSizeSetup: false,
    }
    this.emitter.emit('config', this.config)
    return this.config
  }

  abortPending(error: Error = new Error('stopped')): void {
    this.rejectOk(error)
  }

  stop(): void {
    this.stopPolling()
    this.rejectOk(new Error('disconnected'))
    this.resetSession()
  }

  private async sendLineNow(line: string, timeoutMs = LINE_TIMEOUT_MS): Promise<void> {
    const payload = line.endsWith('\n') ? line : `${line}\n`
    const waiting = this.waitForOk(timeoutMs)
    await this.serial.write(payload)
    await waiting
  }

  private waitForOk(timeoutMs = LINE_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
      this.okWaiter = { resolve, reject }
      this.okTimer = setTimeout(() => {
        this.okWaiter = null
        reject(new Error('GRBL timeout'))
      }, timeoutMs)
    })
  }

  private pushBytes(chunk: Buffer): void {
    const fed = feedGrblBuffer(this.buffer, chunk)
    this.buffer = fed.buffer
    for (const line of fed.lines) {
      this.handleMessage(parseGrblLine(line))
    }
  }

  private handleMessage(message: ReturnType<typeof parseGrblLine>): void {
    if (message.kind === 'ok') {
      this.resolveOk()
      return
    }
    if (message.kind === 'error') {
      const error = new GrblCommandError(message.code)
      this.rejectOk(error)
      this.emitter.emit('error', error)
      return
    }
    if (message.kind === 'alarm') {
      const error = new GrblAlarmError(message.code)
      this.rejectOk(error)
      this.lastReport = {
        state: 'Alarm',
        position: this.lastReport?.position ?? { x: 0, y: 0, z: 0 },
        feed: 0,
        spindle: 0,
      }
      this.emitter.emit('alarm', error)
      return
    }
    if (message.kind === 'version') {
      this.version = message.version
      return
    }
    if (message.kind === 'setting') {
      const id = Number(message.key.slice(1))
      if (Number.isFinite(id)) this.settings.set(id, message.value)
      return
    }
    if (message.kind === 'parserState') {
      this.parserState = message.raw
      return
    }
    if (message.kind === 'status') {
      this.lastReport = message.report
      this.emitter.emit('status', message.report)
    }
  }

  private buildConfig(): MachineConfig {
    const widthMm = positive(this.settings.get(130))
    const heightMm = positive(this.settings.get(131))
    return {
      widthMm,
      heightMm,
      maxPower: this.settings.get(30) ?? 1000,
      minPower: this.settings.get(31) ?? 0,
      laserMode: (this.settings.get(32) ?? 0) !== 0,
      grblVersion: this.version ?? '',
      firmware: this.version ? `Grbl ${this.version}` : '',
      settings: Object.fromEntries(this.settings),
      parserState: this.parserState,
      needsSizeSetup: widthMm === null || heightMm === null,
    }
  }

  private resetSession(): void {
    this.buffer = ''
    this.version = null
    this.parserState = null
    this.settings = new Map()
    this.lastReport = null
    this.config = null
  }

  private handleDisconnect(): void {
    this.stop()
  }

  private resolveOk(): void {
    if (!this.okWaiter) return
    if (this.okTimer) clearTimeout(this.okTimer)
    const waiter = this.okWaiter
    this.okWaiter = null
    waiter.resolve()
  }

  private rejectOk(error: Error): void {
    if (!this.okWaiter) return
    if (this.okTimer) clearTimeout(this.okTimer)
    const waiter = this.okWaiter
    this.okWaiter = null
    waiter.reject(error)
  }

  private waitFor(predicate: () => boolean, ms: number): Promise<boolean> {
    if (predicate()) return Promise.resolve(true)
    return new Promise((resolve) => {
      const started = Date.now()
      const timer = setInterval(() => {
        if (predicate()) {
          clearInterval(timer)
          resolve(true)
        } else if (Date.now() - started >= ms) {
          clearInterval(timer)
          resolve(false)
        }
      }, 10)
    })
  }
}

function mapMachineState(state: GrblStatusReport['state'] | undefined): MachineState {
  switch (state) {
    case 'Idle':
      return 'idle'
    case 'Run':
    case 'Jog':
      return 'running'
    case 'Hold':
      return 'paused'
    case 'Alarm':
      return 'alarm'
    case 'Home':
      return 'homing'
    default:
      return 'unknown'
  }
}

function positive(value: number | undefined): number | null {
  return value !== undefined && value > 0 ? value : null
}

function isValidSize(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 2000
}

function assertNoLaser(line: string): void {
  if (/\bM3\b|\bM4\b/i.test(line)) {
    throw new LaserBlockedError()
  }
}

function buildJogCommand(params: JogParams): string {
  const axis = params.axis === 'Y' ? 'Y' : 'X'
  const distance = params.distanceMm
  const feed = params.feed
  if (!Number.isFinite(distance) || distance === 0 || Math.abs(distance) > 100) {
    throw new Error('Invalid jog')
  }
  if (feed !== 100 && feed !== 500 && feed !== 1000 && feed !== 3000) {
    throw new Error('Invalid jog')
  }
  const amount = Number.isInteger(distance) ? String(distance) : distance.toFixed(3)
  return `$J=G91 G21 ${axis}${amount} F${feed}`
}

export { STATUS_POLL_MS }
