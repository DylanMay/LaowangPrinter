import { discoverPorts, isLikelyEngraverPort, likelyPorts, parseDevSerialNames, toCalloutPath } from '../serial/portFilter'
import { describe, expect, it } from 'vitest'

describe('串口候选', () => {
  it('接受常见 USB 串口，忽略蓝牙和板载 ttyS', () => {
    expect(isLikelyEngraverPort('/dev/ttyUSB0')).toBe(true)
    expect(isLikelyEngraverPort('/dev/ttyACM0')).toBe(true)
    expect(isLikelyEngraverPort('COM3')).toBe(true)
    expect(isLikelyEngraverPort('mock://engraver')).toBe(true)
    expect(isLikelyEngraverPort('/dev/cu.SLAB_USBtoUART')).toBe(true)
    expect(isLikelyEngraverPort('/dev/cu.wchusbserial1410')).toBe(true)
    expect(isLikelyEngraverPort('/dev/cu.usbserial-110')).toBe(true)
    expect(isLikelyEngraverPort('/dev/cu.usbmodem1101')).toBe(true)
    expect(isLikelyEngraverPort('/dev/cu.HC-06')).toBe(true)
    expect(isLikelyEngraverPort('/dev/ttyS0')).toBe(false)
    expect(isLikelyEngraverPort('/dev/tty.Bluetooth-Incoming-Port')).toBe(false)
    expect(isLikelyEngraverPort('/dev/cu.Bluetooth-Incoming-Port')).toBe(false)
    expect(isLikelyEngraverPort('/dev/cu.debug-console')).toBe(false)
  })

  it('macOS 不用会卡住的 tty.*，改成 cu.*', () => {
    expect(isLikelyEngraverPort('/dev/tty.usbserial-110')).toBe(false)
    expect(isLikelyEngraverPort('/dev/tty.SLAB_USBtoUART')).toBe(false)
    expect(toCalloutPath('/dev/tty.usbserial-110')).toBe('/dev/cu.usbserial-110')
    expect(toCalloutPath('/dev/cu.usbserial-110')).toBe('/dev/cu.usbserial-110')
    expect(toCalloutPath('COM3')).toBe('COM3')
  })

  it('按厂商 ID 识别 CH340 / CP210 一类芯片', () => {
    expect(isLikelyEngraverPort({ path: '/dev/cu.usbserial-10', vendorId: '1A86' })).toBe(true)
    expect(isLikelyEngraverPort({ path: '/dev/cu.unknown', vendorId: '10c4' })).toBe(true)
    expect(isLikelyEngraverPort({ path: '/dev/cu.unknown', manufacturer: 'QinHeng Electronics' })).toBe(true)
    expect(isLikelyEngraverPort({ path: '/dev/cu.unknown', vendorId: '05ac' })).toBe(false)
  })

  it('同一设备的 tty 与 cu 只保留 cu，并排在前面', () => {
    const ports = likelyPorts([
      { path: '/dev/tty.Bluetooth-Incoming-Port' },
      { path: '/dev/tty.usbserial-110' },
      { path: '/dev/cu.usbserial-110' },
      { path: 'COM3' },
      { path: 'mock://engraver' },
    ])
    expect(ports.map((port) => port.path)).toEqual([
      '/dev/cu.usbserial-110',
      'COM3',
      'mock://engraver',
    ])
  })

  it('手动连接会把其余 cu 设备当作候选，并扫描 /dev 名称', () => {
    const listed = [
      { path: '/dev/cu.debug-console' },
      { path: '/dev/cu.MY-LASER' },
      { path: '/dev/cu.usbserial-110' },
    ]
    expect(discoverPorts(listed, 'auto').map((port) => port.path)).toEqual(['/dev/cu.usbserial-110'])
    expect(discoverPorts(listed, 'manual').map((port) => port.path)).toEqual([
      '/dev/cu.usbserial-110',
      '/dev/cu.MY-LASER',
    ])
    expect(parseDevSerialNames([
      'cu.usbserial-10',
      'tty.usbserial-10',
      'cu.Bluetooth-Incoming-Port',
      'cu.MY-LASER',
      'ttyUSB0',
      'cu.debug-console',
    ]).map((port) => port.path)).toEqual([
      '/dev/cu.usbserial-10',
      '/dev/cu.MY-LASER',
      '/dev/ttyUSB0',
    ])
  })
})
