import { COPY } from '@shared/copy'
import { examplesByKind, type ExampleArtwork } from '@shared/examples/artwork'
import type { SvgDocument } from '@shared/types/svg'
import { useAppStore } from '../store/appStore'

export function ExamplePicker() {
  const connected = useAppStore((state) => state.deviceState === 'connected')
  const useExample = useAppStore((state) => state.useExample)

  return (
    <section className="flex w-[520px] max-w-full flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">{COPY.examplesTitle}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          {connected ? COPY.examplesHint : COPY.examplesNeedDevice}
        </p>
      </div>
      <ExampleRow title={COPY.exampleDrawings} items={examplesByKind('drawing')} connected={connected} onPick={useExample} />
      <ExampleRow title={COPY.exampleWords} items={examplesByKind('text')} connected={connected} onPick={useExample} />
    </section>
  )
}

function ExampleRow({
  title,
  items,
  connected,
  onPick,
}: {
  title: string
  items: ExampleArtwork[]
  connected: boolean
  onPick: (id: string) => void
}) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold text-muted">{title}</h3>
      <div className="mt-1.5 grid grid-cols-4 gap-2">
        {items.map((example) => (
          <button
            key={example.id}
            type="button"
            disabled={!connected}
            onClick={() => onPick(example.id)}
            className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface px-2 py-2 text-[12px] font-semibold disabled:opacity-40"
          >
            <ExamplePreview document={example.document} />
            <span>{example.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ExamplePreview({ document }: { document: SvgDocument }) {
  return (
    <svg
      viewBox={`0 0 ${document.widthMm} ${document.heightMm}`}
      className="h-14 w-full text-ink"
      aria-hidden="true"
    >
      {document.paths.map((path, index) => (
        <polyline
          key={index}
          points={path.points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={Math.max(document.widthMm, document.heightMm) / 28}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
