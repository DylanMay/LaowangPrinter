export type MachineConfig = {
  widthMm: number | null
  heightMm: number | null
  maxPower: number
  minPower: number
  laserMode: boolean
  grblVersion: string
  firmware: string
  settings: Record<number, number>
  parserState: string | null
  needsSizeSetup: boolean
}

export type WorkArea = {
  widthMm: number
  heightMm: number
}

export const JOG_STEPS = [1, 10, 100] as const
export const JOG_FEEDS = [100, 500, 1000, 3000] as const

export type JogAxis = 'X' | 'Y'
export type JogStep = (typeof JOG_STEPS)[number]
export type JogFeed = (typeof JOG_FEEDS)[number]

export type JogParams = {
  axis: JogAxis
  distanceMm: number
  feed: JogFeed
}

export type AdvancedSnapshot = {
  portPath: string | null
  baudRate: number
  firmware: string
  version: string
  widthMm: number | null
  heightMm: number | null
  maxPower: number
  laserMode: boolean
  serialLog: string[]
}

export type DiagnosticsSnapshot = {
  text: string
}
