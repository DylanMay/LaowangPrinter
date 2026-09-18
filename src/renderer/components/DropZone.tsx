import { COPY } from '@shared/copy'
import type { OpenSvgResult } from '@shared/types/svg'
import { useState } from 'react'
import { useAppStore } from '../store/appStore'

export function DropZone() {
  const connected = useAppStore((state) => state.deviceState === 'connected')
  const imported = useAppStore((state) => state.imported)
  const openSvg = useAppStore((state) => state.openSvg)
  const importDropped = useAppStore((state) => state.importDropped)
  const [over, setOver] = useState(false)

  return (
    <div
      className={[
        'flex h-[280px] w-[520px] max-w-full flex-col items-center justify-center gap-3 rounded-3xl border-[1.5px] border-dashed bg-surface',
        connected ? 'border-brand' : 'border-[#cfc4b3] opacity-60',
        over && connected ? 'bg-paper' : '',
      ].join(' ')}
      onDragEnter={(event) => {
        event.preventDefault()
        if (connected) setOver(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = connected ? 'copy' : 'none'
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        if (!connected) return
        const file = event.dataTransfer.files[0]
        if (file) void importDropped(file)
      }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paper text-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v12" />
          <path d="M7 8l5-5 5 5" />
          <rect x="4" y="15" width="16" height="6" rx="1.5" />
        </svg>
      </div>
      {imported && connected ? <ImportedSummary result={imported} onPick={() => void openSvg()} /> : (
        <>
          <p className="text-lg font-semibold">
            {connected ? COPY.dropTitleConnected : COPY.dropTitleDisconnected}
          </p>
          <span className="text-[13px] text-muted">
            {connected ? COPY.dropHintConnected : COPY.dropHintDisconnected}
          </span>
          {connected ? (
            <button
              type="button"
              onClick={() => void openSvg()}
              className="mt-1 h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
            >
              {COPY.selectFile}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

function ImportedSummary({ result, onPick }: { result: OpenSvgResult; onPick: () => void }) {
  const width = formatMm(result.document.widthMm)
  const height = formatMm(result.document.heightMm)
  return (
    <>
      <p className="text-lg font-semibold">{COPY.importReady}</p>
      <span className="text-[13px] text-muted">{result.fileName}</span>
      <span className="text-[13px] text-muted">
        {width} × {height} {COPY.sizeUnit} · {result.document.paths.length} {COPY.importLines}
      </span>
      <button
        type="button"
        onClick={onPick}
        className="mt-1 h-10 rounded-xl border border-line bg-paper px-4 text-sm font-semibold"
      >
        {COPY.selectAgain}
      </button>
    </>
  )
}

function formatMm(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
