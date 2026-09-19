import { env } from 'node:process'
import { createSerialBackend } from './createBackend'
import { afterEach, describe, expect, it } from 'vitest'

describe('createSerialBackend', () => {
  afterEach(() => {
    delete env.LAOWANG_SERIAL
  })

  it('LAOWANG_SERIAL=mock 时使用模拟设备', async () => {
    env.LAOWANG_SERIAL = 'mock'
    const ports = await createSerialBackend().list()
    expect(ports).toEqual([{ path: 'mock://engraver', manufacturer: 'Mock' }])
  })
})
