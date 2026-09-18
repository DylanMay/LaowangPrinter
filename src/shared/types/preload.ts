import type { DeviceStatus, PublicDevice } from './state'

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

export type DeviceEventName =
  | 'device:connected'
  | 'device:disconnected'
  | 'device:error'
  | 'device:status'

declare global {
  interface Window {
    app: AppApi
    device: DeviceApi
  }
}

export {}
