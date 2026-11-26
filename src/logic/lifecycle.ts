import { visualItems } from '../config/visualItems'
import type { DemoState } from '../mock/seed'
import type { Inspection, Site } from '../types'
import { addYears } from './dates'
import { createRepairCases } from './repairs'
import { approvedInspectionReport } from './reportWorkflow'

// 次回点検（点検日の1年後、未依頼）
export function nextInspection(inspection: Inspection, site: Site): Inspection {
  const scheduledOn = addYears(inspection.inspectedOn ?? inspection.scheduledOn, 1)
  return { inspectionId: `INS-${site.siteId}-${scheduledOn.replaceAll('-', '')}`, siteId: site.siteId, scheduledOn, inspector: inspection.inspector, status: '未依頼', visual: visualItems.map(item => ({ itemId: item.itemId, result: null, comment: '', photoIds: [] })), measurements: [], findings: [] }
}

// 点検を完了する：ステータスを完了にし、修繕案件と1年後の予定を作る（SDD 4.6・4.7）。2回押しても重複しない。
export function completeInspection(state: DemoState, inspectionId: string, today: string): DemoState {
  const inspection = state.inspections.find(item => item.inspectionId === inspectionId)
  const site = inspection && state.sites.find(item => item.siteId === inspection.siteId)
  if (!inspection || !site || inspection.status === '完了' || !approvedInspectionReport(state, inspectionId)) return state
  const done: Inspection = { ...inspection, status: '完了', inspectedOn: inspection.inspectedOn ?? today }
  const next = nextInspection(done, site)
  const hasNext = state.inspections.some(item => item.siteId === site.siteId && item.scheduledOn === next.scheduledOn)
  const hasRepairs = state.repairCases.some(item => item.inspectionId === inspectionId)
  return {
    ...state,
    inspections: [...state.inspections.map(item => item.inspectionId === inspectionId ? done : item), ...(hasNext ? [] : [next])],
    repairCases: [...state.repairCases, ...(hasRepairs ? [] : createRepairCases(done, site))],
  }
}
