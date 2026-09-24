import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SerialPortInfo } from './types'

const execFileAsync = promisify(execFile)

const USB_SERIAL_HINT =
  /ch340|ch910|qinheng|wchusb|usb2\.0-serial|cp210|ftdi|silicon labs|arduino nano/i

export function parseDevPathLines(text: string): SerialPortInfo[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('/dev/'))
    .map((path) => ({ path }))
}

export function usbLooksLikeSerialAdapter(tree: string): boolean {
  const text = tree.toLowerCase()
  if (/"idvendor"\s*=\s*(0x1a86|6790)\b/.test(text)) return true
  if (/"idvendor"\s*=\s*(0x4348|17224)\b/.test(text)) return true
  if (/"idvendor"\s*=\s*(0x0403|1027)\b/.test(text)) return true
  if (/"idvendor"\s*=\s*(0x10c4|4292)\b/.test(text)) return true
  return USB_SERIAL_HINT.test(text)
}

export async function listDevNodesViaShell(): Promise<SerialPortInfo[]> {
  try {
    const { stdout } = await execFileAsync(
      'sh',
      ['-c', 'ls -1 /dev/cu.* /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || true'],
      { timeout: 1500, encoding: 'utf8' },
    )
    return parseDevPathLines(stdout)
  } catch {
    return []
  }
}

export async function readDarwinUsbTree(): Promise<string> {
  if (process.platform !== 'darwin') return ''
  try {
    const { stdout } = await execFileAsync('ioreg', ['-p', 'IOUSB', '-l', '-w', '0'], {
      timeout: 2500,
      encoding: 'utf8',
      maxBuffer: 8_000_000,
    })
    return stdout
  } catch {
    return ''
  }
}
