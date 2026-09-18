import type { DeviceStatus, PublicDevice } from './state'
import type { MachineConfig } from './machine'

export type AppApi = {
  getName: () => string
  getVersion: () => Promise<string>
}

export type DeviceApi = {
  list: () => Promise<PublicDevice[]>
  connect: (id?: string) => Promise<DeviceStatus>
  disconnect: () => Promise<DeviceStatus>
  getStatus: () => Promise<DeviceStatus>
  on: (event: DeviceEventName, listener: (status: DeviceStatus) => void) => () => void
}

export type MachineApi = {
  getConfig: () => Promise<MachineConfig | null>
  setSize: (widthMm: number, heightMm: number) => Promise<DeviceStatus>
  home: () => Promise<DeviceStatus>
  jog: (axis: 'X' | 'Y', distanceMm: number, feed: 100 | 500 | 1000 | 3000) => Promise<DeviceStatus>
  pause: () => Promise<DeviceStatus>
  resume: () => Promise<DeviceStatus>
  stop: () => Promise<DeviceStatus>
  reset: () => Promise<DeviceStatus>
  testMove: () => Promise<DeviceStatus>
}

export type DeviceEventName =
  | 'device:connected'
  | 'device:disconnected'
  | 'device:error'
  | 'device:status'

declare global {
  interface Window {
    app: AppApi
    device: DeviceApi
    machine: MachineApi
  }
}

export {}
