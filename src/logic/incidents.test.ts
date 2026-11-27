import { describe, expect, it } from 'vitest'
import { createSeed } from '../mock/seed'
import { addIncidentLog, canCloseIncident, existingAlarm, incidentStatus, scheduleIncident } from './incidents'
import type { Incident } from '../types'

const at = '2026-10-28T10:00:00Z'
const item: Incident = { id: 'INC-1', siteId: 'S-05', title: 'PCS停止', source: '遠隔監視', occurredAt: at, assignee: '担当', dueOn: '2026-10-30', decision: '駆けつけ', reason: '原因確認', logs: [], alarmKey: 'S-05:PCS停止' }
describe('不具合対応台帳', () => {
  it('同一の対応中アラームを再登録しない', () => {
    const monitor = { siteId: 'S-05', alert: 'PCS停止', alertAt: at, outputKw: 0, level: '要対応' as const }
    expect(existingAlarm([item], monitor)).toEqual(item)
    expect(existingAlarm([{ ...item, closedAt: at }], monitor)).toBeUndefined()
  })
  it('駆けつけ点検を作成して台帳に紐付け、重複作成しない', () => {
    const state = { ...createSeed(new Date(2026,9,28)), incidents: [item] }
    const next = scheduleIncident(state, item.id, '2026-10-30', '担当', 'PCS確認', 'INS-new', at, '管理者')
    expect(next.inspections.at(-1)).toMatchObject({ kind: '駆けつけ点検', incidentId: item.id, investigationNote: 'PCS確認' })
    expect(next.incidents?.[0].logs).toHaveLength(1)
    expect(incidentStatus(item, next.inspections, next.repairCases)).toBe('点検対応中')
    expect(scheduleIncident(next, item.id, '2026-10-31', '担当', 'PCS確認', 'INS-new2', at, '管理者')).toBe(next)
    expect(canCloseIncident({ ...item, recoveredAt: at }, next.inspections, next.repairCases)).toBe(false)
  })
  it('復旧と完了を区別し、判断・記録を保持する', () => {
    const restored = addIncidentLog({ ...item, recoveredAt: at }, '復旧', '復旧確認', '担当', at, 'LOG-1')
    expect(incidentStatus(restored, [], [])).toBe('復旧済・未完了')
    expect(canCloseIncident(restored, [], [])).toBe(true)
    expect(incidentStatus({ ...restored, closedAt: at }, [], [])).toBe('対応完了')
    expect(canCloseIncident({ ...item, decision: '未判断' }, [], [])).toBe(false)
  })
})
