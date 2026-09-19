import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SerialManager } from '../serial/SerialManager'
import { GrblController } from './GrblController'
import { GrblSender } from './GrblSender'
import { createMockEngraverBackend } from './MockGRBL'
import type { JobProgress } from '@shared/types/job'

const SAMPLE = ['G21', 'G90', 'G0 X10 Y10', 'M3 S200', 'G1 X20 Y10 F1000', 'G1 X20 Y20', 'M5']

describe('GrblSender', () => {
  const running: Array<{ controller: GrblController; serial: SerialManager }> = []

  afterEach(async () => {
    for (const item of running.splice(0)) {
      item.controller.stop()
      await item.serial.disconnect()
    }
  })

  it('逐行等待 ok，禁止整包写入，并可跑完到 completed', async () => {
    const ctx = await setup()
    const writesBefore = gcodeWrites(ctx.port.written).length
    const completed = once(ctx.sender, 'completed')
    await ctx.sender.start({ lines: SAMPLE, estimatedTime: 12, dryRun: false })
    const progress = await completed
    expect(progress.state).toBe('completed')
    expect(progress.percent).toBe(100)
    expect(progress.sentLines).toBe(SAMPLE.length)

    const writes = gcodeWrites(ctx.port.written).slice(writesBefore)
    expect(writes.length).toBe(SAMPLE.length)
    for (const chunk of writes) {
      expect(chunk.trim().split(/\n/).filter(Boolean)).toHaveLength(1)
    }
    expect(writes).toEqual(SAMPLE)
    expect(ctx.port.written.some((chunk) => asText(chunk).includes(SAMPLE.join('\n')))).toBe(false)

    const source = readFileSync(resolve(import.meta.dirname, 'GrblSender.ts'), 'utf8')
    expect(source).not.toMatch(/lines\.join\(/)
    expect(source).not.toMatch(/write\(all/)
    expect(source).not.toMatch(/from ['"]react['"]/)
  })

  it('空载把 M3 转成 M5，XY 仍移动且无开光', async () => {
    const ctx = await setup()
    const completed = once(ctx.sender, 'completed')
    await ctx.sender.start({ lines: SAMPLE, estimatedTime: 12, dryRun: true })
    await completed
    const blob = ctx.port.written.map(asText).join('')
    expect(blob).toMatch(/G1 X20 Y10 F1000/)
    expect(blob).not.toMatch(/\bM3\b/)
    expect(blob).toMatch(/\bM5\b/)
    expect(ctx.backend.firmware.spindleOn).toBe(false)
  })

  it('pause / resume / stop', async () => {
    const ctx = await setup()
    ctx.backend.firmware.holdOk = true
    await ctx.sender.start({ lines: SAMPLE, estimatedTime: 12, dryRun: false })
    expect(ctx.sender.getProgress().currentLine).toBe('G21')
    await ctx.sender.pause()
    expect(ctx.sender.getProgress().state).toBe('paused')
    await ctx.backend.firmware.releaseOk()
    await tick()
    const afterPause = gcodeWrites(ctx.port.written)
    expect(afterPause.filter((line) => line.startsWith('G1')).length).toBe(0)
    await ctx.sender.resume()
    expect(ctx.sender.getProgress().state).toBe('running')
    await drain(ctx)
    expect(ctx.sender.getProgress().state).toBe('completed')

    ctx.backend.firmware.holdOk = true
    const sender2 = new GrblSender(ctx.controller, ctx.serial)
    await sender2.start({ lines: SAMPLE, estimatedTime: 12, dryRun: false })
    const stopped = waitForState(sender2, 'stopped')
    await sender2.stop()
    await stopped
    expect(sender2.getProgress().state).toBe('stopped')
    expect(sender2.getProgress().sentLines).toBeLessThan(SAMPLE.length)
    expect(ctx.port.written.some(isResetChunk)).toBe(true)
  })

  it('最后一行发送中暂停，继续后会 completed', async () => {
    const ctx = await setup()
    ctx.backend.firmware.holdOk = true
    const completed = once(ctx.sender, 'completed')
    await ctx.sender.start({ lines: ['G21', 'M5'], estimatedTime: 1, dryRun: true })
    await ctx.backend.firmware.releaseOk()
    await tick()
    expect(ctx.sender.getProgress().currentLine).toBe('M5')
    await ctx.sender.pause()
    await ctx.backend.firmware.releaseOk()
    await tick()
    expect(ctx.sender.getProgress().state).toBe('paused')
    expect(ctx.sender.getProgress().sentLines).toBe(2)
    await ctx.sender.resume()
    const progress = await completed
    expect(progress.state).toBe('completed')
  })

  it('任务中复位记为停止，而不是报错', async () => {
    const ctx = await setup()
    ctx.backend.firmware.holdOk = true
    const stopped = waitForState(ctx.sender, 'stopped')
    await ctx.sender.start({ lines: SAMPLE, estimatedTime: 12, dryRun: false })
    await ctx.controller.reset()
    const progress = await stopped
    expect(progress.state).toBe('stopped')
    expect(progress.errorMessage).toBeUndefined()
  })

  it('USB 断开中止发送，Job=error', async () => {
    const ctx = await setup()
    ctx.backend.firmware.holdOk = true
    const errored = once(ctx.sender, 'error')
    await ctx.sender.start({ lines: SAMPLE, estimatedTime: 12, dryRun: false })
    ctx.port.simulateUnplug()
    const progress = await errored
    expect(progress.state).toBe('error')
    expect(progress.errorMessage).toContain('断开')
    expect(ctx.sender.getProgress().sentLines).toBeLessThan(SAMPLE.length)
  })

  it('error 状态可从固件错误进入', async () => {
    const ctx = await setup()
    ctx.backend.firmware.holdOk = true
    const errored = once(ctx.sender, 'error')
    await ctx.sender.start({ lines: SAMPLE, estimatedTime: 12, dryRun: false })
    ctx.backend.firmware.simulateError(20)
    const progress = await errored
    expect(progress.state).toBe('error')
    expect(progress.errorMessage).toContain('无法执行')
    await tick()
    await tick()
    expect(ctx.port.written.some((chunk) => chunk === '!' || asText(chunk) === '!')).toBe(true)
    expect(ctx.port.written.some(isResetChunk)).toBe(true)
  })

  it('polling ? 不阻塞行发送', async () => {
    const ctx = await setup()
    ctx.backend.firmware.holdOk = true
    const completed = once(ctx.sender, 'completed')
    await ctx.sender.start({ lines: ['G21', 'G90', 'G0 X1 Y1'], estimatedTime: 2, dryRun: true })
    await ctx.controller.writeRealtime('?')
    expect(ctx.port.written.some((chunk) => chunk === '?' || asText(chunk) === '?')).toBe(true)
    expect(gcodeWrites(ctx.port.written).some((line) => line.startsWith('G21'))).toBe(true)
    await drain(ctx)
    await completed
  })

  it('低功率测试默认不自动跑，必须单独确认', async () => {
    const ctx = await setup()
    const before = ctx.port.written.length
    await expect(
      ctx.sender.start({
        lines: SAMPLE,
        estimatedTime: 12,
        dryRun: false,
        lowPowerTest: true,
      }),
    ).rejects.toThrow(/单独确认/)
    expect(ctx.port.written.length).toBe(before)
    expect(ctx.sender.getProgress().state).toBe('idle')
  })

  async function setup() {
    const backend = createMockEngraverBackend()
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push({ controller, serial })
    await serial.connect('mock://engraver')
    await controller.identify()
    const port = backend.backend.opened.get('mock://engraver')
    if (!port) throw new Error('missing port')
    const sender = new GrblSender(controller, serial)
    return { backend, serial, controller, port, sender }
  }
})

function once(sender: GrblSender, event: 'completed' | 'error' | 'paused'): Promise<JobProgress> {
  return new Promise((resolve) => {
    sender.on(event, (progress) => resolve(progress))
  })
}

function waitForState(sender: GrblSender, state: JobProgress['state']): Promise<JobProgress> {
  return new Promise((resolve) => {
    sender.on('progress', (progress) => {
      if (progress.state === state) resolve(progress)
    })
  })
}

async function drain(ctx: { backend: ReturnType<typeof createMockEngraverBackend> }): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await ctx.backend.firmware.releaseOk()
    await tick()
  }
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function gcodeWrites(written: Array<string | Buffer>): string[] {
  return written
    .map(asText)
    .map((text) => text.replace(/\r?\n$/, ''))
    .filter((text) => /^(G21|G90|G0 |G1 |M3 |M5)/.test(text))
}

function asText(chunk: string | Buffer): string {
  return typeof chunk === 'string' ? chunk : chunk.toString('utf8')
}

function isResetChunk(chunk: string | Buffer): boolean {
  if (typeof chunk === 'string') return chunk.length === 1 && chunk.charCodeAt(0) === 0x18
  return chunk.length === 1 && chunk[0] === 0x18
}
