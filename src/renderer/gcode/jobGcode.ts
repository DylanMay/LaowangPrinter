import { generateJobGcode } from '@shared/gcode/GCodeGenerator'
import type { EffectLevel, MaterialId } from '@shared/materials/MaterialPreset'
import type { OpenSvgResult } from '@shared/types/svg'
import type { GCodeDocument } from '@shared/types/gcode'
import type { Placement, WorkArea } from '@shared/types/workspace'

export function jobGcode(args: {
  imported: OpenSvgResult | null
  placement: Placement | null
  workArea: WorkArea | null
  maxPower: number
  material: MaterialId
  thicknessMm: number
  effect: EffectLevel
  dryRun: boolean
}): GCodeDocument | null {
  if (!args.imported || !args.placement || !args.workArea) return null
  return generateJobGcode({
    document: args.imported.document,
    placement: args.placement,
    workArea: args.workArea,
    maxPower: args.maxPower,
    material: args.material,
    thicknessMm: args.thicknessMm,
    effect: args.effect,
    dryRun: args.dryRun,
  })
}
