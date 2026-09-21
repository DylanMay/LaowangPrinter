import type { DeviceState, DeviceStatus, MachineState } from '@shared/types/state'
import type { JobProgress, WorkMode } from '@shared/types/job'
import type { AdvancedSnapshot, JogFeed, JogStep } from '@shared/types/machine'
import { GUIDE_STORAGE_KEY } from '@shared/guide'
import type { EffectLevel, MaterialId } from '@shared/materials/MaterialPreset'
import type { OpenSvgResult } from '@shared/types/svg'
import type { Placement, WorkArea } from '@shared/types/workspace'
import {
  autoShrink,
  canStart,
  centerPlacement,
  DEFAULT_WORK_AREA,
  fitPlacement,
  movePlacement,
  placeImported,
  resizeFromHeight,
  resizeFromWidth,
  scalePlacement,
} from '@shared/geometry/CoordinateTransformer'
import { COPY } from '@shared/copy'
import { checkJobSafety } from '@shared/job/SafetyChecker'
import { jobGcode } from '../gcode/jobGcode'
import { create } from 'zustand'

type ConfirmKind = 'reset' | 'stop' | null
type AppPage = 'home' | 'workspace' | 'job'

type AppStore = {
  page: AppPage
  deviceState: DeviceState
  deviceName: string | null
  notice: string | null
  scanned: boolean
  needsSizeSetup: boolean
  machineState: MachineState
  activity: DeviceStatus['activity']
  workArea: WorkArea | null
  maxPower: number
  panelOpen: boolean
  previewOpen: boolean
  confirm: ConfirmKind
  jogStep: JogStep
  jogFeed: JogFeed
  moveTested: boolean
  imported: OpenSvgResult | null
  placement: Placement | null
  lockRatio: boolean
  material: MaterialId
  thicknessMm: number
  effect: EffectLevel
  workMode: WorkMode
  jobProgress: JobProgress
  guideOpen: boolean
  guideStep: number
  guideCompleted: boolean
  advanced: AdvancedSnapshot | null
  hydrate: () => Promise<void>
  requestConnect: () => Promise<void>
  submitSize: (widthMm: number, heightMm: number) => Promise<void>
  openSvg: () => Promise<void>
  importDropped: (file: File) => Promise<void>
  showNotice: (message: string) => void
  openPanel: () => void
  closePanel: () => void
  loadAdvanced: () => Promise<void>
  setJogStep: (step: JogStep) => void
  setJogFeed: (feed: JogFeed) => void
  jog: (axis: 'X' | 'Y', distanceMm: number) => Promise<void>
  home: () => Promise<void>
  testMove: () => Promise<void>
  askReset: () => void
  askStop: () => void
  cancelConfirm: () => void
  confirmAction: () => Promise<void>
  goHome: () => void
  goWorkspace: () => void
  goPreview: () => void
  goJob: () => void
  startJob: (confirmed?: boolean) => Promise<void>
  pauseJob: () => Promise<void>
  resumeJob: () => Promise<void>
  resetJob: () => void
  advanceGuide: () => Promise<void>
  completeGuide: () => void
  setLockRatio: (lockRatio: boolean) => void
  setWidth: (widthMm: number) => void
  setHeight: (heightMm: number) => void
  moveBy: (dxMm: number, dyMm: number) => void
  scaleBy: (factor: number) => void
  centerPattern: () => void
  fitPattern: () => void
  autoShrinkPattern: () => void
  setMaterial: (material: MaterialId) => void
  setThickness: (thicknessMm: number) => void
  setEffect: (effect: EffectLevel) => void
  setWorkMode: (workMode: WorkMode) => void
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
    workArea: status.workArea ?? null,
    notice: status.errorMessage ?? (status.state === 'connected' ? getNotice() : null),
  })
}

function applyImport(
  set: (partial: Partial<AppStore>) => void,
  get: () => AppStore,
  result: OpenSvgResult,
): void {
  const workArea = get().workArea ?? DEFAULT_WORK_AREA
  const placed = placeImported(result.document, workArea)
  set({
    imported: result,
    placement: placed.placement,
    lockRatio: true,
    page: 'workspace',
    notice: placed.shrunk ? COPY.shrunkOk : COPY.importReady,
  })
}

let listening = false

const IDLE_JOB: JobProgress = {
  state: 'idle',
  jobState: 'idle',
  percent: 0,
  remainingSeconds: 0,
  elapsedSeconds: 0,
  estimatedTime: 0,
  sentLines: 0,
  totalLines: 0,
  currentLine: '',
  dryRun: false,
  lowPowerTest: false,
}

export const useAppStore = create<AppStore>((set, get) => ({
  page: 'home',
  deviceState: 'disconnected',
  deviceName: null,
  notice: null,
  scanned: false,
  needsSizeSetup: false,
  machineState: 'unknown',
  activity: undefined,
  workArea: null,
  maxPower: 1000,
  panelOpen: false,
  previewOpen: false,
  confirm: null,
  jogStep: 1,
  jogFeed: 500,
  moveTested: false,
  imported: null,
  placement: null,
  lockRatio: true,
  material: 'wood',
  thicknessMm: 3,
  effect: 'standard',
  workMode: 'dry',
  jobProgress: IDLE_JOB,
  guideOpen: false,
  guideStep: 0,
  guideCompleted: true,
  advanced: null,
  hydrate: async () => {
    if (!window.device) {
      set({ notice: '应用未正确启动，请重启软件。' })
      return
    }
    if (!listening) {
      listening = true
      window.device.on('device:status', (status) => mergeStatus(set, () => get().notice, status))
      if (window.job) {
        const onJob = (progress: JobProgress) => set({ jobProgress: progress })
        window.job.on('job:progress', onJob)
        window.job.on('job:paused', onJob)
        window.job.on('job:completed', onJob)
        window.job.on('job:error', onJob)
      }
    }
    try {
      const status = await window.device.getStatus()
      mergeStatus(set, () => get().notice, status)
      await syncMaxPower(set)
      const guideCompleted = readGuideCompleted()
      set({
        guideCompleted,
        guideOpen: !guideCompleted,
        guideStep: 0,
      })
      if (window.job) {
        const progress = await window.job.getProgress()
        const live = progress.state === 'running' || progress.state === 'paused'
        set({ jobProgress: progress, page: live ? 'job' : get().page })
      }
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
      await syncMaxPower(set)
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
      applyImport(set, get, result)
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
      applyImport(set, get, result)
    } catch (error) {
      set({ notice: fileErrorMessage(error) })
    }
  },
  showNotice: (message) => set({ notice: message }),
  openPanel: () => {
    set({ panelOpen: true, confirm: null })
    void get().loadAdvanced()
  },
  closePanel: () => set({ panelOpen: false, confirm: null }),
  loadAdvanced: async () => {
    if (!window.machine?.getAdvanced) return
    try {
      const advanced = await window.machine.getAdvanced()
      set({ advanced })
    } catch {
      set({ advanced: null })
    }
  },
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
    const kind = get().confirm
    set({ confirm: null })
    const jobState = get().jobProgress.state
    if ((kind === 'stop' || kind === 'reset') && (jobState === 'running' || jobState === 'paused')) {
      if (window.job) await window.job.stop()
      return
    }
    if (!window.machine) return
    if (kind === 'reset') {
      const status = await window.machine.reset()
      mergeStatus(set, () => null, status)
    }
    if (kind === 'stop') {
      const status = await window.machine.stop()
      mergeStatus(set, () => get().notice, status)
    }
  },
  goHome: () => {
    const job = get().jobProgress.state
    if (job === 'running' || job === 'paused') {
      set({ page: 'job', previewOpen: false })
      return
    }
    set({ page: 'home', previewOpen: false })
  },
  goWorkspace: () => {
    if (get().imported) set({ page: 'workspace', previewOpen: false })
  },
  goPreview: () => {
    const { placement, workArea, deviceState, imported } = get()
    if (!imported || !placement || !workArea || deviceState !== 'connected') return
    if (!canStart(placement, workArea)) return
    set({ page: 'workspace', previewOpen: true, notice: null })
  },
  goJob: () => {
    const { placement, workArea, deviceState } = get()
    if (!placement || !workArea || deviceState !== 'connected') return
    if (!canStart(placement, workArea)) return
    set({
      page: 'job',
      previewOpen: false,
      notice: null,
      jobProgress:
        get().jobProgress.state === 'running' || get().jobProgress.state === 'paused'
          ? get().jobProgress
          : IDLE_JOB,
    })
  },
  startJob: async (confirmed = false) => {
    if (!window.job) {
      set({ notice: COPY.cannotStart })
      return
    }
    const { imported, placement, workArea, maxPower, material, thicknessMm, effect, workMode, deviceState, machineState } = get()
    const gcode = jobGcode({
      imported,
      placement,
      workArea,
      maxPower,
      material,
      thicknessMm,
      effect,
      dryRun: workMode === 'dry',
      lowPower: workMode === 'low',
    })
    const safety = checkJobSafety({
      connected: deviceState === 'connected',
      alarm: machineState === 'alarm',
      inBounds: Boolean(placement && workArea && canStart(placement, workArea)),
      hasLines: Boolean(gcode?.lines.length),
    })
    if (!safety.ok) {
      set({ notice: safety.message })
      return
    }
    try {
      const progress = await window.job.start({
        lines: gcode!.lines,
        estimatedTime: gcode!.estimatedTime,
        dryRun: workMode === 'dry',
        lowPowerTest: workMode === 'low',
        confirmLowPower: workMode === 'low' ? confirmed : false,
        confirmed: workMode === 'dry' ? false : confirmed,
      })
      set({ jobProgress: progress, page: 'job', previewOpen: false, notice: null })
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : COPY.cannotStart })
    }
  },
  pauseJob: async () => {
    if (!window.job) return
    await window.job.pause()
  },
  resumeJob: async () => {
    if (!window.job) return
    await window.job.resume()
  },
  resetJob: () => set({ jobProgress: IDLE_JOB, page: 'job', previewOpen: false, notice: null }),
  setLockRatio: (lockRatio) => set({ lockRatio }),
  setWidth: (widthMm) => {
    const { placement, lockRatio } = get()
    if (!placement) return
    set({ placement: resizeFromWidth(placement, widthMm, lockRatio), notice: null })
  },
  setHeight: (heightMm) => {
    const { placement, lockRatio } = get()
    if (!placement) return
    set({ placement: resizeFromHeight(placement, heightMm, lockRatio), notice: null })
  },
  moveBy: (dxMm, dyMm) => {
    const { placement } = get()
    if (!placement) return
    set({ placement: movePlacement(placement, dxMm, dyMm) })
  },
  scaleBy: (factor) => {
    const { placement } = get()
    if (!placement) return
    set({ placement: scalePlacement(placement, factor) })
  },
  centerPattern: () => {
    const { placement, workArea } = get()
    if (!placement || !workArea) return
    set({
      placement: centerPlacement(placement.widthMm, placement.heightMm, workArea),
      notice: COPY.centeredOk,
    })
  },
  fitPattern: () => {
    const { placement, workArea } = get()
    if (!placement || !workArea) return
    set({
      placement: fitPlacement(placement.widthMm, placement.heightMm, workArea),
      notice: COPY.fittedOk,
    })
  },
  autoShrinkPattern: () => {
    const { placement, workArea } = get()
    if (!placement || !workArea) return
    set({
      placement: autoShrink(placement.widthMm, placement.heightMm, workArea),
      notice: COPY.shrunkOk,
    })
  },
  setMaterial: (material) => set({ material }),
  setThickness: (thicknessMm) => set({ thicknessMm }),
  setEffect: (effect) => set({ effect }),
  setWorkMode: (workMode) => set({ workMode }),
  advanceGuide: async () => {
    const { guideStep, deviceState, moveTested, activity } = get()
    if (activity) return
    if (guideStep === 0) {
      if (deviceState !== 'connected') {
        await get().requestConnect()
      }
      if (get().deviceState === 'connected') set({ guideStep: 1 })
      return
    }
    if (guideStep === 1) {
      if (deviceState !== 'connected') {
        await get().requestConnect()
        return
      }
      set({ guideStep: 2 })
      return
    }
    if (guideStep === 2) {
      if (!moveTested) {
        await get().testMove()
      }
      if (get().moveTested) set({ guideStep: 3 })
      return
    }
    if (guideStep === 3) {
      set({ guideStep: 4 })
      return
    }
    get().completeGuide()
  },
  completeGuide: () => {
    writeGuideCompleted()
    set({
      guideOpen: false,
      guideCompleted: true,
      workMode: 'dry',
      notice: COPY.guideReady,
    })
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

async function syncMaxPower(set: (partial: Partial<AppStore>) => void): Promise<void> {
  if (!window.machine) return
  try {
    const config = await window.machine.getConfig()
    if (config && config.maxPower > 0) set({ maxPower: config.maxPower })
  } catch {
    set({ maxPower: 1000 })
  }
}

function readGuideCompleted(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeGuideCompleted(): void {
  try {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}
