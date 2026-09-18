import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COPY } from '@shared/copy'
import { USER_ERRORS } from '@shared/errors/appError'

const root = resolve(import.meta.dirname, '../..')
const renderer = resolve(import.meta.dirname, '../renderer')

describe('产品第 14 节 MVP 验收清单', () => {
  it('主路径文案覆盖打开、连接、导入、材料、预览、确认、进度、完成', () => {
    expect(COPY.homeTitle).toBe('激光雕刻')
    expect(COPY.selectFile).toBe('选择文件')
    expect(COPY.deviceConnected).toBe('雕刻机已连接')
    expect(COPY.centerPattern).toBe('居中')
    expect(COPY.wood).toBe('木板')
    expect(COPY.effectStandard).toBe('标准')
    expect(COPY.preview).toBe('预览')
    expect(COPY.startEngrave).toBe('开始雕刻')
    expect(COPY.placeMaterial).toContain('材料')
    expect(COPY.workAreaSafe).toContain('安全')
    expect(COPY.engraving).toBe('正在雕刻…')
    expect(COPY.jobCompleted).toBe('雕刻完成')
    expect(JSON.stringify(COPY)).not.toMatch(/GRBL|G-code|COM3|115200|M3|Feed Rate/i)
  })

  it('用户可见错误不含协议术语', () => {
    const blob = Object.values(USER_ERRORS)
      .flatMap((item) => [item.userMessage, item.hint ?? ''])
      .join('\n')
    expect(blob).not.toMatch(/GRBL|G-code|COM3|M3|error:20|Access denied/i)
    expect(USER_ERRORS.NO_DEVICE.userMessage).toContain('没有检测到雕刻机')
    expect(USER_ERRORS.PORT_BUSY.hint).toContain('其他软件')
    expect(USER_ERRORS.DEVICE_DISCONNECTED.hint).toContain('USB')
    expect(USER_ERRORS.GRBL_ALARM.userMessage).toContain('异常')
  })

  it('模拟雕刻机只走环境变量，不出现在普通 UI', () => {
    const app = readFileSync(resolve(renderer, 'App.tsx'), 'utf8')
    const home = readFileSync(resolve(renderer, 'pages/HomePage.tsx'), 'utf8')
    const workspace = readFileSync(resolve(renderer, 'pages/WorkspacePage.tsx'), 'utf8')
    expect(`${app}\n${home}\n${workspace}`).not.toMatch(/LAOWANG_SERIAL/)
    expect(`${app}\n${home}\n${workspace}`).not.toMatch(/模拟雕刻机/)
    const backend = readFileSync(resolve(root, 'src/main/serial/createBackend.ts'), 'utf8')
    expect(backend).toContain("env.LAOWANG_SERIAL === 'mock'")
  })

  it('工作区提供低功率测试入口，任务页要求额外确认', () => {
    const workspace = readFileSync(resolve(renderer, 'pages/WorkspacePage.tsx'), 'utf8')
    const job = readFileSync(resolve(renderer, 'pages/JobPage.tsx'), 'utf8')
    expect(workspace).toContain("setWorkMode('low')")
    expect(job).toContain('COPY.lowPowerConfirm')
    expect(job).toContain('startJob(true)')
  })
})
