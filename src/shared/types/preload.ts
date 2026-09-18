import type { DeviceStatus } from './state'

export type AppApi = {
  getName: () => string
  getVersion: () => Promise<string>
}

export type DeviceApi = {
  getStatus: () => Promise<DeviceStatus>
}

declare global {
  interface Window {
    app: AppApi
    device: DeviceApi
  }
}

export {}
