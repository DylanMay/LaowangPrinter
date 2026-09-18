import { APP_NAME, COPY } from '@shared/copy'
import type { DeviceStatus } from '@shared/types/state'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { DeviceService } from '../device/DeviceService'
import { FileService } from '../file/FileService'

function broadcast(channel: string, payload: DeviceStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

export function registerIpcHandlers(device: DeviceService, files = createFileService()): void {
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
  ipcMain.handle('machine:home', () => device.home())
  ipcMain.handle('machine:jog', (_event, axis: 'X' | 'Y', distanceMm: number, feed: 100 | 500 | 1000 | 3000) =>
    device.jog(axis, distanceMm, feed),
  )
  ipcMain.handle('machine:pause', () => device.pause())
  ipcMain.handle('machine:resume', () => device.resume())
  ipcMain.handle('machine:stop', () => device.halt())
  ipcMain.handle('machine:reset', () => device.reset())
  ipcMain.handle('machine:testMove', () => device.testMove())
  ipcMain.handle('file:openSvg', () => files.openSvg())
  ipcMain.handle('file:importSvg', (_event, filePath: string) => files.importSvg(filePath))

  device.onStatus((status) => {
    broadcast('device:status', status)
    if (status.state === 'connected') broadcast('device:connected', status)
    if (status.state === 'disconnected') broadcast('device:disconnected', status)
    if (status.state === 'error') broadcast('device:error', status)
  })
}

function createFileService(): FileService {
  return new FileService({
    openDialog: async () => {
      const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const options = {
        title: COPY.selectFile,
        filters: [{ name: 'SVG', extensions: ['svg'] }],
        properties: ['openFile' as const],
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || !result.filePaths[0]) return null
      return result.filePaths[0]
    },
  })
}
