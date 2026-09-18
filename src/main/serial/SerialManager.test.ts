import { DEFAULT_BAUD_RATE } from './types'
import { MockSerialBackend } from './MockSerialPort'
import { SerialManager } from './SerialManager'
import { describe, expect, it } from 'vitest'

function backendWithPort(path = 'mock://engraver') {
  const backend = new MockSerialBackend()
  backend.ports = [{ path, manufacturer: 'Mock' }]
  return { backend, path }
}

describe('MockSerialPort / SerialManager', () => {
  it('列出、连接、写入、断开', async () => {
    const { backend, path } = backendWithPort()
    const manager = new SerialManager(backend)
    expect(await manager.listPorts()).toEqual([{ path, manufacturer: 'Mock' }])

    await manager.connect(path)
    expect(manager.connected).toBe(true)
    expect(manager.baudRate).toBe(DEFAULT_BAUD_RATE)

    await manager.write('G0 X0')
    expect(backend.opened.get(path)?.written).toEqual(['G0 X0'])

    await manager.disconnect()
    expect(manager.connected).toBe(false)
  })

  it('USB 拔出触发 close / disconnected', async () => {
    const { backend, path } = backendWithPort()
    const manager = new SerialManager(backend)
    const reasons: string[] = []
    manager.on('disconnected', ({ reason }) => reasons.push(reason))
    await manager.connect(path)
    backend.opened.get(path)?.simulateUnplug()
    expect(manager.connected).toBe(false)
    expect(reasons).toEqual(['unplug'])
  })

  it('端口占用抛出 PORT_BUSY', async () => {
    const { backend, path } = backendWithPort()
    backend.busyPaths.add(path)
    const manager = new SerialManager(backend)
    await expect(manager.connect(path)).rejects.toMatchObject({ code: 'PORT_BUSY' })
  })
})
