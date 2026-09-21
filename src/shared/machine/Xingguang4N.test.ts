import { XINGGUANG_4N_HEIGHT_MM, XINGGUANG_4N_WIDTH_MM, STOCK_GRBL_TRAVEL_MM, tuneCutParams } from './Xingguang4N'
import { describe, expect, it } from 'vitest'

describe('星光4N', () => {
  it('默认按 50 mm 工作区域，并识别出厂行程不可用', () => {
    expect(XINGGUANG_4N_WIDTH_MM).toBe(50)
    expect(XINGGUANG_4N_HEIGHT_MM).toBe(50)
    expect(STOCK_GRBL_TRAVEL_MM).toBe(250)
  })

  it('小床把木板标准档调到可出光的速度和功率，大床不改', () => {
    const wood = { speed: 1000, power: 20 }
    expect(tuneCutParams(wood, { widthMm: 300, heightMm: 200 })).toEqual(wood)
    expect(tuneCutParams(wood, { widthMm: 50, heightMm: 50 })).toEqual({ speed: 200, power: 80 })
    expect(tuneCutParams({ speed: 1500, power: 15 }, { widthMm: 42, heightMm: 42 })).toEqual({
      speed: 300,
      power: 60,
    })
  })
})
