import { COPY } from '@shared/copy'
import { useAppStore } from '../store/appStore'

export function ConfirmDialog() {
  const confirm = useAppStore((state) => state.confirm)
  const confirmAction = useAppStore((state) => state.confirmAction)
  const cancelConfirm = useAppStore((state) => state.cancelConfirm)
  if (!confirm) return null

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(28,24,20,0.35)] px-6">
      <div className="w-[420px] max-w-full rounded-3xl border border-line bg-surface p-6 shadow-[0_12px_40px_rgba(28,24,20,0.08)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-semibold">
            {confirm === 'reset' ? COPY.resetConfirm : COPY.stopConfirm}
          </h2>
          <p className="text-[13px] text-muted">
            {confirm === 'reset' ? COPY.resetHint : COPY.stopHint}
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => cancelConfirm()}
              className="h-10 rounded-xl border border-line px-4 text-sm font-semibold"
            >
              {confirm === 'stop' ? COPY.keepGoing : COPY.cancel}
            </button>
            <button
              type="button"
              onClick={() => void confirmAction()}
              className="h-10 rounded-xl bg-[#c4473a] px-4 text-sm font-semibold text-white"
            >
              {confirm === 'reset' ? COPY.confirmReset : COPY.stopNow}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
