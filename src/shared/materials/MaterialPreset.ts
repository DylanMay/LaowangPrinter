export type MaterialId = 'wood' | 'bamboo' | 'cardboard' | 'leather' | 'acrylic'
export type EffectLevel = 'light' | 'standard' | 'deep'

export type CutParams = {
  speed: number
  power: number
}

export type MaterialPreset = {
  material: MaterialId
  thickness: number
  light: CutParams
  standard: CutParams
  deep: CutParams
}

const WOOD: Record<number, MaterialPreset> = {
  2: {
    material: 'wood',
    thickness: 2,
    light: { speed: 1800, power: 12 },
    standard: { speed: 1200, power: 18 },
    deep: { speed: 700, power: 25 },
  },
  3: {
    material: 'wood',
    thickness: 3,
    light: { speed: 1500, power: 15 },
    standard: { speed: 1000, power: 20 },
    deep: { speed: 600, power: 30 },
  },
  5: {
    material: 'wood',
    thickness: 5,
    light: { speed: 1200, power: 20 },
    standard: { speed: 800, power: 28 },
    deep: { speed: 500, power: 40 },
  },
}

const PLACEHOLDERS: Record<Exclude<MaterialId, 'wood'>, MaterialPreset> = {
  bamboo: {
    material: 'bamboo',
    thickness: 3,
    light: { speed: 1400, power: 16 },
    standard: { speed: 900, power: 22 },
    deep: { speed: 550, power: 32 },
  },
  cardboard: {
    material: 'cardboard',
    thickness: 3,
    light: { speed: 2000, power: 10 },
    standard: { speed: 1400, power: 14 },
    deep: { speed: 900, power: 20 },
  },
  leather: {
    material: 'leather',
    thickness: 3,
    light: { speed: 1600, power: 14 },
    standard: { speed: 1100, power: 18 },
    deep: { speed: 700, power: 26 },
  },
  acrylic: {
    material: 'acrylic',
    thickness: 3,
    light: { speed: 1000, power: 22 },
    standard: { speed: 700, power: 30 },
    deep: { speed: 400, power: 42 },
  },
}

export function getMaterialPreset(material: MaterialId, thickness: number): MaterialPreset {
  if (material === 'wood') {
    return WOOD[thickness] ?? WOOD[3]!
  }
  return { ...PLACEHOLDERS[material], thickness }
}

export function cutParamsFor(preset: MaterialPreset, effect: EffectLevel): CutParams {
  return preset[effect]
}
