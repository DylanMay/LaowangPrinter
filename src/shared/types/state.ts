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
}

export type AppInfo = {
  name: string
  version: string
}
