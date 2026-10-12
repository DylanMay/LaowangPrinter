import { placeImported } from '@shared/geometry/CoordinateTransformer'
import { generateJobGcode } from '@shared/gcode/GCodeGenerator'
import { describe, expect, it } from 'vitest'
import { EXAMPLES, exampleById, examplesByKind } from './artwork'

const bed = { widthMm: 50, heightMm: 200 }

describe('示例图案', () => {
  it('提供简笔画和文字，都能放进窄工作区', () => {
    expect(examplesByKind('drawing').map((item) => item.name)).toEqual(['笑脸', '爱心', '星星', '小房子'])
    expect(examplesByKind('text').map((item) => item.name)).toEqual(['你好', '老王'])
    expect(exampleById('smile')?.name).toBe('笑脸')
    expect(exampleById('missing')).toBeNull()

    for (const example of EXAMPLES) {
      expect(example.document.paths.length).toBeGreaterThan(0)
      expect(example.document.widthMm).toBeLessThanOrEqual(bed.widthMm)
      expect(example.document.heightMm).toBeLessThanOrEqual(bed.widthMm)
      const placed = placeImported(example.document, bed)
      expect(placed.shrunk).toBe(false)
      const gcode = generateJobGcode({
        document: example.document,
        placement: placed.placement,
        workArea: bed,
        maxPower: 1000,
        material: 'wood',
        thicknessMm: 3,
        effect: 'standard',
      })
      expect(gcode.lines.some((line) => line.startsWith('G1 '))).toBe(true)
    }
  })

  it('文字由多笔笔画组成', () => {
    expect(exampleById('smile')?.document.paths.length).toBeGreaterThanOrEqual(4)
    expect(exampleById('hello')?.document.paths.length).toBeGreaterThanOrEqual(10)
    expect(exampleById('laowang')?.document.paths.length).toBeGreaterThanOrEqual(8)
  })
})
