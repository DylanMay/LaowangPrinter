import type { Path, Point } from '@shared/types/svg'
import { flattenCubic } from './bezier'

const TOKEN = /([MmLlHhVvCcQqTtSsAaZz])|([+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)/g

type Segment = {
  cmd: string
  nums: number[]
}

export function parsePathData(d: string, flatness = 0.05): Path[] {
  const segments = tokenize(d)
  const paths: Path[] = []
  let current: Point[] = []
  let start: Point = { x: 0, y: 0 }
  let pen: Point = { x: 0, y: 0 }
  let previous = ''
  let cubicCtrl: Point = { x: 0, y: 0 }
  let quadCtrl: Point = { x: 0, y: 0 }

  const commit = () => {
    if (current.length >= 2) paths.push({ points: current })
    current = []
  }

  const ensureCurrent = () => {
    if (current.length > 0) return
    current = [{ ...pen }]
    start = { ...pen }
  }

  const addCubic = (c1: Point, c2: Point, end: Point) => {
    const flattened = flattenCubic(pen, c1, c2, end, flatness)
    for (const point of flattened.slice(1)) pushPoint(current, point)
    cubicCtrl = c2
    quadCtrl = pen
    pen = end
    previous = 'C'
  }

  for (const segment of segments) {
    const cmd = segment.cmd
    const nums = segment.nums
    const relative = cmd === cmd.toLowerCase()
    const letter = cmd.toUpperCase()

    if (letter === 'Z') {
      if (current.length > 0 && !samePoint(current[current.length - 1]!, start)) {
        current.push({ ...start })
      }
      pen = { ...start }
      cubicCtrl = pen
      quadCtrl = pen
      previous = 'Z'
      continue
    }

    if (letter === 'M') {
      commit()
      const pairs = pairCount(nums, 2)
      if (pairs === 0) continue
      const first = apply(pen, nums[0]!, nums[1]!, relative)
      start = first
      pen = first
      cubicCtrl = pen
      quadCtrl = pen
      current = [{ ...first }]
      for (let i = 1; i < pairs; i += 1) {
        const point = apply(pen, nums[i * 2]!, nums[i * 2 + 1]!, relative)
        pushPoint(current, point)
        pen = point
      }
      previous = relative ? 'l' : 'L'
      continue
    }

    ensureCurrent()

    if (letter === 'L') {
      const pairs = pairCount(nums, 2)
      for (let i = 0; i < pairs; i += 1) {
        const point = apply(pen, nums[i * 2]!, nums[i * 2 + 1]!, relative)
        pushPoint(current, point)
        pen = point
      }
    } else if (letter === 'H') {
      for (const value of nums) {
        const point = { x: relative ? pen.x + value : value, y: pen.y }
        pushPoint(current, point)
        pen = point
      }
    } else if (letter === 'V') {
      for (const value of nums) {
        const point = { x: pen.x, y: relative ? pen.y + value : value }
        pushPoint(current, point)
        pen = point
      }
    } else if (letter === 'C') {
      const curves = pairCount(nums, 6)
      for (let i = 0; i < curves; i += 1) {
        const base = i * 6
        const c1 = apply(pen, nums[base]!, nums[base + 1]!, relative)
        const c2 = apply(pen, nums[base + 2]!, nums[base + 3]!, relative)
        const end = apply(pen, nums[base + 4]!, nums[base + 5]!, relative)
        addCubic(c1, c2, end)
      }
    } else if (letter === 'S') {
      const curves = pairCount(nums, 4)
      for (let i = 0; i < curves; i += 1) {
        const base = i * 4
        const reflected = previous === 'C' || previous === 'S' ? reflect(cubicCtrl, pen) : { ...pen }
        const c2 = apply(pen, nums[base]!, nums[base + 1]!, relative)
        const end = apply(pen, nums[base + 2]!, nums[base + 3]!, relative)
        addCubic(reflected, c2, end)
        previous = 'S'
      }
    } else if (letter === 'Q') {
      const curves = pairCount(nums, 4)
      for (let i = 0; i < curves; i += 1) {
        const base = i * 4
        const ctrl = apply(pen, nums[base]!, nums[base + 1]!, relative)
        const end = apply(pen, nums[base + 2]!, nums[base + 3]!, relative)
        const [c1, c2] = quadToCubic(pen, ctrl, end)
        addCubic(c1, c2, end)
        quadCtrl = ctrl
        previous = 'Q'
      }
    } else if (letter === 'T') {
      const pairs = pairCount(nums, 2)
      for (let i = 0; i < pairs; i += 1) {
        const ctrl = previous === 'Q' || previous === 'T' ? reflect(quadCtrl, pen) : { ...pen }
        const end = apply(pen, nums[i * 2]!, nums[i * 2 + 1]!, relative)
        const [c1, c2] = quadToCubic(pen, ctrl, end)
        addCubic(c1, c2, end)
        quadCtrl = ctrl
        previous = 'T'
      }
    } else if (letter === 'A') {
      const arcs = pairCount(nums, 7)
      for (let i = 0; i < arcs; i += 1) {
        const base = i * 7
        const end = apply(pen, nums[base + 5]!, nums[base + 6]!, relative)
        const points = flattenArc(
          pen,
          nums[base]!,
          nums[base + 1]!,
          nums[base + 2]!,
          nums[base + 3]! !== 0,
          nums[base + 4]! !== 0,
          end,
          flatness,
        )
        for (const point of points.slice(1)) pushPoint(current, point)
        pen = end
        cubicCtrl = pen
        quadCtrl = pen
        previous = 'A'
      }
    } else {
      const used = previous.toUpperCase()
      if (used === 'L') {
        const pairs = pairCount(nums, 2)
        for (let i = 0; i < pairs; i += 1) {
          const point = apply(pen, nums[i * 2]!, nums[i * 2 + 1]!, relative)
          pushPoint(current, point)
          pen = point
        }
      }
    }

    if (letter !== 'C' && letter !== 'S') cubicCtrl = pen
    if (letter !== 'Q' && letter !== 'T') quadCtrl = pen
    if (letter !== 'C' && letter !== 'S' && letter !== 'Q' && letter !== 'T' && letter !== 'A') {
      previous = cmd
    }
  }

  commit()
  return paths
}

function tokenize(d: string): Segment[] {
  const segments: Segment[] = []
  let current: Segment | null = null
  TOKEN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN.exec(d))) {
    if (match[1]) {
      current = { cmd: match[1], nums: [] }
      segments.push(current)
    } else if (current && match[2]) {
      current.nums.push(Number(match[2]))
    }
  }
  return segments
}

function apply(pen: Point, x: number, y: number, relative: boolean): Point {
  return relative ? { x: pen.x + x, y: pen.y + y } : { x, y }
}

function pairCount(nums: number[], arity: number): number {
  return Math.floor(nums.length / arity)
}

function pushPoint(points: Point[], point: Point): void {
  const last = points[points.length - 1]
  if (last && samePoint(last, point)) return
  points.push(point)
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
}

function reflect(control: Point, around: Point): Point {
  return { x: 2 * around.x - control.x, y: 2 * around.y - control.y }
}

function quadToCubic(p0: Point, p1: Point, p2: Point): [Point, Point] {
  return [
    { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) },
    { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) },
  ]
}

/** 弦高不超过 flatness，避免一条弯线被切成几百个几乎不动的小段。 */
function flattenArc(
  start: Point,
  rx: number,
  ry: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  end: Point,
  flatness: number,
): Point[] {
  if (samePoint(start, end) || rx === 0 || ry === 0) return [start, end]
  const phi = (rotationDeg * Math.PI) / 180
  const center = arcCenter(start, end, Math.abs(rx), Math.abs(ry), phi, largeArc, sweep)
  if (!center) return [start, end]
  const radius = Math.max(Math.abs(center.rx), Math.abs(center.ry), flatness)
  const step = Math.max(0.05, 2 * Math.acos(Math.min(1, Math.max(-1, 1 - flatness / radius))))
  const count = Math.max(1, Math.ceil(Math.abs(center.delta) / step))
  const points: Point[] = [start]
  for (let i = 1; i <= count; i += 1) {
    const t = center.theta + (center.delta * i) / count
    points.push(arcPoint(center.cx, center.cy, center.rx, center.ry, phi, t))
  }
  points[points.length - 1] = end
  return points
}

function arcCenter(
  start: Point,
  end: Point,
  rx: number,
  ry: number,
  phi: number,
  largeArc: boolean,
  sweep: boolean,
): { cx: number; cy: number; rx: number; ry: number; theta: number; delta: number } | null {
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (start.x - end.x) / 2
  const dy = (start.y - end.y) / 2
  const x1p = cos * dx + sin * dy
  const y1p = -sin * dx + cos * dy
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lam > 1) {
    const scale = Math.sqrt(lam)
    rx *= scale
    ry *= scale
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  if (den === 0) return null
  const sign = largeArc === sweep ? -1 : 1
  const coef = sign * Math.sqrt(Math.max(0, num / den))
  const cxp = coef * ((rx * y1p) / ry)
  const cyp = coef * ((-ry * x1p) / rx)
  const cx = cos * cxp - sin * cyp + (start.x + end.x) / 2
  const cy = sin * cxp + cos * cyp + (start.y + end.y) / 2
  const theta = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let delta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && delta > 0) delta -= Math.PI * 2
  if (sweep && delta < 0) delta += Math.PI * 2
  return { cx, cy, rx, ry, theta, delta }
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1
  const dot = ux * vx + uy * vy
  const mag = Math.hypot(ux, uy) * Math.hypot(vx, vy)
  if (mag === 0) return 0
  return sign * Math.acos(Math.min(1, Math.max(-1, dot / mag)))
}

function arcPoint(cx: number, cy: number, rx: number, ry: number, phi: number, theta: number): Point {
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  return {
    x: cx + rx * cosT * cosPhi - ry * sinT * sinPhi,
    y: cy + rx * cosT * sinPhi + ry * sinT * cosPhi,
  }
}
