import { COPY } from '@shared/copy'
import { describe, expect, it } from 'vitest'

describe('普通用户文案', () => {
  it('首页使用中文产品语言', () => {
    expect(COPY.homeTitle).toBe('激光雕刻')
    expect(COPY.deviceDisconnected).toBe('未检测到雕刻机')
    expect(COPY.deviceConnected).toBe('雕刻机已连接')
    expect(COPY.myMachine).toBe('我的雕刻机')
    expect(COPY.dropTitleDisconnected).toBe('请先连接雕刻机')
  })

  it('默认文案不出现串口或 GRBL 术语', () => {
    const blob = JSON.stringify(COPY)
    expect(blob).not.toMatch(/GRBL|G-code|COM3|115200|M3|Feed Rate/i)
  })

  it('尺寸引导只用工作区域语言', () => {
    expect(COPY.sizeSetupTitle).toBe('设置工作区域')
    expect(COPY.sizeUnit).toBe('毫米')
  })
})
