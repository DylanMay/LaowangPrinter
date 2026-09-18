export class GrblCommandError extends Error {
  readonly code = 'GRBL_ERROR' as const

  constructor(readonly grblCode: number) {
    super(`GRBL error:${grblCode}`)
    this.name = 'GrblCommandError'
  }
}

export class GrblAlarmError extends Error {
  readonly code = 'GRBL_ALARM' as const

  constructor(readonly alarmCode: number) {
    super(`ALARM:${alarmCode}`)
    this.name = 'GrblAlarmError'
  }
}

export class NotGrblError extends Error {
  readonly code = 'NOT_GRBL' as const

  constructor() {
    super('Not a GRBL device')
    this.name = 'NotGrblError'
  }
}
