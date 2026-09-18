import { COPY } from '@shared/copy'

export type JobSafetyInput = {
  connected: boolean
  alarm: boolean
  inBounds: boolean
  hasLines: boolean
}

export type JobSafetyResult = { ok: true } | { ok: false; message: string }

export function checkJobSafety(input: JobSafetyInput): JobSafetyResult {
  if (!input.connected) return { ok: false, message: COPY.deviceUnplugged }
  if (input.alarm) return { ok: false, message: COPY.deviceAlarm }
  if (!input.hasLines) return { ok: false, message: COPY.emptyJob }
  if (!input.inBounds) return { ok: false, message: COPY.outOfBounds }
  return { ok: true }
}
