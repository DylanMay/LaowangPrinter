import { formatUserError, toAppError } from '@shared/errors/appError'
import { DeviceService } from './DeviceService'
import { MockSerialBackend } from '../serial/MockSerialPort'
import { SerialManager } from '../serial/SerialManager'
import { describe, expect, it } from 'vitest'

describe('DeviceService', () => {
  it('没有设备时给出中文说明，不暴露端口名', async () => {
    const service = new DeviceService(new SerialManager(new MockSerialBackend()))
    const status = await service.connect()
    expect(status.state).toBe('disconnected')
    expect(status.errorMessage).toContain('没有检测到雕刻机')
    expect(status.errorMessage).not.toMatch(/COM3|ttyUSB|Access denied/i)
  })

  it('连接成功后显示我的雕刻机', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    const service = new DeviceService(new SerialManager(backend))
    const status = await service.connect()
    expect(status.state).toBe('connected')
    expect(status.displayName).toBe('我的雕刻机')
  })

  it('端口占用映射为中文，不展示 Access denied', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    backend.busyPaths.add('mock://engraver')
    const service = new DeviceService(new SerialManager(backend))
    const status = await service.connect()
    expect(status.state).toBe('error')
    expect(status.errorMessage).toContain('无法连接雕刻机')
    expect(status.errorMessage).toContain('其他软件')
    expect(status.errorMessage).not.toMatch(/Access denied|EACCES|SerialPortError/i)
  })

  it('启动监听后自动连接已插入的雕刻机', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    const service = new DeviceService(new SerialManager(backend))
    await service.startWatching()
    expect(service.getStatus().state).toBe('connected')
    expect(service.getStatus().displayName).toBe('我的雕刻机')
    service.stopWatching()
  })

  it('USB 拔出后进入断开错误', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    const manager = new SerialManager(backend)
    const service = new DeviceService(manager)
    await service.connect()
    backend.opened.get('mock://engraver')?.simulateUnplug()
    const status = service.getStatus()
    expect(status.state).toBe('error')
    expect(status.errorMessage).toContain('雕刻机连接已断开')
    expect(status.errorMessage).toContain('USB')
  })
})

describe('toAppError', () => {
  it('把 Access denied 翻译成占用说明', () => {
    const error = toAppError(new Error('Access denied'))
    const text = formatUserError(error)
    expect(error.code).toBe('PORT_BUSY')
    expect(text).toContain('无法连接雕刻机')
    expect(text).not.toContain('Access denied')
  })
})
