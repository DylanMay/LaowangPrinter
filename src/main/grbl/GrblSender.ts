import { EventEmitter } from 'node:events'
import { COPY } from '@shared/copy'
import { formatUserError, toAppError } from '@shared/errors/appError'
import { applyDryRunSafety } from '@shared/gcode/GCodeGenerator'
import type { JobProgress, JobStartOptions, SenderState } from '@shared/types/job'
import type { JobState } from '@shared/types/state'
import { SerialManager } from '../serial/SerialManager'
import { GrblController } from './GrblController'

const LINE_TIMEOUT_MS = 1500
const MOTION_TIMEOUT_MS = 60_000

type SenderEvents = {
  progress: [JobProgress]
  paused: [JobProgress]
  completed: [JobProgress]
  error: [JobProgress]
}

export class GrblSender {
  private readonly emitter = new EventEmitter()
  private state: SenderState = 'idle'
  private lines: string[] = []
  private index = 0
  private currentLine = ''
  private dryRun = false
  private lowPowerTest = false
  private estimatedTime = 0
  private startedAt = 0
  private finishedAt = 0
  private errorMessage: string | undefined
  private pauseWaiters: Array<() => void> = []
  private loop: Promise<void> | null = null

  constructor(
    private readonly controller: GrblController,
    private readonly serial: SerialManager,
  ) {
    this.serial.on('disconnected', () => this.handleDisconnect())
    this.controller.on('error', (error) => this.fail(error))
    this.controller.on('alarm', (error) => this.fail(error))
  }

  on<K extends keyof SenderEvents>(event: K, listener: (...args: SenderEvents[K]) => void): void {
    this.emitter.on(event, listener as never)
  }

  getProgress(): JobProgress {
    const total = this.lines.length
    const sent = this.index
    const percent = total === 0 ? 0 : Math.min(100, Math.round((sent / total) * 100))
    const elapsed = elapsedSeconds(this.startedAt, this.finishedAt)
    const remaining = this.state === 'completed' ? 0 : Math.max(0, Math.round(this.estimatedTime * (1 - sent / Math.max(1, total))))
    return {
      state: this.state,
      jobState: toJobState(this.state),
      percent: this.state === 'idle' ? 0 : percent,
      remainingSeconds: remaining,
      elapsedSeconds: elapsed,
      estimatedTime: this.estimatedTime,
      sentLines: sent,
      totalLines: total,
      currentLine: this.currentLine,
      dryRun: this.dryRun,
      lowPowerTest: this.lowPowerTest,
      errorMessage: this.errorMessage,
    }
  }

  async start(options: JobStartOptions): Promise<void> {
    if (this.state === 'running' || this.state === 'paused') {
      throw new Error('busy')
    }
    if (options.lowPowerTest && !options.confirmLowPower) {
      throw new Error(COPY.lowPowerNeedsConfirm)
    }
    const prepared = prepareLines(options.lines, Boolean(options.dryRun))
    this.lines = prepared
    this.index = 0
    this.currentLine = ''
    this.dryRun = Boolean(options.dryRun)
    this.lowPowerTest = Boolean(options.lowPowerTest)
    this.estimatedTime = Math.max(0, options.estimatedTime)
    this.startedAt = Date.now()
    this.finishedAt = 0
    this.errorMessage = undefined
    this.state = 'running'
    this.emitProgress()
    this.loop = this.runLoop()
  }

  async pause(): Promise<void> {
    if (this.state !== 'running') return
    this.state = 'paused'
    await this.controller.pause()
    const progress = this.getProgress()
    this.emitter.emit('paused', progress)
    this.emitProgress()
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused') return
    this.state = 'running'
    await this.controller.resume()
    this.releasePause()
    this.emitProgress()
  }

  async stop(): Promise<void> {
    if (this.state !== 'running' && this.state !== 'paused') return
    this.state = 'stopped'
    this.controller.abortPending(new Error('stopped'))
    this.releasePause()
    this.finishedAt = Date.now()
    this.currentLine = ''
    this.emitProgress()
    await this.safeAbort()
    await this.loop
  }

  private async runLoop(): Promise<void> {
    try {
      while (this.index < this.lines.length) {
        if (this.shouldStop()) return
        if (this.state === 'paused') {
          await this.waitWhilePaused()
          continue
        }
        const line = this.lines[this.index]!
        if (this.dryRun && isLaserOn(line)) {
          throw new Error('Laser command blocked')
        }
        this.currentLine = line
        this.emitProgress()
        await this.controller.sendLine(line, timeoutFor(line), !this.dryRun)
        if (this.shouldStop()) return
        this.index += 1
        this.currentLine = ''
        this.emitProgress()
      }
      if (this.shouldStop()) return
      if (this.state === 'paused') {
        await this.waitWhilePaused()
      }
      if (this.shouldStop()) return
      if (this.state === 'running') {
        this.finishCompleted()
      }
    } catch (error) {
      if (this.state === 'stopped' || this.state === 'error') return
      if (this.absorbAbort(error)) return
      this.fail(error)
    }
  }

  private finishCompleted(): void {
    this.state = 'completed'
    this.finishedAt = Date.now()
    this.currentLine = ''
    const progress = this.getProgress()
    this.emitter.emit('completed', progress)
    this.emitProgress()
  }

  private absorbAbort(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    if (message !== 'reset' && message !== 'stopped') return false
    if (this.state !== 'running' && this.state !== 'paused') return true
    this.state = 'stopped'
    this.finishedAt = Date.now()
    this.currentLine = ''
    this.releasePause()
    this.emitProgress()
    return true
  }

  private shouldStop(): boolean {
    return this.state === 'stopped' || this.state === 'error'
  }

  private fail(error: unknown): void {
    if (this.state !== 'running' && this.state !== 'paused') return
    this.state = 'error'
    this.finishedAt = Date.now()
    this.currentLine = ''
    this.errorMessage = formatUserError(toAppError(error))
    this.controller.abortPending(new Error('error'))
    this.releasePause()
    void this.safeAbort()
    const progress = this.getProgress()
    this.emitter.emit('error', progress)
    this.emitProgress()
  }

  private async safeAbort(): Promise<void> {
    if (!this.serial.connected) return
    await this.controller.halt()
    try {
      await this.controller.reset()
    } catch {
      /* already disconnected or not GRBL */
    }
  }

  private handleDisconnect(): void {
    if (this.state !== 'running' && this.state !== 'paused') return
    this.controller.abortPending(new Error('disconnected'))
    this.releasePause()
    this.fail({ code: 'DEVICE_DISCONNECTED' })
  }

  private waitWhilePaused(): Promise<void> {
    if (this.state !== 'paused') return Promise.resolve()
    return new Promise((resolve) => {
      this.pauseWaiters.push(resolve)
    })
  }

  private releasePause(): void {
    const waiters = this.pauseWaiters.splice(0)
    waiters.forEach((waiter) => waiter())
  }

  private emitProgress(): void {
    this.emitter.emit('progress', this.getProgress())
  }
}

export function prepareLines(lines: string[], dryRun: boolean): string[] {
  const trimmed = lines.map((line) => line.trim()).filter(Boolean)
  return dryRun ? applyDryRunSafety(trimmed) : trimmed
}

function isLaserOn(line: string): boolean {
  if (/^M3\b|^M4\b/i.test(line.trim())) return true
  const spindle = /\bS([0-9.]+)/i.exec(line)
  return Boolean(spindle && Number(spindle[1]) > 0)
}

function timeoutFor(line: string): number {
  return /^(G0|G1|\$H|\$J=)/i.test(line.trim()) ? MOTION_TIMEOUT_MS : LINE_TIMEOUT_MS
}

function toJobState(state: SenderState): JobState {
  return state
}

function elapsedSeconds(startedAt: number, finishedAt: number): number {
  if (!startedAt) return 0
  const end = finishedAt || Date.now()
  return Math.max(0, Math.round((end - startedAt) / 1000))
}
