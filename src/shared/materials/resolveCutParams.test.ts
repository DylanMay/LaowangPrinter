import { describe, expect, it } from 'vitest'
import { resolveCutParams } from './resolveCutParams'

const compact = { widthMm: 50, heightMm: 200 }
const desk = { widthMm: 300, heightMm: 200 }

describe('resolveCutParams', () => {
  it('功率和速度跟材料和深度走，小床会加强但仍分档', () => {
    const light = resolveCutParams({
      material: 'wood',
      thicknessMm: 3,
      effect: 'light',
      workArea: compact,
    })
    const standard = resolveCutParams({
      material: 'wood',
      thicknessMm: 3,
      effect: 'standard',
      workArea: compact,
    })
    const deep = resolveCutParams({
      material: 'wood',
      thicknessMm: 3,
      effect: 'deep',
      workArea: compact,
    })
    expect(light).toEqual({ speed: 300, power: 60 })
    expect(standard).toEqual({ speed: 200, power: 80 })
    expect(deep).toEqual({ speed: 120, power: 100 })
    expect(light.power).toBeLessThan(standard.power)
    expect(standard.power).toBeLessThan(deep.power)

    const card = resolveCutParams({
      material: 'cardboard',
      thicknessMm: 3,
      effect: 'deep',
      workArea: compact,
    })
    expect(card.power).toBeLessThan(deep.power)
  })

  it('大床用材料预设，空载功率为 0，低功率按轻度', () => {
    expect(
      resolveCutParams({
        material: 'wood',
        thicknessMm: 3,
        effect: 'deep',
        workArea: desk,
      }),
    ).toEqual({ speed: 600, power: 30 })
    expect(
      resolveCutParams({
        material: 'wood',
        thicknessMm: 3,
        effect: 'deep',
        workArea: compact,
        dryRun: true,
      }).power,
    ).toBe(0)
    expect(
      resolveCutParams({
        material: 'wood',
        thicknessMm: 3,
        effect: 'deep',
        workArea: compact,
        lowPower: true,
      }),
    ).toEqual({ speed: 300, power: 60 })
  })
})
