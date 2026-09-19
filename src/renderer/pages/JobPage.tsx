import { useState } from 'react'
import { COPY } from '@shared/copy'
import { formatDuration } from '@shared/gcode/GCodeEstimator'
import { canStart } from '@shared/geometry/CoordinateTransformer'
import { formatSizeMm } from '@shared/types/workspace'
import { WorkspaceCanvas } from '../components/WorkspaceCanvas'
import { jobGcode } from '../gcode/jobGcode'
import { useAppStore } from '../store/appStore'

export function JobPage() {
  const imported = useAppStore((state) => state.imported)
  const placement = useAppStore((state) => state.placement)
  const workArea = useAppStore((state) => state.workArea)
  const maxPower = useAppStore((state) => state.maxPower)
  const material = useAppStore((state) => state.material)
  const thicknessMm = useAppStore((state) => state.thicknessMm)
  const effect = useAppStore((state) => state.effect)
  const workMode = useAppStore((state) => state.workMode)
  const connected = useAppStore((state) => state.deviceState === 'connected')
  const goWorkspace = useAppStore((state) => state.goWorkspace)
  const goHome = useAppStore((state) => state.goHome)
  const startJob = useAppStore((state) => state.startJob)
  const pauseJob = useAppStore((state) => state.pauseJob)
  const resumeJob = useAppStore((state) => state.resumeJob)
  const resetJob = useAppStore((state) => state.resetJob)
  const askStop = useAppStore((state) => state.askStop)
  const requestConnect = useAppStore((state) => state.requestConnect)
  const job = useAppStore((state) => state.jobProgress)
  const inBounds = Boolean(placement && workArea && canStart(placement, workArea))
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
  const [placed, setPlaced] = useState(false)
  const [safe, setSafe] = useState(false)
  const [fits, setFits] = useState(false)
  const dry = workMode === 'dry' || job.dryRun
  const checksOk = dry ? true : placed && safe && fits
  const canConfirmStart = connected && Boolean(imported) && inBounds && Boolean(gcode) && checksOk
  const state = job.state

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="flex min-h-0 flex-1 flex-col px-6 pt-4">
        {imported && placement && workArea ? <WorkspaceCanvas /> : null}
      </section>
      <section className="shrink-0 border-t border-line bg-surface px-6 py-5">
        {state === 'running' ? (
          <RunningBar
            dry={dry}
            percent={job.percent}
            remaining={job.remainingSeconds}
            sent={job.sentLines}
            total={job.totalLines}
            onPause={() => void pauseJob()}
            onStop={askStop}
          />
        ) : state === 'paused' ? (
          <PausedBar
            percent={job.percent}
            remaining={job.remainingSeconds}
            onResume={() => void resumeJob()}
            onStop={askStop}
          />
        ) : state === 'completed' ? (
          <ResultBar
            title={COPY.jobCompleted}
            detail={`${COPY.elapsedLabel} ${formatDuration(job.elapsedSeconds)}`}
            primary={COPY.engraveAgain}
            secondary={COPY.backHome}
            onPrimary={resetJob}
            onSecondary={goHome}
          />
        ) : state === 'error' ? (
          <ResultBar
            title={job.errorMessage?.split('。')[0] || COPY.deviceUnplugged}
            detail={job.errorMessage || COPY.deviceUnplugged}
            primary={COPY.reconnect}
            secondary={COPY.backToWorkspace}
            onPrimary={() => void requestConnect()}
            onSecondary={goWorkspace}
          />
        ) : state === 'stopped' ? (
          <ResultBar
            title={COPY.jobStopped}
            detail={COPY.stopHint}
            primary={COPY.engraveAgain}
            secondary={COPY.backToWorkspace}
            onPrimary={resetJob}
            onSecondary={goWorkspace}
          />
        ) : (
          <div className="mx-auto flex w-[640px] max-w-full flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">{COPY.jobPlaceholderTitle}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {dry ? COPY.dryRunMoveHint : COPY.jobReady}
              </p>
            </div>
            <ul className="space-y-2 text-[14px]">
              <li>{connected ? '✓' : '○'} {COPY.deviceConnected}</li>
              <li>{imported ? '✓' : '○'} {COPY.importReady}</li>
              <li>{inBounds ? '✓' : '○'} {COPY.patternInBounds}</li>
              {gcode ? (
                <li>✓ {COPY.timeLabel} {formatDuration(gcode.estimatedTime)}</li>
              ) : null}
              {workArea && placement ? (
                <li>✓ {COPY.rangeLabel} {formatSizeMm(placement.widthMm, placement.heightMm)}</li>
              ) : null}
            </ul>
            {dry ? null : (
              <div className="flex flex-col gap-2 text-[14px]">
                <Check label={COPY.placeMaterial} checked={placed} onChange={setPlaced} />
                <Check label={COPY.workAreaSafe} checked={safe} onChange={setSafe} />
                <Check label={COPY.materialOk} checked={fits} onChange={setFits} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={goWorkspace}
                className="h-10 rounded-xl border border-line bg-paper px-4 text-sm font-semibold"
              >
                {COPY.backToWorkspace}
              </button>
              <button
                type="button"
                disabled={!canConfirmStart}
                onClick={() => void startJob()}
                className="h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:bg-[#ddd6cb] disabled:text-[#8a8278]"
              >
                {dry ? COPY.startDryRun : COPY.startEngrave}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function RunningBar({
  dry,
  percent,
  remaining,
  sent,
  total,
  onPause,
  onStop,
}: {
  dry: boolean
  percent: number
  remaining: number
  sent: number
  total: number
  onPause: () => void
  onStop: () => void
}) {
  return (
    <div className="mx-auto flex w-[720px] max-w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{dry ? COPY.dryRunning : COPY.engraving}</h2>
        <p className="text-[13px] text-muted">
          {percent}% · {COPY.remainingLabel} {formatDuration(remaining)}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[12px] text-muted">
        {COPY.stepLabel} {sent} / {total}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onPause}
          className="h-10 rounded-xl border border-line bg-paper px-4 text-sm font-semibold"
        >
          {COPY.pause}
        </button>
        <button
          type="button"
          onClick={onStop}
          className="h-10 rounded-xl border border-[#e8c9c4] px-4 text-sm font-semibold text-[#c4473a]"
        >
          {COPY.stopNow}
        </button>
      </div>
    </div>
  )
}

function PausedBar({
  percent,
  remaining,
  onResume,
  onStop,
}: {
  percent: number
  remaining: number
  onResume: () => void
  onStop: () => void
}) {
  return (
    <div className="mx-auto flex w-[720px] max-w-full flex-col gap-3">
      <h2 className="text-lg font-semibold">{COPY.paused}</h2>
      <p className="text-[13px] text-muted">
        {percent}% · {COPY.remainingLabel} {formatDuration(remaining)}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onResume}
          className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
        >
          {COPY.resume}
        </button>
        <button
          type="button"
          onClick={onStop}
          className="h-10 rounded-xl border border-[#e8c9c4] px-4 text-sm font-semibold text-[#c4473a]"
        >
          {COPY.stopNow}
        </button>
      </div>
    </div>
  )
}

function ResultBar({
  title,
  detail,
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: {
  title: string
  detail: string
  primary: string
  secondary: string
  onPrimary: () => void
  onSecondary: () => void
}) {
  return (
    <div className="mx-auto flex w-[640px] max-w-full flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-[13px] leading-relaxed text-muted">{detail}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onSecondary}
          className="h-10 rounded-xl border border-line bg-paper px-4 text-sm font-semibold"
        >
          {secondary}
        </button>
        <button
          type="button"
          onClick={onPrimary}
          className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
        >
          {primary}
        </button>
      </div>
    </div>
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}
