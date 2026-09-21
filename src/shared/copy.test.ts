import { COPY } from '@shared/copy'
import { describe, expect, it } from 'vitest'

describe('普通用户文案', () => {
  it('首页使用中文产品语言', () => {
    expect(COPY.homeTitle).toBe('激光雕刻')
    expect(COPY.deviceDisconnected).toBe('未检测到雕刻机')
    expect(COPY.deviceConnected).toBe('雕刻机已连接')
    expect(COPY.myMachine).toBe('我的雕刻机')
    expect(COPY.dropTitleDisconnected).toBe('请先连接雕刻机')
  })

  it('默认文案不出现串口或 GRBL 术语', () => {
    const blob = JSON.stringify(COPY)
    expect(blob).not.toMatch(/GRBL|G-code|COM3|115200|M3|Feed Rate/i)
  })

  it('尺寸引导只用工作区域语言', () => {
    expect(COPY.sizeSetupTitle).toBe('设置工作区域')
    expect(COPY.sizeUnit).toBe('毫米')
  })

  it('机器控制使用回到原点，不出现 Homing', () => {
    expect(COPY.findingOrigin).toBe('正在寻找机器原点…')
    expect(COPY.machineLead).toContain('不会开激光')
  })

  it('导入图案使用选择文件，不出现解析术语', () => {
    expect(COPY.selectFile).toBe('选择文件')
    expect(COPY.dropHintConnected).toContain('选择 SVG 文件')
    expect(COPY.importEmpty).toContain('可雕刻的线条')
    expect(COPY.importLines).toBe('条线条')
  })

  it('工作区越界使用中文，不出现坐标原点', () => {
    expect(COPY.outOfBounds).toBe('图案超出雕刻区域')
    expect(COPY.patternTooLarge).toBe('图案太大')
    expect(COPY.autoShrink).toBe('自动缩小')
    expect(COPY.centerPattern).toBe('居中')
    expect(COPY.workAreaCaption).toBe('工作区域')
    expect(JSON.stringify(COPY)).not.toMatch(/X0|Y0|Z0/)
  })

  it('预览使用预计时间，不出现内部指令术语', () => {
    expect(COPY.previewTitle).toBe('雕刻预览')
    expect(COPY.timeLabel).toBe('预计时间')
    expect(COPY.previewHeadHint).toContain('小圆点')
    expect(COPY.viewPathCommands).toBe('查看路径指令')
  })

  it('任务页使用进度和剩余时间，不出现内部指令术语', () => {
    expect(COPY.engraving).toBe('正在雕刻…')
    expect(COPY.dryRunning).toBe('空载测试中…')
    expect(COPY.remainingLabel).toBe('预计剩余')
    expect(COPY.jobCompleted).toBe('雕刻完成')
    expect(COPY.dryRunDone).toBe('空载完成')
    expect(COPY.dryRunDoneHint).toContain('激光没有开是正常的')
    expect(COPY.switchToEngrave).toBe('改用正常雕刻')
    expect(COPY.dryRunHint).toContain('不会开激光')
    expect(COPY.pause).toBe('暂停')
    expect(COPY.lowPowerNeedsConfirm).toContain('单独确认')
    expect(COPY.needsConfirm).toContain('确认检查项')
    expect(COPY.lowPower).toBe('低功率测试')
    expect(COPY.lowPowerConfirm).toContain('仍可能产生激光')
    expect(COPY.startLowPower).toBe('开始低功率测试')
  })

  it('首次引导五步使用中文，不出现协议术语', () => {
    expect(COPY.guideConnectTitle).toBe('连接雕刻机')
    expect(COPY.guideConfirmTitle).toBe('确认设备')
    expect(COPY.guideMoveTitle).toBe('测试机器移动')
    expect(COPY.guidePlaceTitle).toBe('放置材料')
    expect(COPY.guideStartTitle).toBe('开始第一次雕刻')
    expect(COPY.guideStartBody).toContain('空载测试')
  })

  it('高级设置标签不把协议术语写进文案常量', () => {
    expect(COPY.advancedTitle).toBe('高级设置')
    expect(COPY.advancedPort).toBe('接口')
    expect(COPY.serialLogTitle).toBe('通信记录')
    expect(COPY.debugTitle).toBe('调试信息')
    expect(COPY.copyDebug).toBe('复制全部')
    expect(COPY.unlockMachine).toBe('解除异常')
    expect(COPY.settingsBody).toContain('排查问题')
  })
})
