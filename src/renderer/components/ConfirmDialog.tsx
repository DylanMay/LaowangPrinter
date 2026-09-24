import { COPY } from '@shared/copy'
import { useAppStore } from '../store/appStore'

export function ConfirmDialog() {
  const confirm = useAppStore((state) => state.confirm)
  const confirmAction = useAppStore((state) => state.confirmAction)
  const cancelConfirm = useAppStore((state) => state.cancelConfirm)
  if (!confirm) return null
  const copy = dialogCopy(confirm)

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(28,24,20,0.35)] px-6">
      <div className="w-[420px] max-w-full rounded-3xl border border-line bg-surface p-6 shadow-[0_12px_40px_rgba(28,24,20,0.08)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-semibold">{copy.title}</h2>
          <p className="text-[13px] text-muted">{copy.body}</p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => cancelConfirm()}
              className="h-10 rounded-xl border border-line px-4 text-sm font-semibold"
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              onClick={() => void confirmAction()}
              className="h-10 rounded-xl bg-[#c4473a] px-4 text-sm font-semibold text-white"
            >
              {copy.ok}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function dialogCopy(kind: 'reset' | 'stop' | 'laser') {
  if (kind === 'reset') {
    return { title: COPY.resetConfirm, body: COPY.resetHint, cancel: COPY.cancel, ok: COPY.confirmReset }
  }
  if (kind === 'laser') {
    return { title: COPY.laserOnConfirm, body: COPY.laserOnHint, cancel: COPY.cancel, ok: COPY.confirmLaserOn }
  }
  return { title: COPY.stopConfirm, body: COPY.stopHint, cancel: COPY.keepGoing, ok: COPY.stopNow }
}
