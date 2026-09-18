import { SerialManager } from '../serial/SerialManager'
import { MockSerialBackend } from '../serial/MockSerialPort'
import { GrblController, STATUS_POLL_MS } from './GrblController'
import { createMockEngraverBackend } from './MockGRBL'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('GrblController', () => {
  const running: GrblController[] = []

  afterEach(() => {
    for (const controller of running.splice(0)) controller.stop()
    vi.useRealTimers()
  })

  it('识别固件后得到 MachineConfig，不含用户可见协议细节依赖', async () => {
    const backend = createMockEngraverBackend()
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    const config = await controller.identify()
    expect(config.grblVersion).toBe('1.1h')
    expect(config.maxPower).toBe(1000)
    expect(config.minPower).toBe(0)
    expect(config.laserMode).toBe(true)
    expect(config.widthMm).toBe(300)
    expect(config.heightMm).toBe(200)
    expect(config.needsSizeSetup).toBe(false)
    expect(config.parserState).toContain('G21')
    await serial.disconnect()
  })

  it('读不到行程时标记需要尺寸引导', async () => {
    const backend = createMockEngraverBackend({ omitTravel: true })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    const config = await controller.identify()
    expect(config.widthMm).toBeNull()
    expect(config.heightMm).toBeNull()
    expect(config.needsSizeSetup).toBe(true)
    const updated = controller.setWorkspaceSize(280, 180)
    expect(updated.needsSizeSetup).toBe(false)
    expect(updated.widthMm).toBe(280)
    await serial.disconnect()
  })

  it('状态查询不进入行队列，可与 sendLine 并存', async () => {
    const backend = createMockEngraverBackend({ delayOkMs: 1 })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    const port = backend.backend.opened.get('mock://engraver')
    if (!port) throw new Error('missing port')

    const pending = controller.sendLine('G0 X1')
    await controller.writeRealtime('?')
    expect(port.written.some((chunk) => chunk === '?' || chunk.toString() === '?')).toBe(true)
    expect(port.written.some((chunk) => chunk.toString().includes('G0 X1'))).toBe(true)
    await backend.firmware.releaseOk()
    await pending
    await serial.disconnect()
  })

  it('轮询间隔为 250ms，且使用实时 ?', async () => {
    vi.useFakeTimers()
    const backend = createMockEngraverBackend()
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    const port = backend.backend.opened.get('mock://engraver')
    if (!port) throw new Error('missing port')
    const before = port.written.filter((chunk) => chunk === '?').length
    await vi.advanceTimersByTimeAsync(STATUS_POLL_MS)
    const after = port.written.filter((chunk) => chunk === '?').length
    expect(after).toBeGreaterThan(before)
    controller.stop()
    vi.useRealTimers()
    await serial.disconnect()
  })

  it('非 GRBL 设备识别失败', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await expect(controller.identify()).rejects.toMatchObject({ code: 'NOT_GRBL' })
    await serial.disconnect()
  })

  it('home / jog / pause / resume / halt / reset，且不发送 M3', async () => {
    const backend = createMockEngraverBackend()
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    const port = backend.backend.opened.get('mock://engraver')
    if (!port) throw new Error('missing port')
    const resetsBefore = port.written.filter(isResetChunk).length

    await controller.home()
    await controller.jog({ axis: 'X', distanceMm: 1, feed: 100 })
    await controller.pause()
    await controller.resume()
    await controller.halt()
    expect(port.written.filter(isResetChunk).length).toBe(resetsBefore)
    await controller.reset()
    expect(port.written.filter(isResetChunk).length).toBeGreaterThan(resetsBefore)

    const blob = port.written.map(asText).join('')
    expect(blob).toContain('$H')
    expect(blob).toContain('$J=G91 G21 X1 F100')
    expect(blob).toContain('!')
    expect(blob).toContain('~')
    expect(blob).not.toMatch(/\bM3\b|\bM4\b/)
    await expect(controller.sendLine('M3 S200')).rejects.toMatchObject({ code: 'LASER_BLOCKED' })
    expect(port.written.map(asText).join('')).not.toMatch(/M3 S200/)
    await controller.sendLine('M3 S200', 1500, true)
    expect(port.written.map(asText).join('')).toMatch(/M3 S200/)
    await serial.disconnect()
  })
})

function asText(chunk: string | Buffer): string {
  return typeof chunk === 'string' ? chunk : chunk.toString('utf8')
}

function isResetChunk(chunk: string | Buffer): boolean {
  if (typeof chunk === 'string') return chunk.length === 1 && chunk.charCodeAt(0) === 0x18
  return chunk.length === 1 && chunk[0] === 0x18
}
