import { COPY } from '@shared/copy'
import { describe, expect, it } from 'vitest'
import { cutParamsSummary } from './labels'

const compact = { widthMm: 50, heightMm: 200 }

describe('cutParamsSummary', () => {
  it('说明功率按材料和深度设定，深度比轻度更强更慢', () => {
    const light = cutParamsSummary({
      material: 'wood',
      thicknessMm: 3,
      effect: 'light',
      workArea: compact,
      workMode: 'engrave',
    })
    const deep = cutParamsSummary({
      material: 'wood',
      thicknessMm: 3,
      effect: 'deep',
      workArea: compact,
      workMode: 'engrave',
    })
    expect(light).toContain('3mm 木板 · 轻度')
    expect(light).toContain(COPY.powerMid)
    expect(deep).toContain('3mm 木板 · 深度')
    expect(deep).toContain(COPY.powerVeryHigh)
    expect(deep).toContain(COPY.paceVerySlow)
    expect(cutParamsSummary({
      material: 'wood',
      thicknessMm: 3,
      effect: 'deep',
      workArea: compact,
      workMode: 'dry',
    })).toBe(COPY.dryRunMoveHint)
  })
})
