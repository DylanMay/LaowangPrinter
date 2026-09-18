import { MockSerialBackend } from './MockSerialPort'
import { NodeSerialBackend } from './SerialPortWrapper'
import type { SerialBackend } from './types'

export function createSerialBackend(): SerialBackend {
  if (process.env.LAOWANG_SERIAL === 'mock') {
    const backend = new MockSerialBackend()
    backend.ports = [{ path: 'mock://engraver', manufacturer: 'Mock' }]
    return backend
  }
  return new NodeSerialBackend()
}
