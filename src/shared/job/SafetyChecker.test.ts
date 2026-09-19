import { describe, expect, it } from 'vitest'
import { checkJobSafety } from './SafetyChecker'

const ready = { connected: true, alarm: false, inBounds: true, hasLines: true }

describe('SafetyChecker', () => {
  it('断开、异常、空路径、越界都会拦住任务', () => {
    expect(checkJobSafety({ ...ready, connected: false }).ok).toBe(false)
    expect(checkJobSafety({ ...ready, alarm: true }).ok).toBe(false)
    expect(checkJobSafety({ ...ready, hasLines: false }).ok).toBe(false)
    expect(checkJobSafety({ ...ready, inBounds: false }).ok).toBe(false)
    expect(checkJobSafety(ready)).toEqual({ ok: true })
  })

  it('失败原因使用中文，不出现协议术语', () => {
    const blob = JSON.stringify([
      checkJobSafety({ ...ready, connected: false }),
      checkJobSafety({ ...ready, alarm: true }),
      checkJobSafety({ ...ready, hasLines: false }),
    ])
    expect(blob).not.toMatch(/GRBL|G-code|COM3|M3|Feed Rate/i)
  })
})
