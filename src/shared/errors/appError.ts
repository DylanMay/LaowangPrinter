export type AppErrorCode =
  | 'DEVICE_DISCONNECTED'
  | 'PORT_BUSY'
  | 'NO_DEVICE'
  | 'GRBL_ERROR'
  | 'GRBL_ALARM'
  | 'LASER_BLOCKED'
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
    hint: '请插上 USB 后再试一次。',
  },
  GRBL_ERROR: {
    userMessage: '雕刻机无法执行当前动作。',
    hint: '可能是图案或机器设置存在问题。',
  },
  GRBL_ALARM: {
    userMessage: '雕刻机处于异常状态。',
    hint: '请检查机器，然后重新归零。',
  },
  LASER_BLOCKED: {
    userMessage: '不会开启激光。',
    hint: '点动只会移动机器。',
  },
  UNKNOWN: {
    userMessage: '无法连接雕刻机。',
    hint: '请检查 USB 连接后再试。',
  },
}

export function toAppError(error: unknown): AppError {
  const technicalDetail = detailOf(error)
  const code = readCode(error, technicalDetail)
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
  if (/grbl error:\s*\d+/i.test(technicalDetail) || /^error:\s*\d+/i.test(technicalDetail)) {
    return 'GRBL_ERROR'
  }
  if (/alarm:\s*\d+/i.test(technicalDetail)) {
    return 'GRBL_ALARM'
  }
  return 'UNKNOWN'
}

export function formatUserError(error: AppError): string {
  return error.hint ? `${error.userMessage}${error.hint}` : error.userMessage
}
