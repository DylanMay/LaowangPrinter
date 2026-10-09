import { MockSerialBackend } from '../serial/MockSerialPort'
import { createMockEngraverBackend, MockGRBL } from './MockGRBL'
import { describe, expect, it } from 'vitest'

describe('MockGRBL', () => {
  it('复位后给出欢迎信息，$$ / $G / ? 按协议应答', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    const opened = await backend.open('mock://engraver', 115200)
    const port = backend.opened.get('mock://engraver')
    if (!port) throw new Error('missing port')
    const lines: string[] = []
    opened.onData((chunk) => lines.push(chunk.toString('utf8')))
    const fw = new MockGRBL().attach(port)

    await port.write(Buffer.from([0x18]))
    expect(lines.join('')).toContain("Grbl 1.1h ['$' for help]")
    expect(lines.join('')).toContain("$X' to unlock")
    expect(fw.state).toBe('Alarm')

    await port.write('$$\n')
    expect(lines.join('')).toContain('$30=1000')
    expect(lines.join('')).toContain('$32=1')
    expect(lines.join('')).toContain('$130=300')
    expect(lines.join('')).toMatch(/ok/)

    await port.write('$G\n')
    expect(lines.join('')).toContain('[GC:')

    await port.write('M3 S200\n')
    expect(lines.join('')).toContain('error:9')
    expect(fw.state).toBe('Alarm')

    await port.write('$X\n')
    expect(fw.state).toBe('Idle')
    await port.write('?')
    expect(lines.join('')).toContain('<Idle|')
    expect(fw.state).toBe('Idle')
  })

  it('未知命令返回 error:20，可模拟 ALARM', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    const opened = await backend.open('mock://engraver', 115200)
    const port = backend.opened.get('mock://engraver')
    if (!port) throw new Error('missing port')
    const lines: string[] = []
    opened.onData((chunk) => lines.push(chunk.toString('utf8')))
    const fw = new MockGRBL().attach(port)

    await port.write('G99\n')
    expect(lines.join('')).toContain('error:20')

    fw.simulateAlarm(1)
    expect(lines.join('')).toContain('ALARM:1')
  })

  it('运动中复位会 ALARM:3，暂停时不执行普通指令', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    const opened = await backend.open('mock://engraver', 115200)
    const port = backend.opened.get('mock://engraver')
    if (!port) throw new Error('missing port')
    const lines: string[] = []
    opened.onData((chunk) => lines.push(chunk.toString('utf8')))
    const fw = new MockGRBL().attach(port)
    fw.state = 'Run'
    await port.write(Buffer.from([0x18]))
    expect(lines.join('')).toContain('ALARM:3')
    expect(fw.state).toBe('Alarm')

    fw.state = 'Hold'
    const before = lines.join('')
    await port.write('M3 S200\n')
    expect(lines.join('')).toBe(before)
    expect(fw.spindleOn).toBe(false)
  })

  it('createMockEngraverBackend 打开即挂上固件', async () => {
    const backend = createMockEngraverBackend()
    const ports = await backend.list()
    expect(ports[0]?.path).toBe('mock://engraver')
    const port = await backend.open('mock://engraver', 115200)
    await port.write(Buffer.from([0x18]))
    expect(backend.firmware.version).toBe('1.1h')
  })
})
