import type { DeviceState, DeviceStatus } from '@shared/types/state'
import { COPY } from '@shared/copy'
import { create } from 'zustand'

type AppStore = {
  deviceState: DeviceState
  deviceName: string | null
  notice: string | null
  scanned: boolean
  needsSizeSetup: boolean
  hydrate: () => Promise<void>
  requestConnect: () => Promise<void>
  submitSize: (widthMm: number, heightMm: number) => Promise<void>
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
    needsSizeSetup: Boolean(status.needsSizeSetup),
  })
}

let listening = false

export const useAppStore = create<AppStore>((set) => ({
  deviceState: 'disconnected',
  deviceName: null,
  notice: null,
  scanned: false,
  needsSizeSetup: false,
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
  submitSize: async (widthMm, heightMm) => {
    if (!window.machine) {
      set({ notice: COPY.sizeInvalid })
      return
    }
    if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
      set({ notice: COPY.sizeInvalid })
      return
    }
    try {
      const status = await window.machine.setSize(widthMm, heightMm)
      applyStatus(set, status)
    } catch {
      set({ notice: COPY.sizeInvalid })
    }
  },
  showNotice: (message) => set({ notice: message }),
}))
