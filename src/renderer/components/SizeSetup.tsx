import { COPY } from '@shared/copy'
import { useState } from 'react'
import { useAppStore } from '../store/appStore'

export function SizeSetup() {
  const submitSize = useAppStore((state) => state.submitSize)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')

  return (
    <form
      className="flex w-[520px] max-w-full flex-col items-center gap-5 rounded-3xl border border-line bg-surface px-8 py-8"
      onSubmit={(event) => {
        event.preventDefault()
        void submitSize(Number(width), Number(height))
      }}
    >
      <h2 className="text-xl font-semibold">{COPY.sizeSetupTitle}</h2>
      <p className="text-center text-[13px] leading-relaxed text-muted">{COPY.sizeSetupLead}</p>
      <div className="flex w-full gap-3">
        <label className="flex flex-1 flex-col gap-1.5 text-[13px] text-muted">
          {COPY.sizeWidth}
          <input
            value={width}
            inputMode="decimal"
            placeholder="300"
            onChange={(event) => setWidth(event.target.value)}
            className="h-10 rounded-xl border border-line bg-paper px-3 text-sm font-semibold text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-[13px] text-muted">
          {COPY.sizeHeight}
          <input
            value={height}
            inputMode="decimal"
            placeholder="200"
            onChange={(event) => setHeight(event.target.value)}
            className="h-10 rounded-xl border border-line bg-paper px-3 text-sm font-semibold text-ink outline-none focus:border-brand"
          />
        </label>
        <span className="self-end pb-2 text-[13px] text-muted">{COPY.sizeUnit}</span>
      </div>
      <button
        type="submit"
        className="h-10 rounded-xl bg-ink px-5 text-sm font-semibold text-white"
      >
        {COPY.sizeDone}
      </button>
    </form>
  )
}
