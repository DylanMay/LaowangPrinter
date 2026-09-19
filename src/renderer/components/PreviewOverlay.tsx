import { COPY } from '@shared/copy'
import { formatDuration } from '@shared/gcode/GCodeEstimator'
import { formatSizeMm } from '@shared/types/workspace'
import { PreviewCanvas } from './PreviewCanvas'
import { jobGcode } from '../gcode/jobGcode'
import { useAppStore } from '../store/appStore'

export function PreviewOverlay() {
  const imported = useAppStore((state) => state.imported)
  const placement = useAppStore((state) => state.placement)
  const workArea = useAppStore((state) => state.workArea)
  const maxPower = useAppStore((state) => state.maxPower)
  const material = useAppStore((state) => state.material)
  const thicknessMm = useAppStore((state) => state.thicknessMm)
  const effect = useAppStore((state) => state.effect)
  const workMode = useAppStore((state) => state.workMode)
  const goWorkspace = useAppStore((state) => state.goWorkspace)
  const goJob = useAppStore((state) => state.goJob)
  const connected = useAppStore((state) => state.deviceState === 'connected')

  const gcode = jobGcode({
    imported,
    placement,
    workArea,
    maxPower,
    material,
    thicknessMm,
    effect,
    dryRun: workMode === 'dry',
  })
  if (!imported || !placement || !workArea || !gcode) return null

  const startLabel = workMode === 'dry' ? COPY.startDryRun : COPY.startEngrave

  return (
    <div className="absolute inset-0 z-10 flex bg-paper">
      <section className="flex min-w-0 flex-1 flex-col px-6 pb-4 pt-4">
        <PreviewCanvas />
        <p className="mt-2 text-center text-[12px] text-muted">
          {COPY.workAreaCaption} {formatSizeMm(workArea.widthMm, workArea.heightMm)} · {COPY.previewHeadHint}
        </p>
      </section>
      <aside className="flex w-[280px] shrink-0 flex-col gap-3 border-l border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{COPY.previewTitle}</h2>
        <p className="text-[13px] text-muted">
          {COPY.rangeLabel}{' '}
          <b className="font-semibold text-ink">{formatSizeMm(placement.widthMm, placement.heightMm)}</b>
        </p>
        <p className="text-[13px] text-muted">
          {COPY.timeLabel}{' '}
          <b className="font-semibold text-ink">{formatDuration(gcode.estimatedTime)}</b>
        </p>
        <p className="text-[13px] text-muted">
          {COPY.material}{' '}
          <b className="font-semibold text-ink">
            {thicknessMm}mm {materialName(material)}
          </b>
        </p>
        <p className="text-[13px] text-muted">
          {COPY.effect}{' '}
          <b className="font-semibold text-ink">{effectName(effect)}</b>
        </p>
        <p className="text-[13px] text-muted">
          {COPY.workMode}{' '}
          <b className="font-semibold text-ink">{workMode === 'dry' ? COPY.dryRun : COPY.engrave}</b>
        </p>
        <p className="text-[12px] leading-relaxed text-muted">{COPY.effectDisclaimer}</p>
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={goWorkspace}
            className="h-10 rounded-xl border border-line bg-paper px-4 text-sm font-semibold"
          >
            {COPY.backToEdit}
          </button>
          <button
            type="button"
            disabled={!connected}
            onClick={goJob}
            className="h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:bg-[#ddd6cb] disabled:text-[#8a8278]"
          >
            {startLabel}
          </button>
        </div>
      </aside>
    </div>
  )
}

function materialName(material: 'wood' | 'bamboo' | 'cardboard' | 'leather' | 'acrylic'): string {
  return {
    wood: COPY.wood,
    bamboo: COPY.bamboo,
    cardboard: COPY.cardboard,
    leather: COPY.leather,
    acrylic: COPY.acrylic,
  }[material]
}

function effectName(effect: 'light' | 'standard' | 'deep'): string {
  return {
    light: COPY.effectLight,
    standard: COPY.effectStandard,
    deep: COPY.effectDeep,
  }[effect]
}
