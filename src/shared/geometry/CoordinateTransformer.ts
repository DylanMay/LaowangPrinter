import type { Path, Point, SvgDocument } from '@shared/types/svg'
import {
  BOUNDS_EPS_MM,
  DEFAULT_WORK_AREA,
  type Bounds,
  type Placement,
  type WorkArea,
} from '@shared/types/workspace'

export { BOUNDS_EPS_MM, DEFAULT_WORK_AREA }

export function svgToWorkspace(point: Point, document: SvgDocument, placement: Placement): Point {
  const sx = placement.widthMm / document.widthMm
  const sy = placement.heightMm / document.heightMm
  return {
    x: placement.xMm + point.x * sx,
    y: placement.yMm + point.y * sy,
  }
}

export function workspaceToMachine(point: Point, workArea: WorkArea): Point {
  return {
    x: point.x,
    y: workArea.heightMm - point.y,
  }
}

export function svgToMachine(
  point: Point,
  document: SvgDocument,
  placement: Placement,
  workArea: WorkArea,
): Point {
  return workspaceToMachine(svgToWorkspace(point, document, placement), workArea)
}

export function workspacePaths(document: SvgDocument, placement: Placement): Path[] {
  return document.paths.map((path) => ({
    points: path.points.map((point) => svgToWorkspace(point, document, placement)),
  }))
}

export function machinePaths(document: SvgDocument, placement: Placement, workArea: WorkArea): Path[] {
  return document.paths.map((path) => ({
    points: path.points.map((point) => svgToMachine(point, document, placement, workArea)),
  }))
}

export function placementBounds(placement: Placement): Bounds {
  return {
    minX: placement.xMm,
    minY: placement.yMm,
    maxX: placement.xMm + placement.widthMm,
    maxY: placement.yMm + placement.heightMm,
    widthMm: placement.widthMm,
    heightMm: placement.heightMm,
  }
}

export function machineBounds(placement: Placement, workArea: WorkArea): Bounds {
  const ws = placementBounds(placement)
  const a = workspaceToMachine({ x: ws.minX, y: ws.minY }, workArea)
  const b = workspaceToMachine({ x: ws.maxX, y: ws.maxY }, workArea)
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  return {
    minX,
    minY,
    maxX,
    maxY,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
  }
}

export function isOutOfBounds(placement: Placement, workArea: WorkArea, eps = BOUNDS_EPS_MM): boolean {
  const bounds = placementBounds(placement)
  return (
    bounds.minX < -eps ||
    bounds.minY < -eps ||
    bounds.maxX > workArea.widthMm + eps ||
    bounds.maxY > workArea.heightMm + eps
  )
}

export function isTooLarge(placement: Placement, workArea: WorkArea, eps = BOUNDS_EPS_MM): boolean {
  return placement.widthMm > workArea.widthMm + eps || placement.heightMm > workArea.heightMm + eps
}

export function canStart(placement: Placement, workArea: WorkArea): boolean {
  return !isOutOfBounds(placement, workArea) && !isTooLarge(placement, workArea)
}

export function centerPlacement(widthMm: number, heightMm: number, workArea: WorkArea): Placement {
  return {
    xMm: (workArea.widthMm - widthMm) / 2,
    yMm: (workArea.heightMm - heightMm) / 2,
    widthMm,
    heightMm,
  }
}

export function fitPlacement(widthMm: number, heightMm: number, workArea: WorkArea): Placement {
  const scale = Math.min(workArea.widthMm / widthMm, workArea.heightMm / heightMm)
  return centerPlacement(widthMm * scale, heightMm * scale, workArea)
}

export function autoShrink(widthMm: number, heightMm: number, workArea: WorkArea): Placement {
  const scale = Math.min(1, workArea.widthMm / widthMm, workArea.heightMm / heightMm)
  return centerPlacement(widthMm * scale, heightMm * scale, workArea)
}

export function placeImported(
  document: SvgDocument,
  workArea: WorkArea,
): { placement: Placement; shrunk: boolean } {
  const shrunk = isTooLarge(
    { xMm: 0, yMm: 0, widthMm: document.widthMm, heightMm: document.heightMm },
    workArea,
  )
  if (shrunk) {
    return { placement: autoShrink(document.widthMm, document.heightMm, workArea), shrunk: true }
  }
  return { placement: centerPlacement(document.widthMm, document.heightMm, workArea), shrunk: false }
}

export function movePlacement(placement: Placement, dxMm: number, dyMm: number): Placement {
  return {
    ...placement,
    xMm: placement.xMm + dxMm,
    yMm: placement.yMm + dyMm,
  }
}

export function resizeFromWidth(placement: Placement, widthMm: number, lockRatio: boolean): Placement {
  if (!Number.isFinite(widthMm) || widthMm <= 0) return placement
  const heightMm = lockRatio ? widthMm * (placement.heightMm / placement.widthMm) : placement.heightMm
  if (!Number.isFinite(heightMm) || heightMm <= 0) return placement
  return resizeAroundCenter(placement, widthMm, heightMm)
}

export function resizeFromHeight(placement: Placement, heightMm: number, lockRatio: boolean): Placement {
  if (!Number.isFinite(heightMm) || heightMm <= 0) return placement
  const widthMm = lockRatio ? heightMm * (placement.widthMm / placement.heightMm) : placement.widthMm
  if (!Number.isFinite(widthMm) || widthMm <= 0) return placement
  return resizeAroundCenter(placement, widthMm, heightMm)
}

export function scalePlacement(placement: Placement, factor: number): Placement {
  if (!Number.isFinite(factor) || factor <= 0) return placement
  return resizeAroundCenter(placement, placement.widthMm * factor, placement.heightMm * factor)
}

function resizeAroundCenter(placement: Placement, widthMm: number, heightMm: number): Placement {
  const cx = placement.xMm + placement.widthMm / 2
  const cy = placement.yMm + placement.heightMm / 2
  return {
    xMm: cx - widthMm / 2,
    yMm: cy - heightMm / 2,
    widthMm,
    heightMm,
  }
}
