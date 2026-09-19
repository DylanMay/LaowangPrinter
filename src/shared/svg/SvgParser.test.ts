import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSvg } from './SvgParser'
import { cubicPoint, flattenCubic } from './bezier'
import { lengthToMm, parseLength, resolveViewport } from './SvgUnitConverter'

const fixtures = resolve(import.meta.dirname, 'fixtures')

function load(name: string): string {
  return readFileSync(resolve(fixtures, name), 'utf8')
}

describe('SvgUnitConverter', () => {
  it('把 px / mm / cm / in 转成毫米', () => {
    expect(lengthToMm(parseLength('96px')!)).toBeCloseTo(25.4, 6)
    expect(lengthToMm(parseLength('10mm')!)).toBe(10)
    expect(lengthToMm(parseLength('2cm')!)).toBe(20)
    expect(lengthToMm(parseLength('1in')!)).toBeCloseTo(25.4, 6)
    expect(lengthToMm(parseLength('96')!)).toBeCloseTo(25.4, 6)
  })

  it('用 width / height / viewBox 得到文档毫米尺寸', () => {
    const mm = resolveViewport({ width: '40mm', height: '20mm', viewbox: '0 0 40 20' })
    expect(mm.widthMm).toBe(40)
    expect(mm.heightMm).toBe(20)
    const px = resolveViewport({ width: '96px', height: '48px' })
    expect(px.widthMm).toBeCloseTo(25.4, 6)
    expect(px.heightMm).toBeCloseTo(12.7, 6)
    expect(px.viewBox).toEqual({ minX: 0, minY: 0, width: 96, height: 48 })
  })
})

describe('Bezier 离散', () => {
  it('按平坦度采样，而不是固定 5 个点', () => {
    const p0 = { x: 0, y: 0 }
    const p1 = { x: 0, y: 10 }
    const p2 = { x: 10, y: 10 }
    const p3 = { x: 10, y: 0 }
    const points = flattenCubic(p0, p1, p2, p3, 0.05)
    expect(points[0]).toEqual(p0)
    expect(points[points.length - 1]).toEqual(p3)
    expect(points.length).toBeGreaterThan(8)
    const mid = cubicPoint(p0, p1, p2, p3, 0.5)
    expect(mid.x).toBeCloseTo(5, 6)
    expect(mid.y).toBeCloseTo(7.5, 6)
  })
})

describe('SvgParser', () => {
  it('解析矩形得到毫米尺寸和闭合点列', () => {
    const doc = parseSvg(load('rect.svg'))
    expect(doc.widthMm).toBe(40)
    expect(doc.heightMm).toBe(20)
    expect(doc.paths).toHaveLength(1)
    expect(doc.paths[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 },
      { x: 0, y: 20 },
      { x: 0, y: 0 },
    ])
  })

  it('解析圆形为落在圆周上的点列', () => {
    const doc = parseSvg(load('circle.svg'))
    expect(doc.widthMm).toBe(20)
    expect(doc.heightMm).toBe(20)
    const points = doc.paths[0]?.points ?? []
    expect(points.length).toBeGreaterThan(8)
    for (const point of points) {
      expect(Math.hypot(point.x - 10, point.y - 10)).toBeCloseTo(8, 1)
    }
    expect(points[0]?.x).toBeCloseTo(18, 6)
    expect(points[0]?.y).toBeCloseTo(10, 6)
  })

  it('解析直线', () => {
    const doc = parseSvg(load('line.svg'))
    expect(doc.paths[0]?.points).toEqual([
      { x: 0, y: 5 },
      { x: 50, y: 5 },
    ])
  })

  it('解析 path 的 M L H V Z', () => {
    const doc = parseSvg(load('path.svg'))
    expect(doc.paths[0]?.points).toEqual([
      { x: 5, y: 5 },
      { x: 25, y: 5 },
      { x: 25, y: 25 },
      { x: 5, y: 25 },
      { x: 5, y: 5 },
    ])
  })

  it('把 C 命令离散成线段', () => {
    const doc = parseSvg(load('bezier.svg'))
    const points = doc.paths[0]?.points ?? []
    expect(points[0]).toEqual({ x: 0, y: 0 })
    expect(points[points.length - 1]).toEqual({ x: 10, y: 0 })
    expect(points.length).toBeGreaterThan(8)
    const peak = points.reduce((max, point) => (point.y > max.y ? point : max), points[0]!)
    expect(peak.y).toBeGreaterThan(6)
  })

  it('把 px 尺寸换成毫米', () => {
    const doc = parseSvg(load('units-px.svg'))
    expect(doc.widthMm).toBeCloseTo(25.4, 6)
    expect(doc.heightMm).toBeCloseTo(25.4, 6)
    expect(doc.paths[0]?.points[1]?.x).toBeCloseTo(25.4, 6)
    expect(doc.paths[0]?.points[1]?.y).toBeCloseTo(25.4, 6)
  })

  it('把 in / cm 换成毫米', () => {
    const inch = parseSvg(load('units-in.svg'))
    expect(inch.widthMm).toBeCloseTo(25.4, 6)
    expect(inch.heightMm).toBeCloseTo(12.7, 6)
    expect(inch.paths[0]?.points[2]?.x).toBeCloseTo(25.4, 5)
    expect(inch.paths[0]?.points[2]?.y).toBeCloseTo(12.7, 5)

    const cm = parseSvg(load('units-cm.svg'))
    expect(cm.widthMm).toBeCloseTo(20, 6)
    expect(cm.heightMm).toBeCloseTo(10, 6)
  })

  it('按 viewBox 把用户坐标映射到毫米', () => {
    const doc = parseSvg(load('viewbox.svg'))
    expect(doc.widthMm).toBe(200)
    expect(doc.heightMm).toBe(100)
    expect(doc.paths[0]?.points[1]).toEqual({ x: 200, y: 100 })
  })

  it('解析 polyline / polygon / ellipse，输出 Path[]', () => {
    const doc = parseSvg(load('mixed.svg'))
    expect(doc.paths).toHaveLength(3)
    expect(doc.paths[0]?.points).toEqual([
      { x: 0, y: 18 },
      { x: 8, y: 10 },
      { x: 16, y: 18 },
    ])
    expect(doc.paths[1]?.points[0]).toEqual({ x: 22, y: 18 })
    expect(doc.paths[1]?.points.at(-1)).toEqual({ x: 22, y: 18 })
    const ellipse = doc.paths[2]?.points ?? []
    expect(ellipse.length).toBeGreaterThan(8)
    expect(JSON.stringify(doc)).not.toMatch(/<svg|viewBox|path d=/i)
  })

  it('相对 path 与绝对 path 结果一致', () => {
    const absolute = parseSvg(
      '<svg width="10mm" height="10mm" viewBox="0 0 10 10"><path d="M1 1 L9 1 9 9 1 9 Z"/></svg>',
    )
    const relative = parseSvg(
      '<svg width="10mm" height="10mm" viewBox="0 0 10 10"><path d="m1 1 l8 0 0 8 -8 0 z"/></svg>',
    )
    expect(relative.paths[0]?.points).toEqual(absolute.paths[0]?.points)
  })
})
