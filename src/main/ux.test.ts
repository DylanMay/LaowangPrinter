import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDE_STEPS, GUIDE_STORAGE_KEY } from '@shared/guide'

const renderer = resolve(import.meta.dirname, '../renderer')

describe('傻瓜化主流程', () => {
  it('页面只有 Home / Workspace / Job，预览是工作区覆盖层', () => {
    const app = readFileSync(resolve(renderer, 'App.tsx'), 'utf8')
    expect(app).not.toMatch(/page === 'preview'/)
    expect(app).toContain('WorkspacePage')
    expect(app).toContain('JobPage')
    expect(app).toContain('HomePage')
    expect(app).toContain('FirstRunGuide')
    const workspace = readFileSync(resolve(renderer, 'pages/WorkspacePage.tsx'), 'utf8')
    expect(workspace).toContain('PreviewOverlay')
    expect(workspace).toContain('COPY.preview')
    expect(workspace).toContain('COPY.startEngrave')
    expect(workspace).not.toMatch(/COPY\.selectAgain/)
  })

  it('任务页不把内部行号放在主进度上，确认后才开始', () => {
    const job = readFileSync(resolve(renderer, 'pages/JobPage.tsx'), 'utf8')
    expect(job).not.toMatch(/sentLines/)
    expect(job).not.toMatch(/stepLabel/)
    expect(job).toContain('startJob(true)')
    expect(job).toContain('COPY.dryRunDone')
    expect(job).toContain("setWorkMode('engrave')")
  })

  it('首次引导五步，并持久化完成标记', () => {
    expect(GUIDE_STEPS).toHaveLength(5)
    expect(GUIDE_STORAGE_KEY).toBe('laowang.guideCompleted')
    expect(GUIDE_STEPS.map((step) => step.title)).toEqual([
      '连接雕刻机',
      '确认设备',
      '测试机器移动',
      '放置材料',
      '开始第一次雕刻',
    ])
  })
})
