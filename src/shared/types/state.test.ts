import type { DeviceState, JobState, MachineState } from '@shared/types/state'
import { describe, expect, it } from 'vitest'

describe('状态枚举', () => {
  it('设备状态互斥', () => {
    const states: DeviceState[] = ['disconnected', 'detecting', 'connecting', 'connected', 'error']
    expect(new Set(states).size).toBe(5)
  })

  it('机器与任务状态存在', () => {
    const machine: MachineState = 'unknown'
    const job: JobState = 'idle'
    expect(machine).toBe('unknown')
    expect(job).toBe('idle')
  })
})
