import { isLikelyEngraverPort } from './DeviceService'
import { describe, expect, it } from 'vitest'

describe('串口候选', () => {
  it('接受常见 USB 串口，忽略蓝牙和板载 ttyS', () => {
    expect(isLikelyEngraverPort('/dev/ttyUSB0')).toBe(true)
    expect(isLikelyEngraverPort('/dev/ttyACM0')).toBe(true)
    expect(isLikelyEngraverPort('COM3')).toBe(true)
    expect(isLikelyEngraverPort('mock://engraver')).toBe(true)
    expect(isLikelyEngraverPort('/dev/tty.SLAB_USBtoUART')).toBe(true)
    expect(isLikelyEngraverPort('/dev/cu.wchusbserial1410')).toBe(true)
    expect(isLikelyEngraverPort('/dev/ttyS0')).toBe(false)
    expect(isLikelyEngraverPort('/dev/tty.Bluetooth-Incoming-Port')).toBe(false)
  })
})
