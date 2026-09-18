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
