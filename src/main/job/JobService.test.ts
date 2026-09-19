import { COPY } from '@shared/copy'
import { afterEach, describe, expect, it } from 'vitest'
import { DeviceService } from '../device/DeviceService'
import { createMockEngraverBackend } from '../grbl/MockGRBL'
import { SerialManager } from '../serial/SerialManager'
import { JobService } from './JobService'

const SAMPLE = ['G21', 'G90', 'G0 X10 Y10', 'M3 S200', 'G1 X20 Y10 F1000', 'M5']

describe('JobService', () => {
  const services: DeviceService[] = []

  afterEach(async () => {
    for (const service of services.splice(0)) {
      service.stopWatching()
      await service.disconnect()
    }
  })

  it('正式雕刻没有确认时拒绝，不发送开光指令', async () => {
    const ctx = await setup()
    const before = gcodeWrites(ctx.port.written).length
    await expect(ctx.job.start({ lines: SAMPLE, estimatedTime: 4, dryRun: false })).rejects.toThrow(
      COPY.needsConfirm,
    )
    expect(gcodeWrites(ctx.port.written).length).toBe(before)
    expect(ctx.job.getProgress().state).toBe('idle')
  })

  it('空载测试无需确认，且不会开光', async () => {
    const ctx = await setup()
    const completed = once(ctx.job)
    const progress = await ctx.job.start({ lines: SAMPLE, estimatedTime: 4, dryRun: true })
    expect(progress.state).toBe('running')
    await completed
    const blob = ctx.port.written.map(asText).join('')
    expect(blob).toMatch(/G1 X20 Y10 F1000/)
    expect(blob).not.toMatch(/\bM3\b/)
    expect(ctx.backend.firmware.spindleOn).toBe(false)
    expect(ctx.job.getProgress().state).toBe('completed')
  })

  it('确认后才允许正式雕刻开光', async () => {
    const ctx = await setup()
    const completed = once(ctx.job)
    await ctx.job.start({ lines: SAMPLE, estimatedTime: 4, dryRun: false, confirmed: true })
    await completed
    expect(ctx.port.written.map(asText).join('')).toMatch(/\bM3 S200\b/)
    expect(ctx.job.getProgress().state).toBe('completed')
  })

  async function setup() {
    const backend = createMockEngraverBackend()
    const serial = new SerialManager(backend)
    const device = new DeviceService(serial)
    services.push(device)
    await device.connect()
    const port = backend.backend.opened.get('mock://engraver')
    if (!port) throw new Error('missing port')
    return { backend, device, job: new JobService(device), port }
  }
})

function once(job: JobService): Promise<void> {
  return new Promise((resolve) => {
    job.on((event) => {
      if (event === 'job:completed') resolve()
    })
  })
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
