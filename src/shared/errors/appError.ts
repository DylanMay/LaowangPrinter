export type AppErrorCode =
  | 'DEVICE_DISCONNECTED'
  | 'PORT_BUSY'
  | 'NO_DEVICE'
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
  if (code === 'PORT_BUSY' || code === 'NO_DEVICE' || code === 'DEVICE_DISCONNECTED') {
    return code
  }
  if (/access denied|eacces|ebusy|in use|cannot lock|resource busy|eperm/i.test(technicalDetail)) {
    return 'PORT_BUSY'
  }
  if (/disconnected|unplug|enxio|enoent/i.test(technicalDetail)) {
    return 'DEVICE_DISCONNECTED'
  }
  if (/not found|no port|no device/i.test(technicalDetail)) {
    return 'NO_DEVICE'
  }
  return 'UNKNOWN'
}

export function formatUserError(error: AppError): string {
  return error.hint ? `${error.userMessage}${error.hint}` : error.userMessage
}
