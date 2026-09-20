import { COPY } from '@shared/copy'
import { GUIDE_STEPS } from '@shared/guide'
import { useAppStore } from '../store/appStore'

export function FirstRunGuide() {
  const open = useAppStore((state) => state.guideOpen)
  const step = useAppStore((state) => state.guideStep)
  const deviceState = useAppStore((state) => state.deviceState)
  const connected = deviceState === 'connected'
  const moveTested = useAppStore((state) => state.moveTested)
  const activity = useAppStore((state) => state.activity)
  const notice = useAppStore((state) => state.notice)
  const advanceGuide = useAppStore((state) => state.advanceGuide)
  if (!open) return null

  const current = GUIDE_STEPS[Math.min(step, GUIDE_STEPS.length - 1)]!
  const last = step >= GUIDE_STEPS.length - 1
  const busy = Boolean(activity) || deviceState === 'detecting' || deviceState === 'connecting'
  const label = buttonLabel(step, connected, moveTested, busy, last)

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(28,24,20,0.35)] px-6">
      <div className="w-[420px] max-w-full rounded-3xl border border-line bg-surface p-6 shadow-[0_12px_40px_rgba(28,24,20,0.08)]">
        <div className="mb-4 flex justify-center gap-1.5">
          {GUIDE_STEPS.map((item, index) => (
            <span
              key={item.title}
              className={[
                'h-2 rounded-full',
                index <= step ? 'w-[18px] bg-brand' : 'w-2 bg-[#ddd4c8]',
              ].join(' ')}
            />
          ))}
        </div>
        <h2 className="text-center text-xl font-semibold">{current.title}</h2>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-muted">{current.body}</p>
        {step === 0 && notice ? (
          <p className="mt-3 text-center text-[13px] leading-relaxed text-[#c4473a]">{notice}</p>
        ) : null}
        {step === 2 && moveTested ? (
          <p className="mt-3 text-center text-[13px] font-semibold text-brand">{COPY.testMoveOk}</p>
        ) : null}
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => void advanceGuide()}
            className="h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-white disabled:bg-[#ddd6cb] disabled:text-[#8a8278]"
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  )
}

function buttonLabel(
  step: number,
  connected: boolean,
  moveTested: boolean,
  busy: boolean,
  last: boolean,
): string {
  if (busy) {
    if (step === 0 || step === 1) return COPY.deviceDetecting
    if (step === 2) return COPY.testingMove
  }
  if (step === 0 && !connected) return COPY.connectDevice
  if (step === 2 && !moveTested) return COPY.startTest
  if (last) return COPY.guideStartFirst
  return COPY.guideNext
}
