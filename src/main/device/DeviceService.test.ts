import { formatUserError, toAppError } from '@shared/errors/appError'
import { DeviceService } from './DeviceService'
import { GrblCommandError } from '../grbl/errors'
import { createMockEngraverBackend } from '../grbl/MockGRBL'
import { MockSerialBackend } from '../serial/MockSerialPort'
import { SerialManager } from '../serial/SerialManager'
import { afterEach, describe, expect, it } from 'vitest'

const services: DeviceService[] = []

function track(service: DeviceService): DeviceService {
  services.push(service)
  return service
}

afterEach(async () => {
  for (const service of services.splice(0)) {
    service.stopWatching()
    await service.disconnect()
  }
})

describe('DeviceService', () => {
  it('没有设备时给出中文说明，不暴露端口名', async () => {
    const service = track(new DeviceService(new SerialManager(new MockSerialBackend())))
    const status = await service.connect()
    expect(status.state).toBe('disconnected')
    expect(status.errorMessage).toContain('没有检测到雕刻机')
    expect(status.errorMessage).not.toMatch(/COM3|ttyUSB|Access denied|GRBL/i)
  })

  it('识别固件后连接成功，显示我的雕刻机，并得到工作区域', async () => {
    const service = track(new DeviceService(new SerialManager(createMockEngraverBackend())))
    const status = await service.connect()
    expect(status.state).toBe('connected')
    expect(status.displayName).toBe('我的雕刻机')
    expect(status.needsSizeSetup).toBe(false)
    expect(status.workArea).toEqual({ widthMm: 300, heightMm: 200 })
    const config = service.getConfig()
    expect(config?.maxPower).toBe(1000)
    expect(config?.laserMode).toBe(true)
    expect(JSON.stringify(status)).not.toMatch(/COM3|115200|Grbl 1\.1/i)
  })

  it('读不到尺寸时进入最小设置引导', async () => {
    const service = track(
      new DeviceService(new SerialManager(createMockEngraverBackend({ omitTravel: true }))),
    )
    const status = await service.connect()
    expect(status.state).toBe('connected')
    expect(status.needsSizeSetup).toBe(true)
    const next = await service.setSize(280, 160)
    expect(next.needsSizeSetup).toBe(false)
    expect(next.workArea).toEqual({ widthMm: 280, heightMm: 160 })
  })

  it('非雕刻机固件当作没有检测到雕刻机', async () => {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver' }]
    const service = track(new DeviceService(new SerialManager(backend)))
    const status = await service.connect()
    expect(status.state).toBe('disconnected')
    expect(status.errorMessage).toContain('没有检测到雕刻机')
    expect(status.errorMessage).not.toMatch(/GRBL|error:20|1\.1h/i)
  })

  it('端口占用映射为中文，不展示 Access denied', async () => {
    const backend = createMockEngraverBackend()
    backend.backend.busyPaths.add('mock://engraver')
    const service = track(new DeviceService(new SerialManager(backend)))
    const status = await service.connect()
    expect(status.state).toBe('error')
    expect(status.errorMessage).toContain('无法连接雕刻机')
    expect(status.errorMessage).toContain('其他软件')
    expect(status.errorMessage).not.toMatch(/Access denied|EACCES|SerialPortError/i)
  })

  it('启动监听后自动连接已插入的雕刻机', async () => {
    const service = track(new DeviceService(new SerialManager(createMockEngraverBackend())))
    await service.startWatching()
    expect(service.getStatus().state).toBe('connected')
    expect(service.getStatus().displayName).toBe('我的雕刻机')
  })

  it('USB 拔出后进入断开错误', async () => {
    const backend = createMockEngraverBackend()
    const manager = new SerialManager(backend)
    const service = track(new DeviceService(manager))
    await service.connect()
    backend.backend.opened.get('mock://engraver')?.simulateUnplug()
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

  it('把 error:20 翻译成中文，不展示协议码', () => {
    const error = toAppError(new GrblCommandError(20))
    const text = formatUserError(error)
    expect(error.code).toBe('GRBL_ERROR')
    expect(text).toContain('无法执行当前动作')
    expect(text).not.toContain('error:20')
    expect(error.technicalDetail).toContain('error:20')
  })
})
