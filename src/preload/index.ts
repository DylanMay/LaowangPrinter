import { APP_NAME } from '@shared/copy'
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('app', {
  getName: () => APP_NAME,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})

contextBridge.exposeInMainWorld('device', {
  getStatus: () => ipcRenderer.invoke('device:getStatus'),
})
