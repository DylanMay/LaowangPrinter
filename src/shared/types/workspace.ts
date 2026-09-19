export type WorkArea = {
  widthMm: number
  heightMm: number
}

export type Placement = {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  widthMm: number
  heightMm: number
}

export const DEFAULT_WORK_AREA: WorkArea = { widthMm: 300, heightMm: 200 }

export const BOUNDS_EPS_MM = 0.05

export function formatMm(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatSizeMm(widthMm: number, heightMm: number): string {
  return `${formatMm(widthMm)} × ${formatMm(heightMm)} mm`
}
