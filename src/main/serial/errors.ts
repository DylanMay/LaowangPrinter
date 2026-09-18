import { BAUD_RATES, type BaudRate } from './types'

export class PortBusyError extends Error {
  readonly code = 'PORT_BUSY' as const

  constructor(technicalDetail = 'Access denied') {
    super(technicalDetail)
    this.name = 'PortBusyError'
  }
}

export class PortNotFoundError extends Error {
  readonly code = 'NO_DEVICE' as const

  constructor(path?: string) {
    super(path ? `Port not found: ${path}` : 'Port not found')
    this.name = 'PortNotFoundError'
  }
}

export function isBaudRate(value: number): value is BaudRate {
  return (BAUD_RATES as readonly number[]).includes(value)
}
