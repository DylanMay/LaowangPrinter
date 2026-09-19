import type { Path, Point } from '@shared/types/svg'
import { flattenCubic } from './bezier'

const TOKEN = /([MmLlHhVvCcZz])|([+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)/g

type Segment = {
  cmd: string
  nums: number[]
}

export function parsePathData(d: string): Path[] {
  const segments = tokenize(d)
  const paths: Path[] = []
  let current: Point[] = []
  let start: Point = { x: 0, y: 0 }
  let pen: Point = { x: 0, y: 0 }
  let previous = ''

  const commit = () => {
    if (current.length >= 2) paths.push({ points: current })
    current = []
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
      current = [{ ...first }]
      for (let i = 1; i < pairs; i += 1) {
        const point = apply(pen, nums[i * 2]!, nums[i * 2 + 1]!, relative)
        pushPoint(current, point)
        pen = point
      }
      previous = relative ? 'l' : 'L'
      continue
    }

    const used =
      letter === 'L' || letter === 'H' || letter === 'V' || letter === 'C' ? letter : previous.toUpperCase()
    if (current.length === 0) {
      current = [{ ...pen }]
      start = { ...pen }
    }

    if (used === 'L') {
      const pairs = pairCount(nums, 2)
      for (let i = 0; i < pairs; i += 1) {
        const point = apply(pen, nums[i * 2]!, nums[i * 2 + 1]!, relative)
        pushPoint(current, point)
        pen = point
      }
    } else if (used === 'H') {
      for (const value of nums) {
        const point = { x: relative ? pen.x + value : value, y: pen.y }
        pushPoint(current, point)
        pen = point
      }
    } else if (used === 'V') {
      for (const value of nums) {
        const point = { x: pen.x, y: relative ? pen.y + value : value }
        pushPoint(current, point)
        pen = point
      }
    } else if (used === 'C') {
      const curves = pairCount(nums, 6)
      for (let i = 0; i < curves; i += 1) {
        const base = i * 6
        const c1 = apply(pen, nums[base]!, nums[base + 1]!, relative)
        const c2 = apply(pen, nums[base + 2]!, nums[base + 3]!, relative)
        const end = apply(pen, nums[base + 4]!, nums[base + 5]!, relative)
        const flattened = flattenCubic(pen, c1, c2, end)
        for (const point of flattened.slice(1)) pushPoint(current, point)
        pen = end
      }
    }

    previous = cmd
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
