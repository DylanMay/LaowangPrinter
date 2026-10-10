import { tuneCutParams } from '@shared/machine/Xingguang4N'
import {
  cutParamsFor,
  getMaterialPreset,
  type CutParams,
  type EffectLevel,
  type MaterialId,
  type MaterialPreset,
} from './MaterialPreset'

export function resolvePresetParams(
  preset: MaterialPreset,
  effect: EffectLevel,
  workArea: { widthMm: number; heightMm: number },
  dryRun = false,
): CutParams {
  const tuned = tuneCutParams(cutParamsFor(preset, effect), workArea)
  if (dryRun) return { speed: tuned.speed, power: 0 }
  return tuned
}

export function resolveCutParams(input: {
  material: MaterialId
  thicknessMm: number
  effect: EffectLevel
  workArea: { widthMm: number; heightMm: number }
  dryRun?: boolean
  lowPower?: boolean
}): CutParams {
  const effect = input.lowPower ? 'light' : input.effect
  return resolvePresetParams(
    getMaterialPreset(input.material, input.thicknessMm),
    effect,
    input.workArea,
    Boolean(input.dryRun),
  )
}
