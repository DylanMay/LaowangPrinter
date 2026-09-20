/** 星光4N：Arduino Nano（CH340）+ GRBL 1.1，旧版行程 42 mm，6.45 起约 50 mm。 */
export const XINGGUANG_4N_WIDTH_MM = 50
export const XINGGUANG_4N_HEIGHT_MM = 50
export const XINGGUANG_4N_LEGACY_MM = 42
/** GRBL 出厂 $130/$131，星光固件若没改过会是这个值，不能当真实行程。 */
export const STOCK_GRBL_TRAVEL_MM = 250
export const XINGGUANG_4N_BAUD_RATES = [115200, 57600, 9600, 250000] as const
