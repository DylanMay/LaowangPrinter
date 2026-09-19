import { GRBL_RUN_STATES, type GrblMessage, type GrblRunState } from './types'

export function parseGrblLine(rawLine: string): GrblMessage {
  const line = rawLine.replace(/\r$/, '').trim()
  if (!line) return { kind: 'unknown', raw: rawLine }

  if (line === 'ok') return { kind: 'ok' }

  const error = /^error:\s*(\d+)/i.exec(line)
  if (error) return { kind: 'error', code: Number(error[1]) }

  const alarm = /^ALARM:\s*(\d+)/i.exec(line)
  if (alarm) return { kind: 'alarm', code: Number(alarm[1]) }

  if (line.startsWith('<') && line.endsWith('>')) {
    return parseStatus(line)
  }

  const setting = /^(\$\d+)\s*=\s*(-?\d+(?:\.\d+)?)/.exec(line)
  if (setting) return { kind: 'setting', key: setting[1], value: Number(setting[2]) }

  const welcome = /^Grbl\s+(\S+)/i.exec(line)
  if (welcome) return { kind: 'version', version: welcome[1] }

  const ver = /^\[VER:\s*([^:\]]+)/i.exec(line)
  if (ver) return { kind: 'version', version: shortenVersion(ver[1].trim()) }

  const gc = /^\[GC:(.*)\]$/i.exec(line)
  if (gc) return { kind: 'parserState', raw: gc[1] }

  if (line.startsWith('[') && line.endsWith(']')) {
    return { kind: 'feedback', raw: line }
  }

  return { kind: 'unknown', raw: line }
}

export function feedGrblBuffer(
  buffer: string,
  chunk: string | Buffer,
): { buffer: string; lines: string[] } {
  const next = buffer + (typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
  const lines: string[] = []
  const parts = next.split(/\n/)
  const rest = parts.pop() ?? ''
  for (const part of parts) {
    const line = part.replace(/\r$/, '')
    if (line.length > 0) lines.push(line)
  }
  return { buffer: rest, lines }
}

function parseStatus(line: string): GrblMessage {
  const inner = line.slice(1, -1)
  const parts = inner.split('|')
  const state = normalizeRunState(parts[0]?.split(':')[0] ?? 'Idle')
  let position = { x: 0, y: 0, z: 0 }
  let feed = 0
  let spindle = 0

  for (const part of parts.slice(1)) {
    const colon = part.indexOf(':')
    const key = colon >= 0 ? part.slice(0, colon) : part
    const value = colon >= 0 ? part.slice(colon + 1) : ''
    if (key === 'MPos' || key === 'WPos') {
      const [x = 0, y = 0, z = 0] = value.split(',').map(Number)
      position = { x, y, z }
    }
    if (key === 'FS') {
      const [nextFeed = 0, nextSpindle = 0] = value.split(',').map(Number)
      feed = nextFeed
      spindle = nextSpindle
    }
  }

  return { kind: 'status', report: { state, position, feed, spindle } }
}

function normalizeRunState(token: string): GrblRunState {
  const match = GRBL_RUN_STATES.find((state) => state.toLowerCase() === token.toLowerCase())
  return match ?? 'Idle'
}

function shortenVersion(token: string): string {
  const match = /^(\d+\.\d+[A-Za-z]?)/.exec(token)
  return match?.[1] ?? token
}
