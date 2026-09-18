import { describe, expect, it } from 'vitest'
import type { SvgDocument } from '@shared/types/svg'
import {
  autoShrink,
  canStart,
  centerPlacement,
  isOutOfBounds,
  isTooLarge,
  machineBounds,
  placeImported,
  placementBounds,
  resizeFromWidth,
  scalePlacement,
  svgToMachine,
  svgToWorkspace,
  workspaceToMachine,
} from './CoordinateTransformer'

const workArea = { widthMm: 300, heightMm: 200 }

const doc: SvgDocument = {
  widthMm: 40,
  heightMm: 20,
  paths: [
    {
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 20 },
        { x: 0, y: 20 },
        { x: 0, y: 0 },
      ],
    },
  ],
}

describe('CoordinateTransformer', () => {
  it('居中后图案中心落在工作区中央', () => {
    const placement = centerPlacement(40, 20, workArea)
    expect(placement.xMm).toBe(130)
    expect(placement.yMm).toBe(90)
    const center = svgToWorkspace({ x: 20, y: 10 }, doc, placement)
    expect(center).toEqual({ x: 150, y: 100 })
  })

  it('Y 翻转只把工作区变成机器左下原点', () => {
    const placement = centerPlacement(40, 20, workArea)
    const svgTop = { x: 0, y: 0 }
    const svgBottom = { x: 0, y: 20 }
    const topWs = svgToWorkspace(svgTop, doc, placement)
    const bottomWs = svgToWorkspace(svgBottom, doc, placement)
    expect(topWs.y).toBeLessThan(bottomWs.y)

    const topMachine = workspaceToMachine(topWs, workArea)
    const bottomMachine = workspaceToMachine(bottomWs, workArea)
    expect(topMachine.y).toBeGreaterThan(bottomMachine.y)
    expect(svgToMachine(svgTop, doc, placement, workArea)).toEqual(topMachine)
    expect(topMachine).toEqual({ x: 130, y: 110 })
    expect(bottomMachine).toEqual({ x: 130, y: 90 })
  })

  it('改宽度并锁定比例时 bounds 跟着变', () => {
    const placed = centerPlacement(40, 20, workArea)
    const next = resizeFromWidth(placed, 80, true)
    expect(next.widthMm).toBe(80)
    expect(next.heightMm).toBe(40)
    expect(next.xMm + next.widthMm / 2).toBeCloseTo(placed.xMm + placed.widthMm / 2)
    expect(next.yMm + next.heightMm / 2).toBeCloseTo(placed.yMm + placed.heightMm / 2)
    const bounds = placementBounds(next)
    expect(bounds.widthMm).toBe(80)
    expect(bounds.heightMm).toBe(40)
    expect(bounds.minX).toBe(next.xMm)
    expect(bounds.maxY).toBe(next.yMm + 40)
    const machine = machineBounds(next, workArea)
    expect(machine.widthMm).toBe(80)
    expect(machine.heightMm).toBe(40)
    expect(machine.minY).toBeCloseTo(workArea.heightMm - (next.yMm + next.heightMm))
  })

  it('缩放后工作区与机器 bounds 尺寸一致', () => {
    const placed = centerPlacement(50, 30, workArea)
    const scaled = scalePlacement(placed, 2)
    expect(placementBounds(scaled).widthMm).toBe(100)
    expect(placementBounds(scaled).heightMm).toBe(60)
    expect(machineBounds(scaled, workArea).widthMm).toBe(100)
    expect(machineBounds(scaled, workArea).heightMm).toBe(60)
  })

  it('移出工作区时判定越界，过大时不能开始', () => {
    const centered = centerPlacement(40, 20, workArea)
    expect(isOutOfBounds(centered, workArea)).toBe(false)
    expect(canStart(centered, workArea)).toBe(true)
    const shifted = { ...centered, xMm: -10 }
    expect(isOutOfBounds(shifted, workArea)).toBe(true)
    expect(canStart(shifted, workArea)).toBe(false)
    const huge = centerPlacement(320, 100, workArea)
    expect(isTooLarge(huge, workArea)).toBe(true)
    expect(isOutOfBounds(huge, workArea)).toBe(true)
  })

  it('导入过大图案时按比例缩小并居中', () => {
    const big: SvgDocument = { ...doc, widthMm: 320, heightMm: 100 }
    const result = placeImported(big, workArea)
    expect(result.shrunk).toBe(true)
    expect(result.placement.widthMm).toBe(300)
    expect(result.placement.heightMm).toBeCloseTo(93.75)
    expect(result.placement.xMm).toBe(0)
    expect(result.placement.yMm + result.placement.heightMm / 2).toBeCloseTo(100)
    expect(isOutOfBounds(result.placement, workArea)).toBe(false)

    const shrink = autoShrink(320, 100, workArea)
    expect(shrink.widthMm).toBe(300)
    expect(shrink.heightMm).toBeCloseTo(93.75)
  })

  it('普通尺寸导入后默认居中', () => {
    const result = placeImported(doc, workArea)
    expect(result.shrunk).toBe(false)
    expect(result.placement).toEqual(centerPlacement(40, 20, workArea))
  })
})
