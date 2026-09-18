export type DeviceState =
  | 'disconnected'
  | 'detecting'
  | 'connecting'
  | 'connected'
  | 'error'

export type MachineState =
  | 'unknown'
  | 'idle'
  | 'running'
  | 'paused'
  | 'alarm'
  | 'homing'
  | 'disconnected'

export type JobState =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'completed'

export type DeviceStatus = {
  state: DeviceState
  displayName?: string
  errorMessage?: string
  machineState?: MachineState
  needsSizeSetup?: boolean
  workArea?: {
    widthMm: number
    heightMm: number
  }
}

export type PublicDevice = {
  id: string
  name: string
}

export type AppInfo = {
  name: string
  version: string
}
