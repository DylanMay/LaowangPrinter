import type { SvgDocument } from '@shared/types/svg'
import type { Placement, WorkArea } from '@shared/types/workspace'
import { placementBounds, workspacePaths } from '@shared/geometry/CoordinateTransformer'
import { type Viewport, workspaceToPixel } from './Viewport'

export type CanvasScene = {
  workArea: WorkArea
  document: SvgDocument
  placement: Placement
  outOfBounds: boolean
  head?: { x: number; y: number } | null
}

export function drawWorkspace(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  scene: CanvasScene,
  dpr = 1,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, viewport.canvasWidth, viewport.canvasHeight)
  drawBed(ctx, viewport, scene.outOfBounds)
  drawPattern(ctx, viewport, scene)
  if (scene.head) drawHead(ctx, viewport, scene.head)
}

function drawBed(ctx: CanvasRenderingContext2D, viewport: Viewport, outOfBounds: boolean): void {
  const { originX, originY, bedWidthPx, bedHeightPx } = viewport
  const bed = new Path2D()
  bed.rect(originX, originY, bedWidthPx, bedHeightPx)

  const fill = ctx.createLinearGradient(originX, originY, originX, originY + bedHeightPx)
  fill.addColorStop(0, '#f0dfc0')
  fill.addColorStop(1, '#e7d3ac')
  ctx.fillStyle = fill
  ctx.fill(bed)

  ctx.save()
  ctx.clip(bed)
  ctx.strokeStyle = 'rgba(92, 64, 32, 0.14)'
  ctx.lineWidth = 1
  const step = Math.max(8, viewport.pxPerMm * 20)
  for (let x = originX; x <= originX + bedWidthPx + 0.5; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, originY)
    ctx.lineTo(x, originY + bedHeightPx)
    ctx.stroke()
  }
  for (let y = originY; y <= originY + bedHeightPx + 0.5; y += step) {
    ctx.beginPath()
    ctx.moveTo(originX, y)
    ctx.lineTo(originX + bedWidthPx, y)
    ctx.stroke()
  }
  if (outOfBounds) {
    ctx.fillStyle = ctx.createPattern(hatchTile(), 'repeat') ?? 'rgba(196, 71, 58, 0.08)'
    ctx.fillRect(originX, originY, bedWidthPx, bedHeightPx)
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(92, 64, 32, 0.28)'
  ctx.lineWidth = 1
  ctx.stroke(bed)
}

function drawPattern(ctx: CanvasRenderingContext2D, viewport: Viewport, scene: CanvasScene): void {
  const paths = workspacePaths(scene.document, scene.placement)
  const lineWidth = Math.max(1.2, viewport.pxPerMm * 0.35)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = lineWidth

  ctx.strokeStyle = '#c4473a'
  strokePaths(ctx, viewport, paths)

  ctx.save()
  ctx.beginPath()
  ctx.rect(viewport.originX, viewport.originY, viewport.bedWidthPx, viewport.bedHeightPx)
  ctx.clip()
  ctx.strokeStyle = '#1c1814'
  strokePaths(ctx, viewport, paths)
  ctx.restore()
}

function strokePaths(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  paths: ReturnType<typeof workspacePaths>,
): void {
  for (const path of paths) {
    if (path.points.length < 2) continue
    ctx.beginPath()
    const first = workspaceToPixel(path.points[0]!, viewport)
    ctx.moveTo(first.x, first.y)
    for (const point of path.points.slice(1)) {
      const pixel = workspaceToPixel(point, viewport)
      ctx.lineTo(pixel.x, pixel.y)
    }
    ctx.stroke()
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  head: { x: number; y: number },
): void {
  const pixel = workspaceToPixel(head, viewport)
  const radius = Math.max(5, viewport.pxPerMm * 1.6)
  ctx.beginPath()
  ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = '#215c4c'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#fffcf7'
  ctx.stroke()
}

export function patternHit(scene: CanvasScene, workspacePoint: { x: number; y: number }): boolean {
  const bounds = placementBounds(scene.placement)
  const pad = 2
  return (
    workspacePoint.x >= bounds.minX - pad &&
    workspacePoint.x <= bounds.maxX + pad &&
    workspacePoint.y >= bounds.minY - pad &&
    workspacePoint.y <= bounds.maxY + pad
  )
}

function hatchTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas')
  tile.width = 16
  tile.height = 16
  const g = tile.getContext('2d')
  if (!g) return tile
  g.strokeStyle = 'rgba(196, 71, 58, 0.28)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(-4, 8)
  g.lineTo(8, -4)
  g.moveTo(0, 20)
  g.lineTo(20, 0)
  g.stroke()
  return tile
}
