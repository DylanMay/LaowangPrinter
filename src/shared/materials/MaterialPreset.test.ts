import { describe, expect, it } from 'vitest'
import { getMaterialPreset } from './MaterialPreset'

describe('MaterialPreset', () => {
  it('木板 3mm 三档落地，其他材料有占位', () => {
    const wood = getMaterialPreset('wood', 3)
    expect(wood.light).toEqual({ speed: 1500, power: 15 })
    expect(wood.standard).toEqual({ speed: 1000, power: 20 })
    expect(wood.deep).toEqual({ speed: 600, power: 30 })
    expect(getMaterialPreset('bamboo', 3).material).toBe('bamboo')
    expect(getMaterialPreset('wood', 9).thickness).toBe(3)
  })
})
