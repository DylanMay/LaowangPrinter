import type { Path, Point } from '@shared/types/svg'

export function pathLength(points: Point[]): number {
  let length = 0
  for (let i = 1; i < points.length; i += 1) {
    length += distance(points[i - 1]!, points[i]!)
  }
  return length
}

export function totalPathLength(paths: Path[]): number {
  return paths.reduce((sum, path) => sum + pathLength(path.points), 0)
}

export function pointAlongPaths(paths: Path[], distanceAlong: number): Point | null {
  const total = totalPathLength(paths)
  if (total <= 0) return paths[0]?.points[0] ?? null
  let remaining = ((distanceAlong % total) + total) % total
  for (const path of paths) {
    for (let i = 1; i < path.points.length; i += 1) {
      const a = path.points[i - 1]!
      const b = path.points[i]!
      const seg = distance(a, b)
      if (seg < 1e-9) continue
      if (remaining <= seg) {
        const t = remaining / seg
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      }
      remaining -= seg
    }
  }
  return paths.at(-1)?.points.at(-1) ?? null
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}
