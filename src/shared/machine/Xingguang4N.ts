import type { CutParams } from '@shared/materials/MaterialPreset'

/** 星光4N：Arduino Nano（CH340）+ GRBL 1.1，旧版行程 42 mm，6.45 起约 50 mm。 */
export const XINGGUANG_4N_WIDTH_MM = 50
export const XINGGUANG_4N_HEIGHT_MM = 50
export const XINGGUANG_4N_LEGACY_MM = 42
/** GRBL 出厂 $130/$131，星光固件若没改过会是这个值，不能当真实行程。 */
export const STOCK_GRBL_TRAVEL_MM = 250
export const XINGGUANG_4N_BAUD_RATES = [115200, 57600, 9600, 250000] as const

/** 星光一类小床二极管大约 250–500mW，桌面机 20%/F1000 几乎刻不出痕迹。 */
export const COMPACT_BED_MAX_MM = 60
const COMPACT_SPEED_SCALE = 0.2
const COMPACT_POWER_SCALE = 4
const COMPACT_MIN_SPEED = 120
const COMPACT_MIN_POWER = 60
const COMPACT_MAX_POWER = 100

export function isCompactDiodeBed(workArea: { widthMm: number; heightMm: number }): boolean {
  return Math.max(workArea.widthMm, workArea.heightMm) <= COMPACT_BED_MAX_MM
}

export function tuneCutParams(params: CutParams, workArea: { widthMm: number; heightMm: number }): CutParams {
  if (!isCompactDiodeBed(workArea)) return { speed: params.speed, power: params.power }
  return {
    speed: Math.max(COMPACT_MIN_SPEED, Math.round(params.speed * COMPACT_SPEED_SCALE)),
    power: Math.min(COMPACT_MAX_POWER, Math.max(COMPACT_MIN_POWER, Math.round(params.power * COMPACT_POWER_SCALE))),
  }
}
