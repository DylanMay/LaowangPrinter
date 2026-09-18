import { useEffect } from 'react'
import { DeviceStatus } from './components/DeviceStatus'
import { HomePage } from './pages/HomePage'
import { useAppStore } from './store/appStore'
import { COPY } from '@shared/copy'

export function App() {
  const hydrate = useAppStore((state) => state.hydrate)
  const showNotice = useAppStore((state) => state.showNotice)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-paper">
          印
        </div>
        <div className="text-[15px] font-bold">老王打印机</div>
        <div className="flex-1" />
        <DeviceStatus />
        <button
          type="button"
          onClick={() => showNotice(COPY.helpBody)}
          className="rounded-lg px-2.5 py-1.5 text-[13px] text-muted hover:bg-paper hover:text-ink"
        >
          {COPY.help}
        </button>
        <button
          type="button"
          onClick={() => showNotice(COPY.settingsBody)}
          className="rounded-lg px-2.5 py-1.5 text-[13px] text-muted hover:bg-paper hover:text-ink"
        >
          {COPY.settings}
        </button>
      </header>
      <HomePage />
    </div>
  )
}
