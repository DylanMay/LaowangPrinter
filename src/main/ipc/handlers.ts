import { APP_NAME } from '@shared/copy'
import type { DeviceStatus } from '@shared/types/state'
import { app, ipcMain } from 'electron'

export function registerIpcHandlers(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getName', () => APP_NAME)
  ipcMain.handle('device:getStatus', (): DeviceStatus => ({ state: 'disconnected' }))
}
