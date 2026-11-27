import { visualItems } from '../config/visualItems'
import { buildMeasurementEntries } from './judge'
import type { DemoState } from '../mock/seed'
import type { Incident, IncidentDecision, IncidentLog, IncidentLogKind, Inspection, MonitoringStatus, RepairCase } from '../types'

export const incidentDecisions: IncidentDecision[] = ['未判断', '経過観察', '駆けつけ', '遠隔対応', '現状維持', '対応不要']
export const alarmKey = (monitor: MonitoringStatus) => monitor.siteId + ':' + monitor.alert
export const existingAlarm = (incidents: Incident[], monitor: MonitoringStatus) => incidents.find(item => item.alarmKey === alarmKey(monitor) && !item.closedAt)
export function incidentStatus(incident: Incident, inspections: Inspection[], repairs: RepairCase[]) {
  if (incident.closedAt) return '対応完了'
  const visits = inspections.filter(item => item.incidentId === incident.id)
  if (visits.some(item => item.status !== '完了')) return '点検対応中'
  if (repairs.some(item => visits.some(visit => visit.inspectionId === item.inspectionId) && item.status !== '完了')) return '修繕対応中'
  if (incident.recoveredAt) return '復旧済・未完了'
  return incident.decision === '駆けつけ' ? '駆けつけ対応' : incident.decision
}
export const addIncidentLog = (incident: Incident, kind: IncidentLogKind, text: string, by: string, at: string, id: string): Incident => ({
  ...incident, logs: [...incident.logs, { id, kind, at, by, text } satisfies IncidentLog],
})
export function scheduleIncident(state: DemoState, incidentId: string, scheduledOn: string, inspector: string, note: string, id: string, at: string, by: string): DemoState {
  const incident = (state.incidents ?? []).find(item => item.id === incidentId)
  const site = state.sites.find(item => item.siteId === incident?.siteId)
  if (!incident || !site || incident.closedAt || incident.decision !== '駆けつけ' || !scheduledOn || !inspector.trim() || !note.trim() || state.inspections.some(item => item.inspectionId === id || (item.incidentId === incidentId && item.status !== '完了'))) return state
  const inspection: Inspection = { inspectionId: id, siteId: site.siteId, incidentId, kind: '駆けつけ点検', scheduledOn, inspector, investigationNote: note, status: '未依頼', visual: visualItems.map(item => ({ itemId: item.itemId, result: null, comment: '', photoIds: [] })), measurements: buildMeasurementEntries(site), findings: [] }
  return { ...state, inspections: [...state.inspections, inspection], incidents: (state.incidents ?? []).map(item => item.id === incidentId ? addIncidentLog(item, '作業', '駆けつけ点検予定：' + scheduledOn + '・' + note, by, at, id) : item) }
}
export function canCloseIncident(incident: Incident, inspections: Inspection[], repairs: RepairCase[]) {
  const visits = inspections.filter(item => item.incidentId === incident.id)
  return incident.decision !== '未判断' && !visits.some(item => item.status !== '完了') && !repairs.some(item => visits.some(visit => visit.inspectionId === item.inspectionId) && item.status !== '完了') && (!!incident.recoveredAt || incident.decision === '対応不要' || incident.decision === '現状維持')
}

// MOCK: アラーム文言に基づく確認項目のみ。実際の計測・気象データや生成AIは使用しない。
export function preliminaryChecks(title: string): string[] {
  if (title.includes('通信')) return ['最終受信時刻と他機器の通信状況', '監視サービスの障害情報・通信機器の状態']
  if (title.includes('PCS') && title.includes('停止')) return ['対象PCSのエラーコードと停止・復帰履歴', '他PCSの出力・系統電圧・通信状態']
  if (title.includes('発電量') || title.includes('出力')) return ['直近の日射量・天候と実績の比較', 'PCS別出力・出力制御・欠測の有無']
  return ['設備の異常履歴と最新の状態', 'メーカー資料・過去の対応履歴']
}
