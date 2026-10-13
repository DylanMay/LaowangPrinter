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
    expect(blob).toContain('$X')
    expect(blob).toContain('G0 X0 Y0')
    expect(blob).toContain('$J=G91 G21 X1 F100')
    expect(blob).toContain('!')
    expect(blob).toContain('~')
    expect(blob).not.toMatch(/\bM3\b|\bM4\b/)
    await expect(controller.sendLine('M3 S200')).rejects.toMatchObject({ code: 'LASER_BLOCKED' })
    expect(port.written.map(asText).join('')).not.toMatch(/M3 S200/)
    await controller.sendLine('M3 S200', 1500, true)
    expect(port.written.map(asText).join('')).toMatch(/M3 S200/)
    await controller.setLaser(true)
    expect(controller.laserOn).toBe(true)
    expect(port.written.map(asText).join('')).toMatch(/M3 S200/)
    await controller.setLaser(false)
    expect(controller.laserOn).toBe(false)
    expect(port.written.map(asText).join('')).toMatch(/\bM5\b/)
    await serial.disconnect()
  })

  it('停止时先停住再复位解锁，结束后不停在锁定', async () => {
    const backend = createMockEngraverBackend({ settings: { 22: 0, 130: 50, 131: 200 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    const resetsBefore = serialWrites(backend).split('\x18').length
    await controller.abortCycle()
    expect(backend.firmware.state).toBe('Idle')
    expect(controller.machineState).not.toBe('alarm')
    const blob = serialWrites(backend)
    expect(blob).toContain('!')
    expect(blob.split('\x18').length).toBeGreaterThan(resetsBefore)
    expect(blob).toMatch(/\$X/)
    await serial.disconnect()
  })

  it('停止时等到减速完成再复位，避免还在动时复位', async () => {
    const backend = createMockEngraverBackend({
      settings: { 22: 0, 130: 50, 131: 200 },
      delayMotionMs: 400,
      holdSettleMs: 80,
    })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    const motion = controller.sendLine('G1 X10 F500', 5000)
    await waitUntil(() => backend.firmware.state === 'Run')
    await controller.abortCycle()
    expect(controller.lastAlarmCode).not.toBe('ALARM:3')
    expect(backend.firmware.state).toBe('Idle')
    expect(controller.machineState).not.toBe('alarm')
    await motion.catch(() => undefined)
    await serial.disconnect()
  })

  it('正式雕刻前恢复激光模式，但不会关掉已打开的激光', async () => {
    const backend = createMockEngraverBackend({ settings: { 22: 0, 32: 1 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    await controller.setLaser(true)
    expect(backend.firmware.settings[32]).toBe(0)
    expect(backend.firmware.spindleOn).toBe(true)
    const before = serialWrites(backend)
    await controller.prepareEngrave()
    const added = serialWrites(backend).slice(before.length)
    expect(added).toMatch(/\$32=1/)
    expect(added).not.toMatch(/\bM5\b/)
    expect(backend.firmware.spindleOn).toBe(true)
    expect(backend.firmware.settings[32]).toBe(1)
    expect(controller.laserOn).toBe(false)
    await serial.disconnect()
  })

  it('暂停中开激光会先停干净再开光', async () => {
    const backend = createMockEngraverBackend({ settings: { 22: 0 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    backend.firmware.state = 'Hold'
    await controller.writeRealtime('?')
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(controller.machineState).toBe('paused')
    await controller.setLaser(true)
    expect(controller.laserOn).toBe(true)
    expect(backend.firmware.state).toBe('Idle')
    expect(serialWrites(backend)).toMatch(/M3 S200/)
    await serial.disconnect()
  })

  it('上电锁定时自动解除，之后才能开激光', async () => {
    const backend = createMockEngraverBackend({ settings: { 22: 0, 130: 50, 131: 200 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    expect(backend.firmware.state).toBe('Idle')
    const blob = serialWrites(backend)
    expect(blob).toMatch(/\$X/)
    await controller.setLaser(true)
    expect(controller.laserOn).toBe(true)
    expect(serialWrites(backend)).toMatch(/M3 S200/)
    await serial.disconnect()
  })

  it('连接后把过高的最小功率清零并打开激光模式', async () => {
    const backend = createMockEngraverBackend({ settings: { 30: 1000, 31: 1000, 32: 0 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    const config = await controller.identify()
    expect(config.minPower).toBe(0)
    expect(config.laserMode).toBe(true)
    expect(config.maxPower).toBe(1000)
    const blob = serialWrites(backend)
    expect(blob).toMatch(/\$31=0/)
    expect(blob).toMatch(/\$32=1/)
    await serial.disconnect()
  })

  it('小床或出厂行程时关掉误报限位', async () => {
    const backend = createMockEngraverBackend({ settings: { 20: 1, 21: 1, 130: 250, 131: 250 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    const blob = serialWrites(backend)
    expect(blob).toMatch(/\$20=0/)
    expect(blob).toMatch(/\$21=0/)
    expect(controller.lastAlarmCode).toBeNull()
    await serial.disconnect()
  })

  it('小床上下步数跟左右不一致时改成一样，正方形才不会被拉长', async () => {
    const backend = createMockEngraverBackend({
      settings: { 100: 106.666, 101: 250, 130: 50, 131: 200 },
    })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    expect(backend.firmware.settings[101]).toBe(106.666)
    expect(backend.firmware.settings[100]).toBe(106.666)
    expect(serialWrites(backend)).toMatch(/\$101=106\.666/)
    await serial.disconnect()
  })

  it('大床两轴步数不同时保持原样', async () => {
    const backend = createMockEngraverBackend({
      settings: { 100: 80, 101: 250, 130: 300, 131: 200 },
    })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    expect(backend.firmware.settings[101]).toBe(250)
    expect(serialWrites(backend)).not.toMatch(/\$101=/)
    await serial.disconnect()
  })

  it('窄床加速度过低时抬高，短线才能走满速度', async () => {
    const backend = createMockEngraverBackend({
      settings: { 120: 10, 121: 10, 122: 10, 130: 50, 131: 200 },
    })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    expect(backend.firmware.settings[120]).toBe(300)
    expect(backend.firmware.settings[121]).toBe(300)
    expect(backend.firmware.settings[122]).toBe(10)
    const blob = serialWrites(backend)
    expect(blob).toMatch(/\$120=300/)
    expect(blob).toMatch(/\$121=300/)
    expect(blob).not.toMatch(/\$122=/)
    await serial.disconnect()
  })

  it('窄床加速度已经够快时不改，大床过慢也不改', async () => {
    const fast = createMockEngraverBackend({
      settings: { 120: 800, 121: 800, 130: 50, 131: 200 },
    })
    const fastSerial = new SerialManager(fast)
    const fastController = new GrblController(fastSerial)
    running.push(fastController)
    await fastSerial.connect('mock://engraver')
    await fastController.identify()
    expect(fast.firmware.settings[120]).toBe(800)
    expect(serialWrites(fast)).not.toMatch(/\$120=/)
    await fastSerial.disconnect()

    const wide = createMockEngraverBackend({
      settings: { 120: 10, 121: 10, 130: 300, 131: 200 },
    })
    const wideSerial = new SerialManager(wide)
    const wideController = new GrblController(wideSerial)
    running.push(wideController)
    await wideSerial.connect('mock://engraver')
    await wideController.identify()
    expect(wide.firmware.settings[120]).toBe(10)
    expect(wide.firmware.settings[121]).toBe(10)
    expect(serialWrites(wide)).not.toMatch(/\$120=/)
    await wideSerial.disconnect()
  })

  it('关光前不会把排队前的 Idle 当成已经停稳', async () => {
    const backend = createMockEngraverBackend({ delayMotionMs: 450, settings: { 22: 0, 130: 50, 131: 200 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    expect(controller.machineState).toBe('idle')
    const pending = controller.sendLine('G1 X40 F120', 5000)
    await waitUntil(() => backend.firmware.state === 'Run')
    const started = Date.now()
    await controller.waitUntilIdle(3000)
    expect(Date.now() - started).toBeGreaterThanOrEqual(250)
    expect(backend.firmware.state).toBe('Idle')
    await pending
    await serial.disconnect()
  })

  it('运动一直不停时等待会超时，而不是立刻返回', async () => {
    const backend = createMockEngraverBackend({ delayMotionMs: 5000, settings: { 22: 0, 130: 50, 131: 200 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    const pending = controller.sendLine('G1 X40 F120', 5000)
    await waitUntil(() => backend.firmware.state === 'Run')
    await expect(controller.waitUntilIdle(400)).rejects.toThrow(/GRBL timeout/)
    await pending
    await serial.disconnect()
  })

  it('没有激光模式参数的旧固件仍能完成识别', async () => {
    const backend = createMockEngraverBackend({ unknownSettings: [32] })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    const config = await controller.identify()
    expect(config.laserMode).toBe(false)
    expect(config.minPower).toBe(0)
    expect(config.grblVersion).toBe('1.1h')
    await serial.disconnect()
  })

  it('关光前不把上一刀的空闲当成已经停，会等到进给真正结束', async () => {
    const backend = createMockEngraverBackend({
      settings: { 22: 0, 130: 50, 131: 200 },
      delayMotionMs: 400,
    })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    const motion = controller.sendLine('G1 X10 F120', 5000)
    await waitUntil(() => backend.firmware.state === 'Run')
    const started = Date.now()
    await controller.waitUntilIdle()
    expect(Date.now() - started).toBeGreaterThan(250)
    expect(backend.firmware.state).toBe('Idle')
    await motion
    await serial.disconnect()
  })

  it('关光前不会把还没起步的空闲当成短线已经结束', async () => {
    const backend = createMockEngraverBackend({ settings: { 22: 0, 130: 50, 131: 200 } })
    const serial = new SerialManager(backend)
    const controller = new GrblController(serial)
    running.push(controller)
    await serial.connect('mock://engraver')
    await controller.identify()
    const started = Date.now()
    await controller.waitUntilIdle(3000, () => false, true)
    const elapsed = Date.now() - started
    expect(elapsed).toBeGreaterThanOrEqual(700)
    expect(elapsed).toBeLessThan(2500)
    await serial.disconnect()
  })
})

function serialWrites(backend: ReturnType<typeof createMockEngraverBackend>): string {
  const port = backend.backend.opened.get('mock://engraver')
  if (!port) throw new Error('missing port')
  return port.written.map(asText).join('')
}

function asText(chunk: string | Buffer): string {
  return typeof chunk === 'string' ? chunk : chunk.toString('utf8')
}

function isResetChunk(chunk: string | Buffer): boolean {
  if (typeof chunk === 'string') return chunk.length === 1 && chunk.charCodeAt(0) === 0x18
  return chunk.length === 1 && chunk[0] === 0x18
}

function waitUntil(predicate: () => boolean, ms = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - started >= ms) {
        clearInterval(timer)
        reject(new Error('timeout'))
      }
    }, 10)
  })
}
