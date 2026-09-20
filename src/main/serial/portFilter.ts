import type { SerialPortInfo } from './types'

const USB_SERIAL_VENDORS = new Set([
  '1a86', // QinHeng CH340 / CH9102，国内雕刻机很常见
  '10c4', // Silicon Labs CP210x
  '0403', // FTDI
  '067b', // Prolific
  '2341', // Arduino
  '2a03', // Arduino.org
  '1b4f', // SparkFun
  '239a', // Adafruit
  '303a', // Espressif
  '0483', // STMicro
  '16c0',
  '03eb',
  '2e8a',
])

export function toCalloutPath(path: string): string {
  if (path.startsWith('/dev/tty.')) {
    return `/dev/cu.${path.slice('/dev/tty.'.length)}`
  }
  return path
}

export function isLikelyEngraverPort(pathOrPort: string | SerialPortInfo): boolean {
  const port = typeof pathOrPort === 'string' ? { path: pathOrPort } : pathOrPort
  const value = port.path.toLowerCase()
  if (value.includes('bluetooth') || value.includes('debug-console') || value.includes('incoming-port')) {
    return false
  }
  if (/ttys\d+$/.test(value)) return false
  // macOS 的 /dev/tty.* 会等载波，打开后像死机。只用 cu.*。
  if (value.startsWith('/dev/tty.')) return false
  if (value.startsWith('mock://')) return true
  if (/ttyusb|ttyacm|usbserial|usbmodem|wchusb|slab_usb|usbto|ch34|cp210|cu\.usb/.test(value)) {
    return true
  }
  if (/^com\d+/.test(value)) return true
  const vendorId = port.vendorId?.replace(/^0x/i, '').toLowerCase()
  if (vendorId && USB_SERIAL_VENDORS.has(vendorId)) return true
  const manufacturer = port.manufacturer?.toLowerCase() ?? ''
  if (/wch|qinheng|ch340|ch910|silicon labs|cp210|ftdi|arduino|espressif/.test(manufacturer)) {
    return true
  }
  return false
}

export function likelyPorts(ports: SerialPortInfo[]): SerialPortInfo[] {
  const seen = new Set<string>()
  const ranked: Array<SerialPortInfo & { score: number }> = []
  for (const port of ports) {
    const normalized = { ...port, path: toCalloutPath(port.path) }
    if (!isLikelyEngraverPort(normalized) || seen.has(normalized.path)) continue
    seen.add(normalized.path)
    ranked.push({ ...normalized, score: scorePort(normalized.path) })
  }
  ranked.sort((a, b) => a.score - b.score)
  return ranked.map((port) => ({
    path: port.path,
    manufacturer: port.manufacturer,
    serialNumber: port.serialNumber,
    vendorId: port.vendorId,
    productId: port.productId,
  }))
}

function scorePort(path: string): number {
  const value = path.toLowerCase()
  if (value.includes('/dev/cu.')) return 0
  if (/usbserial|usbmodem|wchusb|ttyusb|ttyacm/.test(value)) return 1
  if (/^com\d+/.test(value)) return 2
  return 3
}
