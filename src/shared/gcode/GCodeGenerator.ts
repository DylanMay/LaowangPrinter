import { machineBounds, machinePaths } from '@shared/geometry/CoordinateTransformer'
import { pathLength } from '@shared/geometry/polyline'
import { cutParamsFor, getMaterialPreset, type EffectLevel, type MaterialId, type MaterialPreset } from '@shared/materials/MaterialPreset'
import type { SvgDocument } from '@shared/types/svg'
import type { GCodeDocument } from '@shared/types/gcode'
import type { Placement, WorkArea } from '@shared/types/workspace'
import { estimateTimeSeconds } from './GCodeEstimator'

export type GenerateGcodeInput = {
  document: SvgDocument
  placement: Placement
  workArea: WorkArea
  maxPower: number
  preset: MaterialPreset
  effect: EffectLevel
  dryRun?: boolean
}

export function spindleSpeed(maxPower: number, powerPercent: number): number {
  return Math.round((maxPower * powerPercent) / 100)
}

export function applyDryRunSafety(lines: string[]): string[] {
  const next = lines.map((line) => (/^M3\b/i.test(line.trim()) ? 'M5' : line))
  const collapsed: string[] = []
  for (const line of next) {
    if (line === 'M5' && collapsed[collapsed.length - 1] === 'M5') continue
    collapsed.push(line)
  }
  return collapsed
}

export type GenerateJobInput = Omit<GenerateGcodeInput, 'preset'> & {
  material: MaterialId
  thicknessMm: number
}

export function generateJobGcode(input: GenerateJobInput): GCodeDocument {
  return generateGcode({
    ...input,
    preset: getMaterialPreset(input.material, input.thicknessMm),
  })
}

export function generateGcode(input: GenerateGcodeInput): GCodeDocument {
  const params = cutParamsFor(input.preset, input.effect)
  const speed = spindleSpeed(input.maxPower, params.power)
  const paths = machinePaths(input.document, input.placement, input.workArea)
  const lines = ['G21', 'G90']
  let cuttingMm = 0
  let laserOn = false
  let last: { x: number; y: number } | null = null

  const ensureLaser = (on: boolean) => {
    if (on === laserOn) return
    lines.push(on ? `M3 S${speed}` : 'M5')
    laserOn = on
  }

  for (const path of paths) {
    const points = dedupe(path.points)
    if (points.length < 2) continue
    const start = points[0]!
    ensureLaser(false)
    if (!last || !samePoint(last, start)) {
      lines.push(`G0 X${fmt(start.x)} Y${fmt(start.y)}`)
      last = start
    }
    ensureLaser(true)
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i]!
      if (samePoint(last, point)) continue
      cuttingMm += pathLength([last!, point])
      const feed = i === 1 ? ` F${Math.round(params.speed)}` : ''
      lines.push(`G1 X${fmt(point.x)} Y${fmt(point.y)}${feed}`)
      last = point
    }
  }
  ensureLaser(false)

  const result: GCodeDocument = {
    lines: input.dryRun ? applyDryRunSafety(lines) : lines,
    estimatedTime: estimateTimeSeconds(cuttingMm, params.speed),
    bounds: machineBounds(input.placement, input.workArea),
  }
  return result
}

function fmt(value: number): string {
  return String(Number(value.toFixed(3)))
}

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
}

function dedupe(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = []
  for (const point of points) {
    const last = result[result.length - 1]
    if (last && samePoint(last, point)) continue
    result.push(point)
  }
  return result
}
