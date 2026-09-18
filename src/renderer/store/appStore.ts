import type { DeviceState, DeviceStatus, MachineState } from '@shared/types/state'
import type { JogFeed, JogStep } from '@shared/types/machine'
import type { OpenSvgResult } from '@shared/types/svg'
import { COPY } from '@shared/copy'
import { create } from 'zustand'

type ConfirmKind = 'reset' | 'stop' | null

type AppStore = {
  deviceState: DeviceState
  deviceName: string | null
  notice: string | null
  scanned: boolean
  needsSizeSetup: boolean
  machineState: MachineState
  activity: DeviceStatus['activity']
  panelOpen: boolean
  confirm: ConfirmKind
  jogStep: JogStep
  jogFeed: JogFeed
  moveTested: boolean
  imported: OpenSvgResult | null
  hydrate: () => Promise<void>
  requestConnect: () => Promise<void>
  submitSize: (widthMm: number, heightMm: number) => Promise<void>
  openSvg: () => Promise<void>
  importDropped: (file: File) => Promise<void>
  showNotice: (message: string) => void
  openPanel: () => void
  closePanel: () => void
  setJogStep: (step: JogStep) => void
  setJogFeed: (feed: JogFeed) => void
  jog: (axis: 'X' | 'Y', distanceMm: number) => Promise<void>
  home: () => Promise<void>
  testMove: () => Promise<void>
  askReset: () => void
  askStop: () => void
  cancelConfirm: () => void
  confirmAction: () => Promise<void>
}

function mergeStatus(
  set: (partial: Partial<AppStore>) => void,
  getNotice: () => string | null,
  status: DeviceStatus,
): void {
  set({
    deviceState: status.state,
    deviceName: status.displayName ?? null,
    needsSizeSetup: Boolean(status.needsSizeSetup),
    machineState: status.machineState ?? 'unknown',
    activity: status.activity,
    notice: status.errorMessage ?? (status.state === 'connected' ? getNotice() : null),
  })
}

let listening = false

export const useAppStore = create<AppStore>((set, get) => ({
  deviceState: 'disconnected',
  deviceName: null,
  notice: null,
  scanned: false,
  needsSizeSetup: false,
  machineState: 'unknown',
  activity: undefined,
  panelOpen: false,
  confirm: null,
  jogStep: 1,
  jogFeed: 500,
  moveTested: false,
  imported: null,
  hydrate: async () => {
    if (!window.device) {
      set({ notice: '应用未正确启动，请重启软件。' })
      return
    }
    if (!listening) {
      listening = true
      window.device.on('device:status', (status) => mergeStatus(set, () => get().notice, status))
    }
    try {
      const status = await window.device.getStatus()
      mergeStatus(set, () => get().notice, status)
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
      mergeStatus(set, () => null, status)
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
      mergeStatus(set, () => get().notice, status)
    } catch {
      set({ notice: COPY.sizeInvalid })
    }
  },
  openSvg: async () => {
    if (!window.file) {
      set({ notice: COPY.importFailed })
      return
    }
    try {
      const result = await window.file.openSvg()
      if (!result) return
      set({ imported: result, notice: COPY.importReady })
    } catch (error) {
      set({ notice: fileErrorMessage(error) })
    }
  },
  importDropped: async (file) => {
    if (!window.file) {
      set({ notice: COPY.importFailed })
      return
    }
    if (!file.name.toLowerCase().endsWith('.svg')) {
      set({ notice: COPY.importInvalid })
      return
    }
    try {
      const result = await window.file.importDropped(file)
      set({ imported: result, notice: COPY.importReady })
    } catch (error) {
      set({ notice: fileErrorMessage(error) })
    }
  },
  showNotice: (message) => set({ notice: message }),
  openPanel: () => set({ panelOpen: true, confirm: null }),
  closePanel: () => set({ panelOpen: false, confirm: null }),
  setJogStep: (jogStep) => set({ jogStep }),
  setJogFeed: (jogFeed) => set({ jogFeed }),
  jog: async (axis, distanceMm) => {
    if (!window.machine) return
    const status = await window.machine.jog(axis, distanceMm, get().jogFeed)
    mergeStatus(set, () => get().notice, status)
  },
  home: async () => {
    if (!window.machine) return
    const status = await window.machine.home()
    mergeStatus(set, () => get().notice, status)
  },
  testMove: async () => {
    if (!window.machine) return
    set({ notice: COPY.testingMove })
    const status = await window.machine.testMove()
    mergeStatus(set, () => COPY.testMoveOk, status)
    if (status.state === 'connected' && !status.errorMessage) {
      set({ moveTested: true, notice: COPY.testMoveOk })
    }
  },
  askReset: () => set({ confirm: 'reset' }),
  askStop: () => set({ confirm: 'stop' }),
  cancelConfirm: () => set({ confirm: null }),
  confirmAction: async () => {
    if (!window.machine) return
    const kind = get().confirm
    set({ confirm: null })
    if (kind === 'reset') {
      const status = await window.machine.reset()
      mergeStatus(set, () => null, status)
    }
    if (kind === 'stop') {
      const status = await window.machine.stop()
      mergeStatus(set, () => get().notice, status)
    }
  },
}))

function fileErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''
  const known: string[] = [
    COPY.importInvalid,
    COPY.importEmpty,
    COPY.importFailed,
    COPY.importTooLarge,
  ]
  return known.includes(message) ? message : COPY.importFailed
}
