import { COPY } from '@shared/copy'
import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'

export function DebugPanel({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const copyDiagnostics = useAppStore((state) => state.copyDiagnostics)
  const unlockMachine = useAppStore((state) => state.unlockMachine)
  const connected = useAppStore((state) => state.deviceState === 'connected')
  const alarm = useAppStore((state) => state.machineState === 'alarm')

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!window.machine?.getDiagnostics) return
      try {
        const snap = await window.machine.getDiagnostics()
        if (alive) setText(snap.text)
      } catch {
        if (alive) setText(COPY.debugEmpty)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 1000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-center text-xl font-semibold">{COPY.debugTitle}</h2>
      <p className="text-center text-[13px] leading-relaxed text-muted">{COPY.debugHint}</p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-paper p-3 font-mono text-[11px] leading-relaxed text-ink">
        {text || COPY.debugEmpty}
      </pre>
      <p className="text-center text-[12px] text-muted">{COPY.unlockHint}</p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={async () => {
            const ok = await copyDiagnostics()
            if (ok) {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }
          }}
          className="h-10 rounded-xl border border-line px-4 text-sm font-semibold"
        >
          {copied ? COPY.debugCopied : COPY.copyDebug}
        </button>
        <button
          type="button"
          disabled={!connected && !alarm}
          onClick={() => void unlockMachine()}
          className="h-10 rounded-xl border border-[#e8c9c4] px-4 text-sm font-semibold text-[#c4473a] disabled:opacity-40"
        >
          {COPY.unlockMachine}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
        >
          {COPY.done}
        </button>
      </div>
    </div>
  )
}
