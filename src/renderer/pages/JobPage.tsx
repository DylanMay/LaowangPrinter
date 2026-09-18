import { COPY } from '@shared/copy'
import { canStart } from '@shared/geometry/CoordinateTransformer'
import { formatSizeMm } from '@shared/types/workspace'
import { useAppStore } from '../store/appStore'

export function JobPage() {
  const imported = useAppStore((state) => state.imported)
  const placement = useAppStore((state) => state.placement)
  const workArea = useAppStore((state) => state.workArea)
  const connected = useAppStore((state) => state.deviceState === 'connected')
  const goWorkspace = useAppStore((state) => state.goWorkspace)
  const showNotice = useAppStore((state) => state.showNotice)
  const inBounds = Boolean(placement && workArea && canStart(placement, workArea))

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-[520px] max-w-full rounded-3xl border border-line bg-surface p-8">
        <h2 className="text-xl font-semibold">{COPY.jobPlaceholderTitle}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{COPY.jobPlaceholderLead}</p>
        <ul className="mt-5 space-y-2 text-[14px]">
          <li>{connected ? '✓' : '○'} {COPY.deviceConnected}</li>
          <li>{imported ? '✓' : '○'} {COPY.importReady}</li>
          <li>{inBounds ? '✓' : '○'} {COPY.patternInBounds}</li>
          {workArea && placement ? (
            <li>
              ✓ {COPY.rangeLabel} {formatSizeMm(placement.widthMm, placement.heightMm)}
            </li>
          ) : null}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={goWorkspace}
            className="h-10 rounded-xl border border-line bg-paper px-4 text-sm font-semibold"
          >
            {COPY.backToWorkspace}
          </button>
          <button
            type="button"
            onClick={() => showNotice(COPY.jobLater)}
            className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
          >
            {COPY.startEngrave}
          </button>
        </div>
      </div>
    </main>
  )
}
