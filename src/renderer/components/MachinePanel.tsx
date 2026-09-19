import { COPY } from '@shared/copy'
import type { JogFeed } from '@shared/types/machine'
import { JOG_FEEDS, JOG_STEPS } from '@shared/types/machine'
import { formatSizeMm } from '@shared/types/workspace'
import { useEffect, useState } from 'react'
import { jobGcode } from '../gcode/jobGcode'
import { useAppStore } from '../store/appStore'

const SPEED_LABELS: Record<JogFeed, string> = {
  100: COPY.speedSlow,
  500: COPY.speedMid,
  1000: COPY.speedFast,
  3000: COPY.speedFaster,
}

type PanelView = 'settings' | 'machine' | 'commands' | 'log'

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
  const jobProgress = useAppStore((state) => state.jobProgress)
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
  const advanced = useAppStore((state) => state.advanced)
  const loadAdvanced = useAppStore((state) => state.loadAdvanced)
  const [view, setView] = useState<PanelView>('settings')
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

  useEffect(() => {
    void loadAdvanced()
    const timer = window.setInterval(() => {
      void loadAdvanced()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [loadAdvanced])

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(28,24,20,0.35)] px-6">
      <div className="max-h-[680px] w-[520px] max-w-full overflow-auto rounded-3xl border border-line bg-surface p-6 shadow-[0_12px_40px_rgba(28,24,20,0.08)]">
        {view === 'commands' ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-center text-xl font-semibold">{COPY.pathCommandsTitle}</h2>
            <p className="text-center text-[13px] text-muted">{COPY.pathCommandsHint}</p>
            <pre className="max-h-64 overflow-auto rounded-xl bg-paper p-3 font-mono text-[11px] leading-relaxed text-ink">
              {gcode?.lines.join('\n') ?? COPY.pathCommandsEmpty}
            </pre>
            <button
              type="button"
              onClick={() => setView('settings')}
              className="h-10 self-center rounded-xl bg-ink px-4 text-sm font-semibold text-white"
            >
              {COPY.done}
            </button>
          </div>
        ) : view === 'log' ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-center text-xl font-semibold">{COPY.serialLogTitle}</h2>
            <p className="text-center text-[13px] text-muted">{COPY.serialLogHint}</p>
            <pre className="max-h-64 overflow-auto rounded-xl bg-paper p-3 font-mono text-[11px] leading-relaxed text-ink">
              {advanced?.serialLog.length ? advanced.serialLog.join('\n') : COPY.serialLogEmpty}
            </pre>
            <button
              type="button"
              onClick={() => setView('settings')}
              className="h-10 self-center rounded-xl bg-ink px-4 text-sm font-semibold text-white"
            >
              {COPY.done}
            </button>
          </div>
        ) : view === 'machine' ? (
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
                onClick={() => setView('settings')}
                className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
              >
                {COPY.done}
              </button>
            </div>
          </>
        ) : (
          <SettingsView
            connected={connected}
            workArea={workArea}
            maxPower={maxPower}
            jobBusy={jobBusy}
            sent={jobProgress.sentLines}
            total={jobProgress.totalLines}
            currentLine={jobProgress.currentLine}
            onCommands={() => setView('commands')}
            onLog={() => setView('log')}
            onMachine={() => setView('machine')}
            onDone={closePanel}
          />
        )}
      </div>
    </div>
  )
}

function SettingsView({
  connected,
  workArea,
  maxPower,
  jobBusy,
  sent,
  total,
  currentLine,
  onCommands,
  onLog,
  onMachine,
  onDone,
}: {
  connected: boolean
  workArea: { widthMm: number; heightMm: number } | null
  maxPower: number
  jobBusy: boolean
  sent: number
  total: number
  currentLine: string
  onCommands: () => void
  onLog: () => void
  onMachine: () => void
  onDone: () => void
}) {
  const advanced = useAppStore((state) => state.advanced)
  const deviceName = useAppStore((state) => state.deviceName)
  const size = workArea
    ? formatSizeMm(workArea.widthMm, workArea.heightMm)
    : advanced?.widthMm && advanced.heightMm
      ? formatSizeMm(advanced.widthMm, advanced.heightMm)
      : COPY.unknownValue

  return (
    <>
      <h2 className="text-center text-xl font-semibold">{COPY.advancedTitle}</h2>
      <p className="mt-2 text-center text-[13px] text-muted">{COPY.settingsBody}</p>
      <dl className="mt-5 grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-[13px]">
        <dt className="text-muted">{COPY.myMachine}</dt>
        <dd className="font-mono text-[12px]">{connected ? deviceName ?? COPY.myMachine : COPY.unknownValue}</dd>
        <dt className="text-muted">{COPY.advancedPort}</dt>
        <dd className="font-mono text-[12px]">{advanced?.portPath || COPY.unknownValue}</dd>
        <dt className="text-muted">{COPY.advancedBaud}</dt>
        <dd className="font-mono text-[12px]">{advanced ? String(advanced.baudRate) : COPY.unknownValue}</dd>
        <dt className="text-muted">{COPY.advancedFirmware}</dt>
        <dd className="font-mono text-[12px]">{advanced?.firmware || COPY.unknownValue}</dd>
        <dt className="text-muted">{COPY.advancedWorkArea}</dt>
        <dd className="font-mono text-[12px]">{size}</dd>
        <dt className="text-muted">{COPY.advancedMaxPower}</dt>
        <dd className="font-mono text-[12px]">{advanced?.maxPower ?? maxPower}</dd>
        <dt className="text-muted">{COPY.advancedLaserMode}</dt>
        <dd className="font-mono text-[12px]">
          {advanced ? (advanced.laserMode ? COPY.laserModeOn : COPY.laserModeOff) : COPY.unknownValue}
        </dd>
        {jobBusy || currentLine ? (
          <>
            <dt className="text-muted">{COPY.stepLabel}</dt>
            <dd className="font-mono text-[12px]">
              {sent} / {total}
            </dd>
            <dt className="text-muted">{COPY.advancedCurrent}</dt>
            <dd className="font-mono text-[12px]">{currentLine || COPY.unknownValue}</dd>
          </>
        ) : null}
      </dl>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={onCommands}
          className="h-10 rounded-xl border border-line px-4 text-sm font-semibold"
        >
          {COPY.viewPathCommands}
        </button>
        <button
          type="button"
          onClick={onLog}
          className="h-10 rounded-xl border border-line px-4 text-sm font-semibold"
        >
          {COPY.serialLogTitle}
        </button>
        <button
          type="button"
          onClick={onMachine}
          className="h-10 rounded-xl border border-line px-4 text-sm font-semibold"
        >
          {COPY.machineControl}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
        >
          {COPY.done}
        </button>
      </div>
    </>
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
