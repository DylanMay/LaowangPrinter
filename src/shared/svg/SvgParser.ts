import type { Path, Point, SvgDocument } from '@shared/types/svg'
import { parsePathData } from './pathData'
import { flattenCubic } from './bezier'
import { parseLength, resolveViewport, userToMm, type Viewport } from './SvgUnitConverter'

const SKIP_BLOCKS = /<(defs|clippath|mask|symbol|pattern|marker|lineargradient|radialgradient|filter|style|script|title|desc|metadata)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
const COMMENT = /<!--[\s\S]*?-->/g
const ELEMENT =
  /<(line|polyline|polygon|rect|circle|ellipse|path)\b([^>]*?)(?:\/>|>[\s\S]*?<\/\1\s*>)/gi
const ATTR = /([:@A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
const KAPPA = 0.5522847498307936

export function parseSvg(source: string): SvgDocument {
  const markup = stripIgnored(source)
  const root = /<svg\b([^>]*)>/i.exec(markup)
  if (!root) {
    throw new Error('NOT_SVG')
  }
  const viewport = resolveViewport(parseAttributes(root[1] ?? ''))
  const paths: Path[] = []

  ELEMENT.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ELEMENT.exec(markup))) {
    const name = match[1]!.toLowerCase()
    const attrs = parseAttributes(match[2] ?? '')
    for (const path of elementToPaths(name, attrs)) {
      const mapped = mapPath(path, viewport)
      if (mapped.points.length >= 2) paths.push(mapped)
    }
  }

  return {
    widthMm: viewport.widthMm,
    heightMm: viewport.heightMm,
    paths,
  }
}

function stripIgnored(source: string): string {
  return source.replace(COMMENT, '').replace(SKIP_BLOCKS, '')
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  ATTR.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTR.exec(raw))) {
    attrs[match[1]!.toLowerCase()] = match[2] ?? match[3] ?? ''
  }
  return attrs
}

function elementToPaths(name: string, attrs: Record<string, string>): Path[] {
  switch (name) {
    case 'line':
      return linePath(attrs)
    case 'polyline':
      return polylinePath(attrs, false)
    case 'polygon':
      return polylinePath(attrs, true)
    case 'rect':
      return rectPath(attrs)
    case 'circle':
      return ellipsePath(num(attrs.cx), num(attrs.cy), num(attrs.r), num(attrs.r))
    case 'ellipse':
      return ellipsePath(num(attrs.cx), num(attrs.cy), num(attrs.rx), num(attrs.ry))
    case 'path':
      return attrs.d ? parsePathData(attrs.d) : []
    default:
      return []
  }
}

function linePath(attrs: Record<string, string>): Path[] {
  return [
    {
      points: [
        { x: num(attrs.x1), y: num(attrs.y1) },
        { x: num(attrs.x2), y: num(attrs.y2) },
      ],
    },
  ]
}

function polylinePath(attrs: Record<string, string>, close: boolean): Path[] {
  const points = parsePoints(attrs.points)
  if (points.length < 2) return []
  if (close && !samePoint(points[0]!, points[points.length - 1]!)) {
    points.push({ ...points[0]! })
  }
  return [{ points }]
}

function rectPath(attrs: Record<string, string>): Path[] {
  const x = num(attrs.x)
  const y = num(attrs.y)
  const width = num(attrs.width)
  const height = num(attrs.height)
  if (width <= 0 || height <= 0) return []
  const rxRaw = Math.abs(attrOr(attrs, 'rx', 'ry'))
  const ryRaw = Math.abs(attrOr(attrs, 'ry', 'rx'))
  const rx = Math.min(rxRaw, width / 2)
  const ry = Math.min(ryRaw, height / 2)
  if (rx <= 0 || ry <= 0) {
    return [
      {
        points: [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
          { x, y },
        ],
      },
    ]
  }
  const d = [
    `M ${x + rx} ${y}`,
    `H ${x + width - rx}`,
    `C ${x + width - rx * (1 - KAPPA)} ${y} ${x + width} ${y + ry * (1 - KAPPA)} ${x + width} ${y + ry}`,
    `V ${y + height - ry}`,
    `C ${x + width} ${y + height - ry * (1 - KAPPA)} ${x + width - rx * (1 - KAPPA)} ${y + height} ${x + width - rx} ${y + height}`,
    `H ${x + rx}`,
    `C ${x + rx * (1 - KAPPA)} ${y + height} ${x} ${y + height - ry * (1 - KAPPA)} ${x} ${y + height - ry}`,
    `V ${y + ry}`,
    `C ${x} ${y + ry * (1 - KAPPA)} ${x + rx * (1 - KAPPA)} ${y} ${x + rx} ${y}`,
    'Z',
  ].join(' ')
  return parsePathData(d)
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): Path[] {
  if (rx <= 0 || ry <= 0) return []
  const kx = rx * KAPPA
  const ky = ry * KAPPA
  const start = { x: cx + rx, y: cy }
  const cubics: Array<[Point, Point, Point]> = [
    [
      { x: cx + rx, y: cy + ky },
      { x: cx + kx, y: cy + ry },
      { x: cx, y: cy + ry },
    ],
    [
      { x: cx - kx, y: cy + ry },
      { x: cx - rx, y: cy + ky },
      { x: cx - rx, y: cy },
    ],
    [
      { x: cx - rx, y: cy - ky },
      { x: cx - kx, y: cy - ry },
      { x: cx, y: cy - ry },
    ],
    [
      { x: cx + kx, y: cy - ry },
      { x: cx + rx, y: cy - ky },
      { x: cx + rx, y: cy },
    ],
  ]
  const points: Point[] = [start]
  let pen = start
  for (const [c1, c2, end] of cubics) {
    const flat = flattenCubic(pen, c1, c2, end)
    points.push(...flat.slice(1))
    pen = end
  }
  return [{ points }]
}

function mapPath(path: Path, viewport: Viewport): Path {
  return {
    points: path.points.map((point) => userToMm(point.x, point.y, viewport)),
  }
}

function parsePoints(raw: string | undefined): Point[] {
  if (!raw) return []
  const nums = raw
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map(Number)
    .filter((value) => Number.isFinite(value))
  const points: Point[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push({ x: nums[i]!, y: nums[i + 1]! })
  }
  return points
}

function num(raw: string | undefined): number {
  const parsed = parseLength(raw)
  return parsed ? parsed.value : 0
}

function attrOr(attrs: Record<string, string>, primary: string, fallback: string): number {
  if (attrs[primary] != null) return Math.abs(num(attrs[primary]))
  if (attrs[fallback] != null) return Math.abs(num(attrs[fallback]))
  return 0
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
}
