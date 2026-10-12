import type { Point, SvgDocument } from '@shared/types/svg'

export type ExampleKind = 'drawing' | 'text'

export type ExampleArtwork = {
  id: string
  name: string
  kind: ExampleKind
  document: SvgDocument
}

/** 你：左边是人字旁，右边竖钩向右收，避免看成「休」。 */
const NI: Point[][] = [
  poly(6, 1, 1, 9),
  poly(3.5, 7, 3.5, 19),
  poly(8, 1, 18, 1),
  poly(12, 1, 12, 13, 17, 17),
  poly(8, 7, 18, 7),
  poly(12, 7, 8, 17),
  poly(14, 9, 18, 16),
]

/** 好 */
const HAO: Point[][] = [
  poly(7, 1, 1, 8, 11, 8),
  poly(6, 5, 1, 19),
  poly(1, 13, 12, 13),
  poly(12, 2, 18, 2, 18, 7),
  poly(15, 2, 15, 16, 12, 19),
  poly(12, 10, 18, 10),
]

/** 老：两横、短竖、一条长撇、右侧竖弯钩。不要再加一条右捺，否则会看成「天」。 */
const LAO: Point[][] = [
  poly(0, 1, 17, 1),
  poly(5, 1, 5, 6),
  poly(0, 6, 10, 6),
  poly(8, 6, 0, 19),
  poly(13, 6, 13, 14, 18, 18),
]

/** 王 */
const WANG: Point[][] = [
  poly(2, 3, 16, 3),
  poly(4, 10, 14, 10),
  poly(9, 3, 9, 17),
  poly(2, 17, 16, 17),
]

const DRAWINGS: ExampleArtwork[] = [
  { id: 'smile', name: '笑脸', kind: 'drawing', document: smile() },
  { id: 'heart', name: '爱心', kind: 'drawing', document: heart() },
  { id: 'star', name: '星星', kind: 'drawing', document: star() },
  { id: 'house', name: '小房子', kind: 'drawing', document: house() },
]

const WORDS: ExampleArtwork[] = [
  { id: 'hello', name: '你好', kind: 'text', document: textDocument(NI, HAO) },
  { id: 'laowang', name: '老王', kind: 'text', document: textDocument(LAO, WANG) },
]

export const EXAMPLES: ExampleArtwork[] = [...DRAWINGS, ...WORDS]

export function examplesByKind(kind: ExampleKind): ExampleArtwork[] {
  return EXAMPLES.filter((example) => example.kind === kind)
}

export function exampleById(id: string): ExampleArtwork | null {
  return EXAMPLES.find((example) => example.id === id) ?? null
}

function smile(): SvgDocument {
  return document(36, 36, [
    circle(18, 18, 15, 28),
    circle(12, 15, 1.4, 8),
    circle(24, 15, 1.4, 8),
    arc(18, 18, 8, Math.PI * 0.15, Math.PI * 0.85, 14),
  ])
}

function heart(): SvgDocument {
  const points: Point[] = []
  const steps = 48
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    points.push({ x, y })
  }
  return fit([[...points]], 32, 30)
}

function star(): SvgDocument {
  const points: Point[] = []
  for (let i = 0; i <= 10; i += 1) {
    const radius = i % 2 === 0 ? 14 : 6
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push({ x: 16 + radius * Math.cos(angle), y: 16 + radius * Math.sin(angle) })
  }
  return fit([points], 34, 34)
}

function house(): SvgDocument {
  return document(32, 30, [
    poly(2, 14, 16, 2, 30, 14),
    poly(5, 14, 5, 28, 27, 28, 27, 14),
    poly(13, 28, 13, 18, 19, 18, 19, 28),
  ])
}

function textDocument(left: Point[][], right: Point[][]): SvgDocument {
  return fit([...left, ...shift(right, 22, 0)], 40, 20, 0.8)
}

function shift(strokes: Point[][], dx: number, dy: number): Point[][] {
  return strokes.map((stroke) => stroke.map((point) => ({ x: point.x + dx, y: point.y + dy })))
}

function document(widthMm: number, heightMm: number, paths: Point[][]): SvgDocument {
  return {
    widthMm,
    heightMm,
    paths: paths.map((points) => ({ points: points.map(roundPoint) })),
  }
}

function fit(paths: Point[][], widthMm: number, heightMm: number, pad = 1): SvgDocument {
  const all = paths.flat()
  const minX = Math.min(...all.map((point) => point.x))
  const minY = Math.min(...all.map((point) => point.y))
  const maxX = Math.max(...all.map((point) => point.x))
  const maxY = Math.max(...all.map((point) => point.y))
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const scale = Math.min((widthMm - pad * 2) / spanX, (heightMm - pad * 2) / spanY)
  const usedW = spanX * scale
  const usedH = spanY * scale
  const originX = pad + (widthMm - pad * 2 - usedW) / 2
  const originY = pad + (heightMm - pad * 2 - usedH) / 2
  return document(
    widthMm,
    heightMm,
    paths.map((points) =>
      points.map((point) => ({
        x: originX + (point.x - minX) * scale,
        y: originY + (point.y - minY) * scale,
      })),
    ),
  )
}

function circle(cx: number, cy: number, radius: number, steps: number): Point[] {
  return arc(cx, cy, radius, 0, Math.PI * 2, steps)
}

function arc(cx: number, cy: number, radius: number, start: number, end: number, steps: number): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= steps; i += 1) {
    const angle = start + ((end - start) * i) / steps
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
  }
  return points
}

function poly(...coords: number[]): Point[] {
  const points: Point[] = []
  for (let i = 0; i < coords.length; i += 2) {
    points.push({ x: coords[i]!, y: coords[i + 1]! })
  }
  return points
}

function roundPoint(point: Point): Point {
  return { x: round(point.x), y: round(point.y) }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
