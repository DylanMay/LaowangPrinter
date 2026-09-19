import { describe, expect, it } from 'vitest'
import { centerPlacement } from '@shared/geometry/CoordinateTransformer'
import { layoutViewport, pixelToWorkspace, workspaceToPixel } from './Viewport'

describe('Viewport', () => {
  it('工作区坐标映射到像素时不翻转 Y', () => {
    const viewport = layoutViewport({ widthMm: 300, heightMm: 200 }, 360, 248, 24)
    const top = workspaceToPixel({ x: 0, y: 0 }, viewport)
    const bottom = workspaceToPixel({ x: 0, y: 200 }, viewport)
    expect(top.y).toBeLessThan(bottom.y)
    expect(top.x).toBeCloseTo(viewport.originX)
    expect(bottom.y).toBeCloseTo(viewport.originY + viewport.bedHeightPx)

    const roundTrip = pixelToWorkspace(workspaceToPixel({ x: 40, y: 20 }, viewport), viewport)
    expect(roundTrip.x).toBeCloseTo(40)
    expect(roundTrip.y).toBeCloseTo(20)
  })

  it('导入后的工作区像素位置与内部 bounds 一致且不翻转', () => {
    const workArea = { widthMm: 300, heightMm: 200 }
    const placement = centerPlacement(80, 40, workArea)
    const viewport = layoutViewport(workArea, 360, 248, 24)
    const topLeft = workspaceToPixel({ x: placement.xMm, y: placement.yMm }, viewport)
    const bottomRight = workspaceToPixel(
      { x: placement.xMm + placement.widthMm, y: placement.yMm + placement.heightMm },
      viewport,
    )
    expect(bottomRight.x - topLeft.x).toBeCloseTo(placement.widthMm * viewport.pxPerMm)
    expect(bottomRight.y - topLeft.y).toBeCloseTo(placement.heightMm * viewport.pxPerMm)
    expect(topLeft.y).toBeLessThan(bottomRight.y)
  })
})
