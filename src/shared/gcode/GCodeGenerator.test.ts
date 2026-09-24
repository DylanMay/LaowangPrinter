import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { centerPlacement } from '@shared/geometry/CoordinateTransformer'
import { getMaterialPreset } from '@shared/materials/MaterialPreset'
import type { SvgDocument } from '@shared/types/svg'
import { applyDryRunSafety, generateGcode, generateJobGcode, spindleSpeed } from './GCodeGenerator'
import { formatDuration } from './GCodeEstimator'

const workArea = { widthMm: 300, heightMm: 200 }
const doc: SvgDocument = {
  widthMm: 40,
  heightMm: 20,
  paths: [
    {
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 20 },
        { x: 0, y: 20 },
        { x: 0, y: 0 },
      ],
    },
  ],
}

describe('GCodeGenerator', () => {
  it('生成 G21 G90 G0 G1 M3 M5 S F，且没有 UI 依赖', () => {
    const result = generateJobGcode({
      document: doc,
      placement: centerPlacement(40, 20, workArea),
      workArea,
      maxPower: 1000,
      material: 'wood',
      thicknessMm: 3,
      effect: 'standard',
    })
    expect(result.lines[0]).toBe('G21')
    expect(result.lines[1]).toBe('G90')
    expect(result.lines.some((line) => line.startsWith('G0 '))).toBe(true)
    expect(result.lines.some((line) => line.startsWith('G1 '))).toBe(true)
    expect(result.lines).toContain('M3 S200')
    expect(result.lines).toContain('S200')
    expect(result.lines).toContain('M5')
    expect(result.lines.some((line) => / F1000 S200$/.test(line))).toBe(true)
    expect(result.lines.filter((line) => line.startsWith('G1 ')).every((line) => / S200$/.test(line))).toBe(true)
    expect(result.lines.join('\n')).not.toMatch(/react|electron|document\.createElement/i)

    const source = readFileSync(resolve(import.meta.dirname, 'GCodeGenerator.ts'), 'utf8')
    expect(source).not.toMatch(/from ['"]react['"]/)
    expect(source).not.toMatch(/from ['"]electron['"]/)
  })

  it('按 $30 换算功率：$30=1000 且 20% → S200；$30=255 → S51', () => {
    expect(spindleSpeed(1000, 20)).toBe(200)
    expect(spindleSpeed(255, 20)).toBe(51)
    const wood = getMaterialPreset('wood', 3)
    expect(wood.standard).toEqual({ speed: 1000, power: 20 })
    const low = generateGcode({
      document: doc,
      placement: centerPlacement(40, 20, workArea),
      workArea,
      maxPower: 255,
      preset: wood,
      effect: 'standard',
    })
    expect(low.lines).toContain('M3 S51')
  })

  it('bounds 与机器坐标范围一致', () => {
    const placement = centerPlacement(40, 20, workArea)
    const result = generateJobGcode({
      document: doc,
      placement,
      workArea,
      maxPower: 1000,
      material: 'wood',
      thicknessMm: 3,
      effect: 'standard',
    })
    expect(result.bounds.widthMm).toBe(40)
    expect(result.bounds.heightMm).toBe(20)
    expect(result.bounds.minX).toBe(130)
    expect(result.bounds.maxY).toBe(110)
    expect(result.estimatedTime).toBeCloseTo(7.2, 5)
    expect(formatDuration(result.estimatedTime)).toBe('7 秒')
  })

  it('空载接口把 M3 转成 M5，仍保留移动', () => {
    const result = generateJobGcode({
      document: doc,
      placement: centerPlacement(40, 20, workArea),
      workArea,
      maxPower: 1000,
      material: 'wood',
      thicknessMm: 3,
      effect: 'standard',
      dryRun: true,
    })
    expect(result.lines.some((line) => /^M3\b/.test(line))).toBe(false)
    expect(result.lines).toContain('M5')
    expect(result.lines.some((line) => line.startsWith('G1 '))).toBe(true)
    expect(result.lines.some((line) => /\bS(?!0\b)[0-9]/.test(line))).toBe(false)
    expect(applyDryRunSafety(['G21', 'M3 S200', 'G1 X1 Y1 F1000', 'M5'])).toEqual([
      'G21',
      'M5',
      'G1 X1 Y1 F1000',
      'M5',
    ])
    expect(applyDryRunSafety(['M3 S200', 'G1 X1 Y1 F1000 S200', 'M4 S100', 'G1 X2 Y2 S51'])).toEqual([
      'M5',
      'G1 X1 Y1 F1000 S0',
      'M5',
      'G1 X2 Y2 S0',
    ])
  })

  it('星光一类小床提高功率并放慢进给，大床仍用原预设', () => {
    const compact = { widthMm: 50, heightMm: 50 }
    const small = generateJobGcode({
      document: doc,
      placement: centerPlacement(40, 20, compact),
      workArea: compact,
      maxPower: 1000,
      material: 'wood',
      thicknessMm: 3,
      effect: 'standard',
    })
    expect(small.lines).toContain('M3 S800')
    expect(small.lines).toContain('S800')
    expect(small.lines.some((line) => / F200 S800$/.test(line))).toBe(true)
    expect(small.estimatedTime).toBeCloseTo(36, 5)

    const desk = generateJobGcode({
      document: doc,
      placement: centerPlacement(40, 20, workArea),
      workArea,
      maxPower: 1000,
      material: 'wood',
      thicknessMm: 3,
      effect: 'standard',
    })
    expect(desk.lines).toContain('M3 S200')
    expect(desk.lines.some((line) => / F1000 S200$/.test(line))).toBe(true)
  })
})
