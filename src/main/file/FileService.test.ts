import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FileService, MAX_SVG_BYTES } from './FileService'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const rectFixture = resolve(import.meta.dirname, '../../shared/svg/fixtures/rect.svg')

describe('FileService', () => {
  it('打开夹具 SVG 后得到毫米尺寸和 Path[]', async () => {
    const files = new FileService({
      openDialog: async () => rectFixture,
    })
    const result = await files.openSvg()
    expect(result?.fileName).toBe('rect.svg')
    expect(result?.document.widthMm).toBe(40)
    expect(result?.document.heightMm).toBe(20)
    expect(result?.document.paths[0]?.points).toHaveLength(5)
    expect(JSON.stringify(result)).not.toMatch(/<svg|G0 |M3/i)
  })

  it('取消选择文件时返回 null', async () => {
    const files = new FileService({
      openDialog: async () => null,
    })
    await expect(files.openSvg()).resolves.toBeNull()
  })

  it('拒绝非 SVG 和空路径', async () => {
    const files = new FileService({
      openDialog: async () => '/tmp/notes.txt',
    })
    await expect(files.openSvg()).rejects.toThrow('请选择 SVG 文件')
    await expect(files.importSvg('/tmp/notes.txt')).rejects.toThrow('请选择 SVG 文件')
  })

  it('没有可雕刻线条时给出说明', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'laowang-svg-'))
    const empty = join(dir, 'empty.svg')
    await writeFile(empty, '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"></svg>')
    const files = new FileService({
      openDialog: async () => empty,
    })
    await expect(files.importSvg(empty)).rejects.toThrow('没有可雕刻的线条')
  })

  it('文件过大时拒绝读取', async () => {
    const files = new FileService({
      openDialog: async () => rectFixture,
      stat: async () => ({ size: MAX_SVG_BYTES + 1 }),
      readFile: async () => readFileSync(rectFixture, 'utf8'),
    })
    await expect(files.openSvg()).rejects.toThrow('太大')
  })

  it('找不到文件时给出无法打开', async () => {
    const files = new FileService({
      openDialog: async () => '/tmp/missing-pattern.svg',
    })
    await expect(files.importSvg('/tmp/missing-pattern.svg')).rejects.toThrow('无法打开这个文件')
  })
})
