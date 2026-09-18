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
    if (!listening) {
      listening = true
      window.device.on('device:status', (status) => applyStatus(set, status))
    }
    const status = await window.device.getStatus()
    applyStatus(set, status)
  },
  requestConnect: async () => {
    set({ deviceState: 'detecting', notice: null, scanned: true })
    const status = await window.device.connect()
    applyStatus(set, status)
  },
  showNotice: (message) => set({ notice: message }),
}))
