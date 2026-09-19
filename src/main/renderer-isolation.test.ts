import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })
}

describe('Renderer 隔离', () => {
  it('不直接引用 Node、Electron 或串口', () => {
    const files = walk(resolve(import.meta.dirname, '../renderer')).filter(
      (file) => !file.endsWith('.test.ts'),
    )
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/from ['"]electron['"]/)
      expect(source, file).not.toMatch(/from ['"]fs['"]/)
      expect(source, file).not.toMatch(/from ['"]node:fs['"]/)
      expect(source, file).not.toMatch(/from ['"]serialport['"]/)
      expect(source, file).not.toMatch(/from ['"].*\/grbl\//)
      expect(source, file).not.toMatch(/from ['"].*\/file\//)
      expect(source, file).not.toMatch(/from ['"]@shared\/svg\/SvgParser['"]/)
      expect(source, file).not.toMatch(/from ['"]@shared\/svg\/bezier['"]/)
      expect(source, file).not.toMatch(/from ['"]@shared\/svg\/pathData['"]/)
      expect(source, file).not.toMatch(/from ['"]@shared\/svg\/SvgUnitConverter['"]/)
      expect(source, file).not.toMatch(/require\(/)
      expect(source, file).not.toMatch(/workspaceToMachine/)
      expect(source, file).not.toMatch(/svgToMachine/)
      expect(source, file).not.toMatch(/machinePaths/)
    }
  })

  it('Y 翻转只存在于 CoordinateTransformer', () => {
    const transformer = readFileSync(resolve(import.meta.dirname, '../shared/geometry/CoordinateTransformer.ts'), 'utf8')
    expect(transformer).toMatch(/heightMm - /)
    const files = walk(resolve(import.meta.dirname, '../renderer')).filter(
      (file) => !file.endsWith('.test.ts'),
    )
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/workspaceToMachine/)
      expect(source, file).not.toMatch(/svgToMachine/)
      expect(source, file).not.toMatch(/machinePaths/)
    }
  })
})
