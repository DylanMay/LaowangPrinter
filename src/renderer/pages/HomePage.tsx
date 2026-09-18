import { COPY } from '@shared/copy'
import { DropZone } from '../components/DropZone'
import { SizeSetup } from '../components/SizeSetup'
import { useAppStore } from '../store/appStore'

export function HomePage() {
  const deviceState = useAppStore((state) => state.deviceState)
  const deviceName = useAppStore((state) => state.deviceName)
  const notice = useAppStore((state) => state.notice)
  const requestConnect = useAppStore((state) => state.requestConnect)
  const showNotice = useAppStore((state) => state.showNotice)
  const scanned = useAppStore((state) => state.scanned)
  const needsSizeSetup = useAppStore((state) => state.needsSizeSetup)
  const moveTested = useAppStore((state) => state.moveTested)
  const testMove = useAppStore((state) => state.testMove)
  const activity = useAppStore((state) => state.activity)
  const connected = deviceState === 'connected'
  const busy = deviceState === 'detecting' || deviceState === 'connecting'
  const connectLabel = busy
    ? COPY.deviceDetecting
    : deviceState === 'error'
      ? COPY.retry
      : scanned
        ? COPY.retryDetect
        : COPY.connectDevice

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-7 px-6">
      <h1 className="text-4xl font-semibold tracking-[0.08em]">{COPY.homeTitle}</h1>
      <p className="-mt-4 text-[15px] text-muted">{COPY.homeLead}</p>

      {connected && needsSizeSetup ? (
        <SizeSetup />
      ) : (
        <DropZone />
      )}

      {connected ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-brand">{deviceName ?? COPY.myMachine}</p>
          {!needsSizeSetup && !moveTested ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-[13px] text-muted">{COPY.firstTestHint}</p>
              <button
                type="button"
                disabled={Boolean(activity)}
                onClick={() => void testMove()}
                className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-semibold disabled:opacity-40"
              >
                {COPY.startTest}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestConnect()}
            className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:bg-[#ddd6cb] disabled:text-[#8a8278]"
          >
            {connectLabel}
          </button>
          <button
            type="button"
            onClick={() => showNotice(COPY.helpBody)}
            className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-semibold"
          >
            {COPY.connectHelp}
          </button>
        </div>
      )}

      {notice ? <p className="max-w-md text-center text-[13px] leading-relaxed text-muted">{notice}</p> : null}
    </main>
  )
}
