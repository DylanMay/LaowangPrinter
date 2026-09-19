import { env } from 'node:process'
import { createMockEngraverBackend } from '../grbl/MockGRBL'
import { NodeSerialBackend } from './SerialPortWrapper'
import type { SerialBackend } from './types'

export function createSerialBackend(): SerialBackend {
  if (env.LAOWANG_SERIAL === 'mock') {
    return createMockEngraverBackend({
      omitTravel: env.LAOWANG_MOCK_NOSIZE === '1',
      delayMotionMs: 180,
    })
  }
  return new NodeSerialBackend()
}
