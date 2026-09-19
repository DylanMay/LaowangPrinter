export const MM_PER_INCH = 25.4
export const PX_PER_INCH = 96
export const PX_PER_MM = PX_PER_INCH / MM_PER_INCH

export const DEFAULT_SVG_WIDTH_PX = 300
export const DEFAULT_SVG_HEIGHT_PX = 150

export type LengthUnit = 'px' | 'mm' | 'cm' | 'in'

export type ParsedLength = {
  value: number
  unit: LengthUnit | '%' | ''
}

export type ViewBox = {
  minX: number
  minY: number
  width: number
  height: number
}

export type Viewport = {
  widthMm: number
  heightMm: number
  viewBox: ViewBox
}

const LENGTH = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(px|mm|cm|in|%)?$/i

export function parseLength(raw: string | undefined | null): ParsedLength | null {
  if (raw == null) return null
  const text = raw.trim()
  if (!text) return null
  const match = LENGTH.exec(text)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  const unit = (match[2]?.toLowerCase() ?? '') as ParsedLength['unit']
  return { value, unit }
}

export function pxToMm(px: number): number {
  return px / PX_PER_MM
}

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM
}

export function lengthToPx(length: ParsedLength): number {
  switch (length.unit) {
    case 'mm':
      return mmToPx(length.value)
    case 'cm':
      return mmToPx(length.value * 10)
    case 'in':
      return length.value * PX_PER_INCH
    case 'px':
    case '':
      return length.value
    case '%':
      return length.value
  }
}

export function lengthToMm(length: ParsedLength): number {
  switch (length.unit) {
    case 'mm':
      return length.value
    case 'cm':
      return length.value * 10
    case 'in':
      return length.value * MM_PER_INCH
    case 'px':
    case '':
      return pxToMm(length.value)
    case '%':
      return length.value
  }
}

export function parseViewBox(raw: string | undefined | null): ViewBox | null {
  if (raw == null) return null
  const parts = raw
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map(Number)
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null
  const [minX, minY, width, height] = parts as [number, number, number, number]
  if (width === 0 || height === 0) return null
  return { minX, minY, width, height }
}

export function resolveViewport(attrs: Record<string, string>): Viewport {
  const viewBox = parseViewBox(attrs.viewbox)
  const width = parseLength(attrs.width)
  const height = parseLength(attrs.height)

  const widthMm = physicalMm(width, viewBox?.width ?? DEFAULT_SVG_WIDTH_PX)
  const heightMm = physicalMm(height, viewBox?.height ?? DEFAULT_SVG_HEIGHT_PX)

  if (viewBox) {
    return { widthMm, heightMm, viewBox }
  }

  return {
    widthMm,
    heightMm,
    viewBox: {
      minX: 0,
      minY: 0,
      width: userExtent(width, widthMm),
      height: userExtent(height, heightMm),
    },
  }
}

export function userToMm(x: number, y: number, viewport: Viewport): { x: number; y: number } {
  const { viewBox, widthMm, heightMm } = viewport
  return {
    x: ((x - viewBox.minX) / viewBox.width) * widthMm,
    y: ((y - viewBox.minY) / viewBox.height) * heightMm,
  }
}

function physicalMm(length: ParsedLength | null, fallbackUser: number): number {
  if (!length) return pxToMm(fallbackUser)
  if (length.unit === '%') return pxToMm(fallbackUser * (length.value / 100))
  return lengthToMm(length)
}

function userExtent(length: ParsedLength | null, sizeMm: number): number {
  if (!length || length.unit === '%') return mmToPx(sizeMm)
  return lengthToPx(length)
}
