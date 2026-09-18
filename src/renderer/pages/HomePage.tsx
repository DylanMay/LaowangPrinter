import { COPY } from '@shared/copy'
import { useAppStore } from '../store/appStore'

export function HomePage() {
  const deviceState = useAppStore((state) => state.deviceState)
  const notice = useAppStore((state) => state.notice)
  const requestConnect = useAppStore((state) => state.requestConnect)
  const showNotice = useAppStore((state) => state.showNotice)
  const connected = deviceState === 'connected'

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-7 px-6">
      <h1 className="text-4xl font-semibold tracking-[0.08em]">{COPY.homeTitle}</h1>
      <p className="-mt-4 text-[15px] text-muted">{COPY.homeLead}</p>

      <div
        className={[
          'flex h-[280px] w-[520px] max-w-full flex-col items-center justify-center gap-3 rounded-3xl border-[1.5px] border-dashed bg-surface',
          connected ? 'border-brand' : 'border-[#cfc4b3] opacity-60',
        ].join(' ')}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paper text-brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3v12" />
            <path d="M7 8l5-5 5 5" />
            <rect x="4" y="15" width="16" height="6" rx="1.5" />
          </svg>
        </div>
        <p className="text-lg font-semibold">{COPY.dropTitleDisconnected}</p>
        <span className="text-[13px] text-muted">{COPY.dropHintDisconnected}</span>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => void requestConnect()}
          className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
        >
          {COPY.connectDevice}
        </button>
        <button
          type="button"
          onClick={() => showNotice(COPY.helpBody)}
          className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-semibold"
        >
          {COPY.connectHelp}
        </button>
      </div>

      {notice ? <p className="max-w-md text-center text-[13px] leading-relaxed text-muted">{notice}</p> : null}
    </main>
  )
}
