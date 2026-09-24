import { describe, expect, it } from 'vitest'
import { formatDiagnostics } from './formatDiagnostics'

describe('formatDiagnostics', () => {
  it('把异常码、参数和通信记录收进一份可复制文本', () => {
    const text = formatDiagnostics({
      appVersion: '0.1.0',
      status: {
        state: 'connected',
        machineState: 'alarm',
        errorMessage: '雕刻机处于异常状态。请检查机器，然后重新归零。',
        workArea: { widthMm: 50, heightMm: 50 },
      },
      config: {
        widthMm: null,
        heightMm: null,
        maxPower: 1000,
        minPower: 0,
        laserMode: true,
        grblVersion: '1.1h',
        firmware: 'Grbl 1.1h',
        settings: { 20: 1, 21: 1, 30: 1000, 31: 0, 32: 1, 130: 250, 131: 250 },
        parserState: null,
        needsSizeSetup: true,
      },
      portPath: '/dev/cu.wchusbserial123',
      baudRate: 115200,
      lastAlarm: 'ALARM:1',
      lastError: 'error:3',
      serialLog: ['> M3 S800', '< ALARM:1'],
      job: {
        state: 'error',
        sentLines: 4,
        totalLines: 20,
        currentLine: 'G1 X10 Y10 F200 S800',
        dryRun: false,
      },
    })
    expect(text).toContain('老王打印机 0.1.0')
    expect(text).toContain('ALARM:1')
    expect(text).toContain('error:3')
    expect(text).toContain('$21=1')
    expect(text).toContain('/dev/cu.wchusbserial123')
    expect(text).toContain('G1 X10 Y10 F200 S800')
    expect(text).toContain('> M3 S800')
  })
})
