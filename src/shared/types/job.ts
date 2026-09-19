import type { JobState } from './state'

export type SenderState = 'idle' | 'running' | 'paused' | 'stopped' | 'error' | 'completed'

export type JobProgress = {
  state: SenderState
  jobState: JobState
  percent: number
  remainingSeconds: number
  elapsedSeconds: number
  estimatedTime: number
  sentLines: number
  totalLines: number
  currentLine: string
  dryRun: boolean
  lowPowerTest?: boolean
  errorMessage?: string
}

export type WorkMode = 'dry' | 'low' | 'engrave'

export type JobStartOptions = {
  lines: string[]
  estimatedTime: number
  dryRun?: boolean
  lowPowerTest?: boolean
  confirmLowPower?: boolean
  confirmed?: boolean
}

export type JobEventName = 'job:progress' | 'job:paused' | 'job:completed' | 'job:error'
