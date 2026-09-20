import { parseDevPathLines, usbLooksLikeSerialAdapter } from './darwinUsb'
import { describe, expect, it } from 'vitest'

describe('Mac USB 探测', () => {
  it('从 ls 输出解析 cu 设备', () => {
    const ports = parseDevPathLines(`/dev/cu.usbserial-110\n/dev/cu.Bluetooth-Incoming-Port\n`)
    expect(ports.map((port) => port.path)).toEqual([
      '/dev/cu.usbserial-110',
      '/dev/cu.Bluetooth-Incoming-Port',
    ])
  })

  it('从 ioreg 认出星光4N 的 CH340', () => {
    const tree = `
+-o USB2.0-Serial@00100000  <class AppleUSBDevice>
  | "idVendor" = 6790
  | "idProduct" = 29987
  | "USB Vendor Name" = "QinHeng Electronics"
  | "USB Product Name" = "USB2.0-Serial"
`
    expect(usbLooksLikeSerialAdapter(tree)).toBe(true)
    expect(usbLooksLikeSerialAdapter('+-o iPhone@...\n "idVendor" = 1452\n')).toBe(false)
  })
})
