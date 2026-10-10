import { COPY } from '@shared/copy'
import type { EffectLevel, MaterialId } from '@shared/materials/MaterialPreset'
import { resolveCutParams } from '@shared/materials/resolveCutParams'
import type { WorkMode } from '@shared/types/job'

const MATERIALS: Record<MaterialId, string> = {
  wood: COPY.wood,
  bamboo: COPY.bamboo,
  cardboard: COPY.cardboard,
  leather: COPY.leather,
  acrylic: COPY.acrylic,
}

const EFFECTS: Record<EffectLevel, string> = {
  light: COPY.effectLight,
  standard: COPY.effectStandard,
  deep: COPY.effectDeep,
}

export function materialLabel(material: MaterialId, thicknessMm: number, effect: EffectLevel): string {
  return `${thicknessMm}mm ${MATERIALS[material]} · ${EFFECTS[effect]}`
}

export function startLabel(mode: WorkMode): string {
  if (mode === 'dry') return COPY.startDryRun
  if (mode === 'low') return COPY.startLowPower
  return COPY.startEngrave
}

export function runningLabel(dryRun: boolean, lowPowerTest: boolean): string {
  if (dryRun) return COPY.dryRunning
  if (lowPowerTest) return COPY.lowPowerRunning
  return COPY.engraving
}

export function workModeHint(mode: WorkMode): string {
  if (mode === 'low') return COPY.lowPowerHint
  if (mode === 'engrave') return COPY.engraveHint
  return COPY.dryRunHint
}

export function cutParamsSummary(input: {
  material: MaterialId
  thicknessMm: number
  effect: EffectLevel
  workArea: { widthMm: number; heightMm: number }
  workMode: WorkMode
}): string {
  if (input.workMode === 'dry') return COPY.dryRunMoveHint
  const effect = input.workMode === 'low' ? 'light' : input.effect
  const params = resolveCutParams({
    material: input.material,
    thicknessMm: input.thicknessMm,
    effect,
    workArea: input.workArea,
    lowPower: input.workMode === 'low',
  })
  return `${COPY.cutParamsLead}「${materialLabel(input.material, input.thicknessMm, effect)}」${COPY.cutParamsSet}${powerWord(params.power)}，${COPY.cutParamsSpeed}${paceWord(params.speed)}`
}

function powerWord(percent: number): string {
  if (percent <= 35) return COPY.powerLow
  if (percent <= 65) return COPY.powerMid
  if (percent <= 85) return COPY.powerHigh
  return COPY.powerVeryHigh
}

function paceWord(speed: number): string {
  if (speed <= 150) return COPY.paceVerySlow
  if (speed <= 400) return COPY.paceSlow
  if (speed <= 900) return COPY.paceMid
  return COPY.paceFast
}
