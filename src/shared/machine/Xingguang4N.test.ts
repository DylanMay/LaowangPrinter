import { XINGGUANG_4N_HEIGHT_MM, XINGGUANG_4N_WIDTH_MM, STOCK_GRBL_TRAVEL_MM } from './Xingguang4N'
import { describe, expect, it } from 'vitest'

describe('星光4N', () => {
  it('默认按 50 mm 工作区域，并识别出厂行程不可用', () => {
    expect(XINGGUANG_4N_WIDTH_MM).toBe(50)
    expect(XINGGUANG_4N_HEIGHT_MM).toBe(50)
    expect(STOCK_GRBL_TRAVEL_MM).toBe(250)
  })
})
