import type { DeviceState, DeviceStatus } from '@shared/types/state'
import { create } from 'zustand'

type AppStore = {
  deviceState: DeviceState
  deviceName: string | null
  notice: string | null
  scanned: boolean
  hydrate: () => Promise<void>
  requestConnect: () => Promise<void>
  showNotice: (message: string) => void
}

function applyStatus(
  set: (partial: Partial<AppStore>) => void,
  status: DeviceStatus,
): void {
  set({
    deviceState: status.state,
    deviceName: status.displayName ?? null,
    notice: status.errorMessage ?? null,
  })
}

let listening = false

export const useAppStore = create<AppStore>((set) => ({
  deviceState: 'disconnected',
  deviceName: null,
  notice: null,
  scanned: false,
  hydrate: async () => {
    if (!window.device) {
      set({ notice: '应用未正确启动，请重启软件。' })
      return
    }
    if (!listening) {
      listening = true
      window.device.on('device:status', (status) => applyStatus(set, status))
    }
    try {
      const status = await window.device.getStatus()
      applyStatus(set, status)
    } catch {
      set({ notice: '应用未正确启动，请重启软件。' })
    }
  },
  requestConnect: async () => {
    if (!window.device) {
      set({ deviceState: 'error', notice: '应用未正确启动，请重启软件。' })
      return
    }
    set({ deviceState: 'detecting', notice: null, scanned: true })
    try {
      const status = await window.device.connect()
      applyStatus(set, status)
    } catch {
      set({
        deviceState: 'error',
        notice: '无法连接雕刻机。请检查 USB 连接后再试。',
      })
    }
  },
  showNotice: (message) => set({ notice: message }),
}))
