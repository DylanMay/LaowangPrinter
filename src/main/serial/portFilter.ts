import type { SerialPortInfo } from './types'

const USB_SERIAL_VENDORS = new Set([
  '1a86', // QinHeng CH340 / CH9102，国内雕刻机很常见
  '4348', // CH340 旧厂商号
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

const NOISE = /bluetooth-incoming|debug-console|incoming-port|airpods|iphone|ipad|watch|headset|bths|mals|bgscc|wlan-debug|continuity|ibridge|dialup/

export function toCalloutPath(path: string): string {
  if (path.startsWith('/dev/tty.')) {
    return `/dev/cu.${path.slice('/dev/tty.'.length)}`
  }
  return path
}

export function isNoiseCallout(path: string): boolean {
  return NOISE.test(path.toLowerCase())
}

export function shouldScanDevNode(name: string): boolean {
  const value = name.toLowerCase()
  if (value.startsWith('tty.')) return false
  if (value.startsWith('cu.')) return !isNoiseCallout(value)
  return /^ttyusb\d+$/.test(value) || /^ttyacm\d+$/.test(value)
}

export function parseDevSerialNames(names: string[]): SerialPortInfo[] {
  return names.filter(shouldScanDevNode).map((name) => ({ path: `/dev/${name}` }))
}

export function mergePortLists(...lists: SerialPortInfo[][]): SerialPortInfo[] {
  const map = new Map<string, SerialPortInfo>()
  for (const list of lists) {
    for (const port of list) {
      const path = toCalloutPath(port.path)
      const prev = map.get(path)
      map.set(path, {
        path,
        manufacturer: port.manufacturer ?? prev?.manufacturer,
        serialNumber: port.serialNumber ?? prev?.serialNumber,
        vendorId: port.vendorId ?? prev?.vendorId,
        productId: port.productId ?? prev?.productId,
      })
    }
  }
  return [...map.values()]
}

export function isLikelyEngraverPort(pathOrPort: string | SerialPortInfo): boolean {
  const port = typeof pathOrPort === 'string' ? { path: pathOrPort } : pathOrPort
  const value = port.path.toLowerCase()
  if (isNoiseCallout(value)) return false
  if (/ttys\d+$/.test(value)) return false
  // macOS 的 /dev/tty.* 会等载波，打开后像死机。只用 cu.*。
  if (value.startsWith('/dev/tty.')) return false
  if (value.startsWith('mock://')) return true
  if (/ttyusb|ttyacm|usbserial|usbmodem|wchusb|slab_usb|usbto|ch34|cp210|cu\.usb|hc-0[56]|xingguang|starlight/.test(value)) {
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
  return rankPorts(ports.filter((port) => isLikelyEngraverPort({ ...port, path: toCalloutPath(port.path) })))
}

export function fallbackPorts(ports: SerialPortInfo[]): SerialPortInfo[] {
  const seen = new Set<string>()
  const collected: SerialPortInfo[] = []
  for (const port of ports) {
    const path = toCalloutPath(port.path)
    const value = path.toLowerCase()
    if (isNoiseCallout(value) || value.startsWith('/dev/tty.') || /ttys\d+$/.test(value)) continue
    const usable =
      value.startsWith('/dev/cu.') ||
      /^com\d+/.test(value) ||
      /ttyusb|ttyacm/.test(value) ||
      value.startsWith('mock://')
    if (!usable || seen.has(path)) continue
    seen.add(path)
    collected.push({ ...port, path })
  }
  return rankPorts(collected)
}

export function discoverPorts(ports: SerialPortInfo[], mode: 'auto' | 'manual'): SerialPortInfo[] {
  const likely = likelyPorts(ports)
  if (mode === 'auto') return likely
  return uniqueByPath([...likely, ...fallbackPorts(ports)])
}

function rankPorts(ports: SerialPortInfo[]): SerialPortInfo[] {
  const seen = new Set<string>()
  const ranked: Array<SerialPortInfo & { score: number }> = []
  for (const port of ports) {
    const normalized = { ...port, path: toCalloutPath(port.path) }
    if (seen.has(normalized.path)) continue
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

function uniqueByPath(ports: SerialPortInfo[]): SerialPortInfo[] {
  const seen = new Set<string>()
  const result: SerialPortInfo[] = []
  for (const port of ports) {
    if (seen.has(port.path)) continue
    seen.add(port.path)
    result.push(port)
  }
  return result
}

function scorePort(path: string): number {
  const value = path.toLowerCase()
  if (value.includes('/dev/cu.')) return 0
  if (/usbserial|usbmodem|wchusb|ttyusb|ttyacm/.test(value)) return 1
  if (/^com\d+/.test(value)) return 2
  return 3
}
