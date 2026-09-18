import { APP_NAME } from '@shared/copy'
import type { DeviceEventName } from '@shared/types/preload'
import { contextBridge, ipcRenderer } from 'electron'

const DEVICE_EVENTS: DeviceEventName[] = [
  'device:connected',
  'device:disconnected',
  'device:error',
  'device:status',
]

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
})
