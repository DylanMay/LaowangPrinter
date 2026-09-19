import { APP_NAME } from '@shared/copy'
import type { DeviceEventName, JobEventName } from '@shared/types/preload'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

const DEVICE_EVENTS: DeviceEventName[] = [
  'device:connected',
  'device:disconnected',
  'device:error',
  'device:status',
]

const JOB_EVENTS: JobEventName[] = ['job:progress', 'job:paused', 'job:completed', 'job:error']

contextBridge.exposeInMainWorld('app', {
  getName: () => APP_NAME,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})

contextBridge.exposeInMainWorld('device', {
  list: () => ipcRenderer.invoke('device:list'),
  connect: (id?: string) => ipcRenderer.invoke('device:connect', id),
  disconnect: () => ipcRenderer.invoke('device:disconnect'),
  getStatus: () => ipcRenderer.invoke('device:getStatus'),
  on: (event: DeviceEventName, listener: (status: unknown) => void) => {
    if (!DEVICE_EVENTS.includes(event)) {
      return () => undefined
    }
    const wrapped = (_event: unknown, status: unknown) => listener(status)
    ipcRenderer.on(event, wrapped)
    return () => {
      ipcRenderer.removeListener(event, wrapped)
    }
  },
})

contextBridge.exposeInMainWorld('machine', {
  getConfig: () => ipcRenderer.invoke('machine:getConfig'),
  setSize: (widthMm: number, heightMm: number) =>
    ipcRenderer.invoke('machine:setSize', widthMm, heightMm),
  home: () => ipcRenderer.invoke('machine:home'),
  jog: (axis: 'X' | 'Y', distanceMm: number, feed: 100 | 500 | 1000 | 3000) =>
    ipcRenderer.invoke('machine:jog', axis, distanceMm, feed),
  pause: () => ipcRenderer.invoke('machine:pause'),
  resume: () => ipcRenderer.invoke('machine:resume'),
  stop: () => ipcRenderer.invoke('machine:stop'),
  reset: () => ipcRenderer.invoke('machine:reset'),
  testMove: () => ipcRenderer.invoke('machine:testMove'),
})

contextBridge.exposeInMainWorld('file', {
  openSvg: () => ipcRenderer.invoke('file:openSvg'),
  importDropped: (file: File) => {
    const filePath = webUtils.getPathForFile(file)
    return ipcRenderer.invoke('file:importSvg', filePath)
  },
})

contextBridge.exposeInMainWorld('job', {
  start: (options: unknown) => ipcRenderer.invoke('job:start', options),
  pause: () => ipcRenderer.invoke('job:pause'),
  resume: () => ipcRenderer.invoke('job:resume'),
  stop: () => ipcRenderer.invoke('job:stop'),
  getProgress: () => ipcRenderer.invoke('job:getProgress'),
  on: (event: JobEventName, listener: (progress: unknown) => void) => {
    if (!JOB_EVENTS.includes(event)) {
      return () => undefined
    }
    const wrapped = (_event: unknown, progress: unknown) => listener(progress)
    ipcRenderer.on(event, wrapped)
    return () => {
      ipcRenderer.removeListener(event, wrapped)
    }
  },
})
