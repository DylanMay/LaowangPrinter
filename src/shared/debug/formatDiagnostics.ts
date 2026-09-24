import { APP_NAME } from '@shared/copy'
import type { JobProgress } from '@shared/types/job'
import type { MachineConfig } from '@shared/types/machine'
import type { DeviceStatus } from '@shared/types/state'

export type DiagnosticsInput = {
  appVersion: string
  status: DeviceStatus
  config: MachineConfig | null
  portPath: string | null
  baudRate: number
  lastAlarm: string | null
  lastError: string | null
  serialLog: string[]
  job?: Pick<JobProgress, 'sentLines' | 'totalLines' | 'currentLine' | 'dryRun' | 'state'>
}

export function formatDiagnostics(input: DiagnosticsInput): string {
  const settings = input.config?.settings ?? {}
  const settingLines = Object.entries(settings)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([key, value]) => `$${key}=${value}`)
  const travel = settingLines.length
    ? `${fmtSetting(settings[130])} × ${fmtSetting(settings[131])}`
    : '—'
  const workArea = input.status.workArea
    ? `${input.status.workArea.widthMm} × ${input.status.workArea.heightMm}`
    : input.config?.widthMm && input.config.heightMm
      ? `${input.config.widthMm} × ${input.config.heightMm}`
      : '—'
  const job = input.job
  const lines = [
    `${APP_NAME} ${input.appVersion}`,
    `设备状态 ${input.status.state}`,
    `机器状态 ${input.status.machineState ?? '—'}`,
    `说明 ${input.status.errorMessage || '—'}`,
    `最近异常 ${input.lastAlarm || '—'}`,
    `最近错误 ${input.lastError || '—'}`,
    `接口 ${input.portPath || '—'}`,
    `通信速率 ${input.baudRate || '—'}`,
    `固件 ${input.config?.firmware || '—'}`,
    `工作区域 ${workArea}`,
    `固件行程 ${travel}`,
    `功率 ${fmtSetting(settings[30])} / ${fmtSetting(settings[31])}  激光模式 ${fmtSetting(settings[32])}`,
    `限位 软=${fmtSetting(settings[20])} 硬=${fmtSetting(settings[21])}`,
    job
      ? `任务 ${job.state} ${job.sentLines}/${job.totalLines}${job.dryRun ? ' 空载' : ''}`
      : '任务 —',
    `当前 ${job?.currentLine || '—'}`,
    '',
    '参数',
    ...(settingLines.length ? settingLines : ['—']),
    '',
    '通信记录',
    ...(input.serialLog.length ? input.serialLog : ['—']),
  ]
  return lines.join('\n')
}

function fmtSetting(value: number | undefined): string {
  return value === undefined ? '—' : String(value)
}
