import { COPY } from '@shared/copy'
import type { DeviceState } from '@shared/types/state'
import { create } from 'zustand'

type AppStore = {
  deviceState: DeviceState
  notice: string | null
  hydrate: () => Promise<void>
  requestConnect: () => Promise<void>
  showNotice: (message: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  deviceState: 'disconnected',
  notice: null,
  hydrate: async () => {
    const status = await window.device.getStatus()
    set({ deviceState: status.state })
  },
  requestConnect: async () => {
    set({ notice: COPY.phaseNote })
  },
  showNotice: (message) => set({ notice: message }),
}))
