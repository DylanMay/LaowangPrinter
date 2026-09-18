import { registerIpcHandlers } from './ipc/handlers'
import { DeviceService } from './device/DeviceService'
import { JobService } from './job/JobService'
import { env } from 'node:process'
import { createSerialBackend } from './serial/createBackend'
import { SerialManager } from './serial/SerialManager'
import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'node:path'

const serial = new SerialManager(createSerialBackend())
const device = new DeviceService(serial)
const job = new JobService(device)

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '老王打印机',
    backgroundColor: '#F3EEE6',
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: env.LAOWANG_SERIAL === 'mock',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
    window.focus()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers(device, job)
  await device.startWatching()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  device.stopWatching()
  void device.disconnect()
})
