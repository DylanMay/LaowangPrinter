import type { Point } from '@shared/types/svg'

export const DEFAULT_FLATNESS_MM = 0.05
const MAX_DEPTH = 12

export function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  }
}

export function flattenCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  flatnessMm = DEFAULT_FLATNESS_MM,
): Point[] {
  const points: Point[] = [p0]
  subdivide(p0, p1, p2, p3, flatnessMm, 0, points)
  return points
}

function subdivide(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  flatnessMm: number,
  depth: number,
  points: Point[],
): void {
  if (depth >= MAX_DEPTH || isFlatEnough(p0, p1, p2, p3, flatnessMm)) {
    points.push(p3)
    return
  }
  const [l0, l1, l2, l3, r1, r2, r3] = splitCubic(p0, p1, p2, p3)
  subdivide(l0, l1, l2, l3, flatnessMm, depth + 1, points)
  subdivide(l3, r1, r2, r3, flatnessMm, depth + 1, points)
}

export function splitCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
): [Point, Point, Point, Point, Point, Point, Point] {
  const m01 = midpoint(p0, p1)
  const m12 = midpoint(p1, p2)
  const m23 = midpoint(p2, p3)
  const m012 = midpoint(m01, m12)
  const m123 = midpoint(m12, m23)
  const mid = midpoint(m012, m123)
  return [p0, m01, m012, mid, m123, m23, p3]
}

export function isFlatEnough(p0: Point, p1: Point, p2: Point, p3: Point, flatnessMm: number): boolean {
  return distanceToChord(p1, p0, p3) <= flatnessMm && distanceToChord(p2, p0, p3) <= flatnessMm
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distanceToChord(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-12) return Math.hypot(point.x - a.x, point.y - a.y)
  return Math.abs(dy * point.x - dx * point.y + b.x * a.y - b.y * a.x) / length
}
