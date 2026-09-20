import { parseGrblLine } from './GrblParser'
import { describe, expect, it } from 'vitest'

describe('GrblParser', () => {
  it('解析 ok', () => {
    expect(parseGrblLine('ok')).toEqual({ kind: 'ok' })
    expect(parseGrblLine('ok\r')).toEqual({ kind: 'ok' })
  })

  it('解析 error:N', () => {
    expect(parseGrblLine('error:20')).toEqual({ kind: 'error', code: 20 })
    expect(parseGrblLine('error: 3')).toEqual({ kind: 'error', code: 3 })
  })

  it('解析 ALARM', () => {
    expect(parseGrblLine('ALARM:1')).toEqual({ kind: 'alarm', code: 1 })
    expect(parseGrblLine('ALARM: 9')).toEqual({ kind: 'alarm', code: 9 })
  })

  it('解析状态报告', () => {
    expect(parseGrblLine('<Idle|MPos:0.000,0.000,0.000|FS:0,0>')).toEqual({
      kind: 'status',
      report: {
        state: 'Idle',
        position: { x: 0, y: 0, z: 0 },
        feed: 0,
        spindle: 0,
      },
    })
    expect(parseGrblLine('<Run|WPos:12.5,8,0|FS:1000,400>').kind).toBe('status')
    const hold = parseGrblLine('<Hold:0|MPos:1,2,3|FS:0,0>')
    expect(hold).toMatchObject({
      kind: 'status',
      report: { state: 'Hold', position: { x: 1, y: 2, z: 3 } },
    })
  })

  it('解析设置行', () => {
    expect(parseGrblLine('$30=1000')).toEqual({ kind: 'setting', key: '$30', value: 1000 })
    expect(parseGrblLine('$130=300.000')).toEqual({ kind: 'setting', key: '$130', value: 300 })
  })

  it('解析版本行', () => {
    expect(parseGrblLine("Grbl 1.1h ['$' for help]")).toEqual({
      kind: 'version',
      version: '1.1h',
    })
    expect(parseGrblLine('GrblHAL 1.1f [\'$\' for help]')).toEqual({
      kind: 'version',
      version: '1.1f',
    })
    expect(parseGrblLine('FluidNC v3.7.2')).toEqual({
      kind: 'version',
      version: 'v3.7.2',
    })
    expect(parseGrblLine('[VER:1.1h.20190825:]')).toEqual({
      kind: 'version',
      version: '1.1h',
    })
  })
})
