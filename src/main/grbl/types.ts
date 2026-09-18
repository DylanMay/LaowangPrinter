export const GRBL_RUN_STATES = [
  'Idle',
  'Run',
  'Hold',
  'Jog',
  'Alarm',
  'Door',
  'Check',
  'Home',
  'Sleep',
] as const

export type GrblRunState = (typeof GRBL_RUN_STATES)[number]

export type GrblPosition = {
  x: number
  y: number
  z: number
}

export type GrblStatusReport = {
  state: GrblRunState
  position: GrblPosition
  feed: number
  spindle: number
}

export type GrblMessage =
  | { kind: 'ok' }
  | { kind: 'error'; code: number }
  | { kind: 'alarm'; code: number }
  | { kind: 'status'; report: GrblStatusReport }
  | { kind: 'setting'; key: string; value: number }
  | { kind: 'version'; version: string }
  | { kind: 'parserState'; raw: string }
  | { kind: 'feedback'; raw: string }
  | { kind: 'unknown'; raw: string }

export const STATUS_POLL_MS = 250
export const REALTIME_STATUS = '?'
export const REALTIME_RESET = 0x18
