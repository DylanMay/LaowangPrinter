import { useEffect } from 'react'
import { DeviceStatus } from './components/DeviceStatus'
import { HomePage } from './pages/HomePage'
import { JobPage } from './pages/JobPage'
import { PreviewPage } from './pages/PreviewPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { MachinePanel } from './components/MachinePanel'
import { useAppStore } from './store/appStore'
import { COPY } from '@shared/copy'

export function App() {
  const hydrate = useAppStore((state) => state.hydrate)
  const showNotice = useAppStore((state) => state.showNotice)
  const openPanel = useAppStore((state) => state.openPanel)
  const panelOpen = useAppStore((state) => state.panelOpen)
  const page = useAppStore((state) => state.page)
  const goHome = useAppStore((state) => state.goHome)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const prevent = (event: DragEvent) => {
      event.preventDefault()
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  return (
    <div className="relative flex h-full flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <button type="button" onClick={goHome} className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-paper">
            印
          </div>
          <div className="text-[15px] font-bold">老王打印机</div>
        </button>
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
          onClick={() => openPanel()}
          className="rounded-lg px-2.5 py-1.5 text-[13px] text-muted hover:bg-paper hover:text-ink"
        >
          {COPY.settings}
        </button>
      </header>
      {page === 'workspace' ? (
        <WorkspacePage />
      ) : page === 'preview' ? (
        <PreviewPage />
      ) : page === 'job' ? (
        <JobPage />
      ) : (
        <HomePage />
      )}
      {panelOpen ? <MachinePanel /> : null}
    </div>
  )
}
