import { COPY } from '@shared/copy'
import type { EffectLevel, MaterialId } from '@shared/materials/MaterialPreset'
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
