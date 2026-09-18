import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')

describe('Electron 安全配置', () => {
  it('Main 开启隔离、关闭 Node 集成、优先沙箱', () => {
    const source = readFileSync(resolve(root, 'src/main/index.ts'), 'utf8')
    expect(source).toContain('contextIsolation: true')
    expect(source).toContain('nodeIntegration: false')
    expect(source).toContain('sandbox: true')
  })

  it('Preload 用 contextBridge 暴露最小 API，不暴露 ipcRenderer', () => {
    const source = readFileSync(resolve(root, 'src/preload/index.ts'), 'utf8')
    expect(source).toContain('contextBridge.exposeInMainWorld')
    expect(source).toContain("'app'")
    expect(source).toContain("'device'")
    expect(source).not.toMatch(/exposeInMainWorld\(\s*['"]ipcRenderer['"]/)
    expect(source).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer/)
  })
})
