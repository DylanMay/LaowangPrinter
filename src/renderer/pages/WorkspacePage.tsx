import { COPY } from '@shared/copy'
import { canStart, isOutOfBounds, isTooLarge } from '@shared/geometry/CoordinateTransformer'
import { formatSizeMm } from '@shared/types/workspace'
import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { WorkspaceCanvas } from '../components/WorkspaceCanvas'

export function WorkspacePage() {
  const imported = useAppStore((state) => state.imported)
  const placement = useAppStore((state) => state.placement)
  const workArea = useAppStore((state) => state.workArea)
  const notice = useAppStore((state) => state.notice)
  const material = useAppStore((state) => state.material)
  const thicknessMm = useAppStore((state) => state.thicknessMm)
  const effect = useAppStore((state) => state.effect)
  const openSvg = useAppStore((state) => state.openSvg)
  const autoShrinkPattern = useAppStore((state) => state.autoShrinkPattern)
  const goJob = useAppStore((state) => state.goJob)
  const showNotice = useAppStore((state) => state.showNotice)
  const connected = useAppStore((state) => state.deviceState === 'connected')

  if (!imported || !placement || !workArea) return null

  const tooLarge = isTooLarge(placement, workArea)
  const outOfBounds = isOutOfBounds(placement, workArea)
  const startOk = connected && canStart(placement, workArea)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col px-6 pb-3 pt-4">
          {tooLarge ? (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#f8ead3] px-3.5 py-2.5 text-[13px] text-[#8a5a12]">
              <p className="flex-1">
                {COPY.patternTooLarge}。{COPY.patternTooLargeHint} {formatSizeMm(workArea.widthMm, workArea.heightMm)}。
              </p>
              <button
                type="button"
                onClick={autoShrinkPattern}
                className="h-8 shrink-0 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold"
              >
                {COPY.autoShrink}
              </button>
            </div>
          ) : outOfBounds ? (
            <div className="mb-3 rounded-xl bg-[#f8e8e5] px-3.5 py-2.5 text-[13px] text-[#c4473a]">
              {COPY.outOfBounds}
            </div>
          ) : null}
          <WorkspaceCanvas />
          <p className="mt-2 text-center text-[12px] text-muted">
            {COPY.workAreaCaption} {formatSizeMm(workArea.widthMm, workArea.heightMm)}
          </p>
        </section>
        <PropertyPanel />
      </div>
      <footer className="flex h-[72px] shrink-0 items-center gap-5 border-t border-line bg-surface px-6">
        <div className="text-[12px] text-muted">
          {COPY.rangeLabel}
          <div className="text-[15px] font-semibold text-ink">
            {formatSizeMm(placement.widthMm, placement.heightMm)}
          </div>
        </div>
        <div className="text-[12px] text-muted">
          {COPY.material}
          <div className="text-[15px] font-semibold text-ink">
            {materialSummary(material, thicknessMm, effect)}
          </div>
        </div>
        {notice ? <p className="max-w-sm text-[12px] text-muted">{notice}</p> : <div className="flex-1" />}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openSvg()}
            className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-semibold"
          >
            {COPY.selectAgain}
          </button>
          <button
            type="button"
            onClick={() => showNotice(COPY.previewLater)}
            className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-semibold"
          >
            {COPY.preview}
          </button>
          <button
            type="button"
            disabled={!startOk}
            onClick={goJob}
            className="h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-white disabled:bg-[#ddd6cb] disabled:text-[#8a8278]"
          >
            {startOk ? COPY.startEngrave : COPY.cannotStart}
          </button>
        </div>
      </footer>
    </div>
  )
}

function PropertyPanel() {
  const placement = useAppStore((state) => state.placement)
  const lockRatio = useAppStore((state) => state.lockRatio)
  const setLockRatio = useAppStore((state) => state.setLockRatio)
  const setWidth = useAppStore((state) => state.setWidth)
  const setHeight = useAppStore((state) => state.setHeight)
  const centerPattern = useAppStore((state) => state.centerPattern)
  const fitPattern = useAppStore((state) => state.fitPattern)
  const material = useAppStore((state) => state.material)
  const setMaterial = useAppStore((state) => state.setMaterial)
  const thicknessMm = useAppStore((state) => state.thicknessMm)
  const setThickness = useAppStore((state) => state.setThickness)
  const effect = useAppStore((state) => state.effect)
  const setEffect = useAppStore((state) => state.setEffect)
  const workMode = useAppStore((state) => state.workMode)
  const setWorkMode = useAppStore((state) => state.setWorkMode)

  if (!placement) return null

  return (
    <aside className="w-[300px] shrink-0 overflow-auto border-l border-line bg-surface p-4">
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="text-[15px] font-semibold">{COPY.sizeSection}</h3>
          <div className="mt-2 flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-[12px] text-muted">
              {COPY.sizeWidth}
              <SizeField value={placement.widthMm} onCommit={setWidth} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-[12px] text-muted">
              {COPY.sizeHeight}
              <SizeField value={placement.heightMm} onCommit={setHeight} />
            </label>
          </div>
          <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={lockRatio}
              onChange={(event) => setLockRatio(event.target.checked)}
            />
            {COPY.lockRatio}
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={centerPattern}
              className="h-9 rounded-lg border border-line bg-paper px-3 text-[13px] font-semibold"
            >
              {COPY.centerPattern}
            </button>
            <button
              type="button"
              onClick={fitPattern}
              className="h-9 rounded-lg border border-line bg-paper px-3 text-[13px] font-semibold"
            >
              {COPY.fitWorkArea}
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-[15px] font-semibold">{COPY.material}</h3>
          <div className="mt-2 flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-[12px] text-muted">
              {COPY.materialKind}
              <select
                value={material}
                onChange={(event) => setMaterial(event.target.value as typeof material)}
                className="h-10 rounded-xl border border-line bg-paper px-3 text-sm font-semibold text-ink"
              >
                <option value="wood">{COPY.wood}</option>
                <option value="bamboo">{COPY.bamboo}</option>
                <option value="cardboard">{COPY.cardboard}</option>
                <option value="leather">{COPY.leather}</option>
                <option value="acrylic">{COPY.acrylic}</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-[12px] text-muted">
              {COPY.thickness}
              <select
                value={String(thicknessMm)}
                onChange={(event) => setThickness(Number(event.target.value))}
                className="h-10 rounded-xl border border-line bg-paper px-3 text-sm font-semibold text-ink"
              >
                <option value="2">2 mm</option>
                <option value="3">3 mm</option>
                <option value="5">5 mm</option>
              </select>
            </label>
          </div>
        </section>

        <section>
          <h3 className="text-[15px] font-semibold">{COPY.effect}</h3>
          <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-xl border border-line">
            {(['light', 'standard', 'deep'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setEffect(value)}
                className={[
                  'h-9 text-[13px] font-semibold',
                  effect === value ? 'bg-ink text-white' : 'bg-paper text-ink',
                ].join(' ')}
              >
                {value === 'light' ? COPY.effectLight : value === 'standard' ? COPY.effectStandard : COPY.effectDeep}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[15px] font-semibold">{COPY.workMode}</h3>
          <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setWorkMode('dry')}
              className={['h-9 text-[13px] font-semibold', workMode === 'dry' ? 'bg-ink text-white' : 'bg-paper'].join(' ')}
            >
              {COPY.dryRun}
            </button>
            <button
              type="button"
              onClick={() => setWorkMode('engrave')}
              className={['h-9 text-[13px] font-semibold', workMode === 'engrave' ? 'bg-ink text-white' : 'bg-paper'].join(' ')}
            >
              {COPY.engrave}
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">{COPY.dryRunHint}</p>
        </section>

        <p className="text-[12px] leading-relaxed text-muted">{COPY.effectDisclaimer}</p>
      </div>
    </aside>
  )
}

function SizeField({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(roundInput(value))
  const commit = () => {
    onCommit(Number(shown))
    setDraft(null)
  }
  return (
    <input
      value={shown}
      inputMode="decimal"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
      }}
      className="h-10 rounded-xl border border-line bg-paper px-3 text-sm font-semibold text-ink outline-none focus:border-brand"
    />
  )
}

function roundInput(value: number): number {
  return Math.round(value * 10) / 10
}

function materialSummary(
  material: 'wood' | 'bamboo' | 'cardboard' | 'leather' | 'acrylic',
  thicknessMm: number,
  effect: 'light' | 'standard' | 'deep',
): string {
  const names = {
    wood: COPY.wood,
    bamboo: COPY.bamboo,
    cardboard: COPY.cardboard,
    leather: COPY.leather,
    acrylic: COPY.acrylic,
  }
  const effects = {
    light: COPY.effectLight,
    standard: COPY.effectStandard,
    deep: COPY.effectDeep,
  }
  return `${thicknessMm}mm ${names[material]} · ${effects[effect]}`
}
