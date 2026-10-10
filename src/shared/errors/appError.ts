import { COPY } from '@shared/copy'

export type AppErrorCode =
  | 'DEVICE_DISCONNECTED'
  | 'PORT_BUSY'
  | 'NO_DEVICE'
  | 'GRBL_ERROR'
  | 'GRBL_ALARM'
  | 'LASER_BLOCKED'
  | 'MACHINE_TIMEOUT'
  | 'UNKNOWN'

export type AppError = {
  code: AppErrorCode
  userMessage: string
  hint?: string
  technicalDetail?: string
}

export const USER_ERRORS: Record<AppErrorCode, { userMessage: string; hint?: string }> = {
  DEVICE_DISCONNECTED: {
    userMessage: '雕刻机连接已断开。',
    hint: '请检查 USB 连接。',
  },
  PORT_BUSY: {
    userMessage: '无法连接雕刻机。',
    hint: '可能有其他软件正在使用这台设备。',
  },
  NO_DEVICE: {
    userMessage: '没有检测到雕刻机。',
    hint: '请插上 USB，并关掉其他雕刻软件。星光4N 在 Mac 上可能要先装厂家的 USB 驱动。',
  },
  GRBL_ERROR: {
    userMessage: '雕刻机无法执行当前动作。',
    hint: '可能是图案或机器设置存在问题。',
  },
  GRBL_ALARM: {
    userMessage: '雕刻机处于锁定状态。',
    hint: '请点「解除异常」后再试。',
  },
  LASER_BLOCKED: {
    userMessage: '不会开启激光。',
    hint: '点动只会移动机器。',
  },
  MACHINE_TIMEOUT: {
    userMessage: '这一步没有完成。',
    hint: '机器还连着，请再点开始。不用拔线。',
  },
  UNKNOWN: {
    userMessage: '无法连接雕刻机。',
    hint: '请检查 USB 连接后再试。',
  },
}

export function toAppError(error: unknown): AppError {
  const technicalDetail = detailOf(error)
  const code = readCode(error, technicalDetail)
  if (code === 'GRBL_ALARM' && (alarmCodeOf(error) === 3 || /ALARM:3\b/i.test(technicalDetail))) {
    return {
      code,
      userMessage: COPY.stopWhileMoving,
      hint: COPY.stopWhileMovingHint,
      technicalDetail,
    }
  }
  return {
    code,
    ...USER_ERRORS[code],
    technicalDetail,
  }
}

function detailOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

function readCode(error: unknown, technicalDetail: string): AppErrorCode {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'GRBL_ERROR' && grblCodeOf(error) === 9) {
    return 'GRBL_ALARM'
  }
  if (code === 'PORT_BUSY' || code === 'DEVICE_DISCONNECTED' || code === 'GRBL_ERROR' || code === 'GRBL_ALARM' || code === 'LASER_BLOCKED') {
    return code
  }
  if (code === 'NO_DEVICE' || code === 'NOT_GRBL') {
    return 'NO_DEVICE'
  }
  if (/access denied|eacces|ebusy|in use|cannot lock|resource busy|eperm/i.test(technicalDetail)) {
    return 'PORT_BUSY'
  }
  if (/disconnected|unplug|enxio|enoent/i.test(technicalDetail)) {
    return 'DEVICE_DISCONNECTED'
  }
  if (/not found|no port|no device|not a grbl/i.test(technicalDetail)) {
    return 'NO_DEVICE'
  }
  if (/grbl error:\s*9\b/i.test(technicalDetail) || /^error:\s*9\b/i.test(technicalDetail)) {
    return 'GRBL_ALARM'
  }
  if (/grbl error:\s*\d+/i.test(technicalDetail) || /^error:\s*\d+/i.test(technicalDetail)) {
    return 'GRBL_ERROR'
  }
  if (/alarm:\s*\d+/i.test(technicalDetail)) {
    return 'GRBL_ALARM'
  }
  if (/grbl timeout/i.test(technicalDetail)) {
    return 'MACHINE_TIMEOUT'
  }
  return 'UNKNOWN'
}

export function formatUserError(error: AppError): string {
  return error.hint ? `${error.userMessage}${error.hint}` : error.userMessage
}

function grblCodeOf(error: unknown): number | null {
  if (typeof error !== 'object' || !error || !('grblCode' in error)) return null
  const value = Number((error as { grblCode: unknown }).grblCode)
  return Number.isFinite(value) ? value : null
}

function alarmCodeOf(error: unknown): number | null {
  if (typeof error !== 'object' || !error || !('alarmCode' in error)) return null
  const value = Number((error as { alarmCode: unknown }).alarmCode)
  return Number.isFinite(value) ? value : null
}
