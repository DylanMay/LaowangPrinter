import type { DeviceStatus, PublicDevice } from './state'
import type { AdvancedSnapshot, DiagnosticsSnapshot, MachineConfig } from './machine'
import type { OpenSvgResult } from './svg'
import type { JobEventName, JobProgress, JobStartOptions } from './job'

export type { JobEventName, JobProgress, JobStartOptions }

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
  getAdvanced: () => Promise<AdvancedSnapshot>
  getDiagnostics: () => Promise<DiagnosticsSnapshot>
  copyDiagnostics: () => Promise<boolean>
  setSize: (widthMm: number, heightMm: number) => Promise<DeviceStatus>
  home: () => Promise<DeviceStatus>
  jog: (axis: 'X' | 'Y', distanceMm: number, feed: 100 | 500 | 1000 | 3000) => Promise<DeviceStatus>
  pause: () => Promise<DeviceStatus>
  resume: () => Promise<DeviceStatus>
  stop: () => Promise<DeviceStatus>
  reset: () => Promise<DeviceStatus>
  unlock: () => Promise<DeviceStatus>
  testMove: () => Promise<DeviceStatus>
  setLaser: (on: boolean, confirmed?: boolean) => Promise<DeviceStatus>
}

export type FileApi = {
  openSvg: () => Promise<OpenSvgResult | null>
  importDropped: (file: File) => Promise<OpenSvgResult>
}

export type JobApi = {
  start: (options: JobStartOptions) => Promise<JobProgress>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  getProgress: () => Promise<JobProgress>
  on: (event: JobEventName, listener: (progress: JobProgress) => void) => () => void
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
    file: FileApi
    job: JobApi
  }
}

export {}
