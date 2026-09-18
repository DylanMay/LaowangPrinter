import type { Point } from '@shared/types/svg'
import type { WorkArea } from '@shared/types/workspace'

export type Viewport = {
  originX: number
  originY: number
  pxPerMm: number
  bedWidthPx: number
  bedHeightPx: number
  canvasWidth: number
  canvasHeight: number
}

export function layoutViewport(
  workArea: WorkArea,
  canvasWidth: number,
  canvasHeight: number,
  paddingPx = 24,
): Viewport {
  const innerW = Math.max(1, canvasWidth - paddingPx * 2)
  const innerH = Math.max(1, canvasHeight - paddingPx * 2)
  const pxPerMm = Math.min(innerW / workArea.widthMm, innerH / workArea.heightMm)
  const bedWidthPx = workArea.widthMm * pxPerMm
  const bedHeightPx = workArea.heightMm * pxPerMm
  return {
    originX: (canvasWidth - bedWidthPx) / 2,
    originY: (canvasHeight - bedHeightPx) / 2,
    pxPerMm,
    bedWidthPx,
    bedHeightPx,
    canvasWidth,
    canvasHeight,
  }
}

export function workspaceToPixel(point: Point, viewport: Viewport): Point {
  return {
    x: viewport.originX + point.x * viewport.pxPerMm,
    y: viewport.originY + point.y * viewport.pxPerMm,
  }
}

export function pixelToWorkspace(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.originX) / viewport.pxPerMm,
    y: (point.y - viewport.originY) / viewport.pxPerMm,
  }
}
