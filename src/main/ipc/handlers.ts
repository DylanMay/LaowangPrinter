import { APP_NAME } from '@shared/copy'
import type { DeviceStatus } from '@shared/types/state'
import { app, BrowserWindow, ipcMain } from 'electron'
import type { DeviceService } from '../device/DeviceService'

function broadcast(channel: string, payload: DeviceStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

export function registerIpcHandlers(device: DeviceService): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getName', () => APP_NAME)
  ipcMain.handle('device:list', () => device.list())
  ipcMain.handle('device:connect', (_event, id?: string) => device.connect(id))
  ipcMain.handle('device:disconnect', () => device.disconnect())
  ipcMain.handle('device:getStatus', () => device.getStatus())
  ipcMain.handle('machine:getConfig', () => device.getConfig())
  ipcMain.handle('machine:setSize', (_event, widthMm: number, heightMm: number) =>
    device.setSize(widthMm, heightMm),
  )

  device.onStatus((status) => {
    broadcast('device:status', status)
    if (status.state === 'connected') broadcast('device:connected', status)
    if (status.state === 'disconnected') broadcast('device:disconnected', status)
    if (status.state === 'error') broadcast('device:error', status)
  })
}
