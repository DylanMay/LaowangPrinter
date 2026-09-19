import { COPY } from '@shared/copy'
import type { JogFeed } from '@shared/types/machine'
import { JOG_FEEDS, JOG_STEPS } from '@shared/types/machine'
import { useState } from 'react'
import { jobGcode } from '../gcode/jobGcode'
import { useAppStore } from '../store/appStore'

const SPEED_LABELS: Record<JogFeed, string> = {
  100: COPY.speedSlow,
  500: COPY.speedMid,
  1000: COPY.speedFast,
  3000: COPY.speedFaster,
}

export function MachinePanel() {
  const connected = useAppStore((state) => state.deviceState === 'connected')
  const jogStep = useAppStore((state) => state.jogStep)
  const jogFeed = useAppStore((state) => state.jogFeed)
  const setJogStep = useAppStore((state) => state.setJogStep)
  const setJogFeed = useAppStore((state) => state.setJogFeed)
  const closePanel = useAppStore((state) => state.closePanel)
  const jog = useAppStore((state) => state.jog)
  const home = useAppStore((state) => state.home)
  const activity = useAppStore((state) => state.activity)
  const jobState = useAppStore((state) => state.jobProgress.state)
  const askReset = useAppStore((state) => state.askReset)
  const askStop = useAppStore((state) => state.askStop)
  const imported = useAppStore((state) => state.imported)
  const placement = useAppStore((state) => state.placement)
  const workArea = useAppStore((state) => state.workArea)
  const maxPower = useAppStore((state) => state.maxPower)
  const material = useAppStore((state) => state.material)
  const thicknessMm = useAppStore((state) => state.thicknessMm)
  const effect = useAppStore((state) => state.effect)
  const workMode = useAppStore((state) => state.workMode)
  const [viewCommands, setViewCommands] = useState(false)
  const jobBusy = jobState === 'running' || jobState === 'paused'
  const motionBusy = Boolean(activity) || jobBusy
  const gcode = jobGcode({
    imported,
    placement,
    workArea,
    maxPower,
    material,
    thicknessMm,
    effect,
    dryRun: workMode === 'dry',
  })

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(28,24,20,0.35)] px-6">
      <div className="w-[420px] max-w-full rounded-3xl border border-line bg-surface p-6 shadow-[0_12px_40px_rgba(28,24,20,0.08)]">
        {viewCommands ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-center text-xl font-semibold">{COPY.pathCommandsTitle}</h2>
            <p className="text-center text-[13px] text-muted">{COPY.pathCommandsHint}</p>
            <pre className="max-h-64 overflow-auto rounded-xl bg-paper p-3 font-mono text-[11px] leading-relaxed text-ink">
              {gcode?.lines.join('\n') ?? COPY.pathCommandsEmpty}
            </pre>
            <button
              type="button"
              onClick={() => setViewCommands(false)}
              className="h-10 self-center rounded-xl bg-ink px-4 text-sm font-semibold text-white"
            >
              {COPY.done}
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-center text-xl font-semibold">{COPY.machineControl}</h2>
            <p className="mt-2 text-center text-[13px] text-muted">{COPY.machineLead}</p>
            <div className="mt-5 flex justify-center gap-2">
              {JOG_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setJogStep(step)}
                  className={[
                    'h-9 rounded-xl px-3 text-sm font-semibold',
                    jogStep === step ? 'bg-ink text-white' : 'border border-line bg-paper',
                  ].join(' ')}
                >
                  {step} mm
                </button>
              ))}
            </div>
            <div className="mx-auto mt-5 grid w-[210px] grid-cols-3 gap-2">
              <span />
              <JogButton label={COPY.jogUp} disabled={!connected || motionBusy} onClick={() => void jog('Y', jogStep)} />
              <span />
              <JogButton label={COPY.jogLeft} disabled={!connected || motionBusy} onClick={() => void jog('X', -jogStep)} />
              <JogButton label={COPY.origin} disabled={!connected || motionBusy} onClick={() => void home()} />
              <JogButton label={COPY.jogRight} disabled={!connected || motionBusy} onClick={() => void jog('X', jogStep)} />
              <span />
              <JogButton label={COPY.jogDown} disabled={!connected || motionBusy} onClick={() => void jog('Y', -jogStep)} />
              <span />
            </div>
            <div className="mt-5 flex justify-center gap-2">
              {JOG_FEEDS.map((feed) => (
                <button
                  key={feed}
                  type="button"
                  onClick={() => setJogFeed(feed)}
                  className={[
                    'h-9 rounded-xl px-3 text-sm font-semibold',
                    jogFeed === feed ? 'bg-ink text-white' : 'border border-line bg-paper',
                  ].join(' ')}
                >
                  {SPEED_LABELS[feed]}
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setViewCommands(true)}
                className="h-10 rounded-xl border border-line px-4 text-sm font-semibold"
              >
                {COPY.viewPathCommands}
              </button>
              <button
                type="button"
                disabled={!connected}
                onClick={() => askReset()}
                className="h-10 rounded-xl border border-[#e8c9c4] px-4 text-sm font-semibold text-[#c4473a] disabled:opacity-40"
              >
                {COPY.resetMachine}
              </button>
              <button
                type="button"
                disabled={!connected}
                onClick={() => askStop()}
                className="h-10 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-40"
              >
                {COPY.stopNow}
              </button>
              <button
                type="button"
                onClick={() => closePanel()}
                className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
              >
                {COPY.done}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function JogButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-12 rounded-xl border border-line bg-paper text-sm font-semibold disabled:opacity-40"
    >
      {label}
    </button>
  )
}
