import { visualItems } from '../config/visualItems'
import type { Inspection, MeasurementEntry, RepairCase, RepairDecision, Site } from '../types'
import { judgeMeasurements, measurementKey } from './judge'
import { measurementTitle, measurementValue, panelLocation } from './labels'
import { findCircuit } from './site'

export const repairSteps: RepairCase['status'][] = ['お客様確認中', '対応決定', '作業予定', '完了']

// 文中で使う対応の呼び方（「交換により是正」「交換後 85MΩ」）。その他は「作業」と呼ぶ。
export const decisionWord = (decision?: RepairDecision) => !decision || decision === 'その他（作業実施）' ? '作業' : decision

const locationOf = (inspection: Inspection, site: Site, refKey: string) => {
  const finding = inspection.findings.find(item => item.refKey === refKey)
  return finding ? panelLocation(site, finding.arrayId, finding.panels) : ''
}

// 点検完了時に、測定の不適合と目視の×から修繕案件を作る（SDD 4.6）
export function createRepairCases(inspection: Inspection, site: Site): RepairCase[] {
  const base = (refKey: string, title: string, index: number): RepairCase => ({
    caseId: `RC-${inspection.inspectionId}-${index + 1}`, siteId: site.siteId, inspectionId: inspection.inspectionId,
    findingId: inspection.findings.find(item => item.refKey === refKey)?.findingId ?? refKey, title, status: 'お客様確認中', afterPhotoIds: [],
  })
  const measurements = inspection.measurements.filter(entry => entry.judgement === '不適合').map(entry => ({ refKey: entry.key, title: `${measurementTitle(entry)}の不適合（${measurementValue(entry)}）` }))
  const visual = inspection.visual.filter(entry => entry.result === '×').map(entry => {
    const location = locationOf(inspection, site, entry.itemId)
    return { refKey: entry.itemId, title: `${visualItems.find(item => item.itemId === entry.itemId)?.title ?? entry.itemId}${location ? `（${location}）` : ''}` }
  })
  return [...measurements, ...visual].map((item, index) => base(item.refKey, item.title, index))
}

// 指摘の元になった項目（測定キーまたは目視ID）。findingIdが無い指摘はrefKeyそのものを入れている。
export const repairRefKey = (repair: RepairCase, inspection: Inspection) => inspection.findings.find(finding => finding.findingId === repair.findingId)?.refKey ?? repair.findingId

// 作業後に測り直す欄。測定の指摘はその欄、回路にひも付く目視の指摘（パネル割れなど）はその回路のDC絶縁抵抗。
export function remeasureTarget(repair: RepairCase, inspection: Inspection, site: Site): MeasurementEntry | undefined {
  const refKey = repairRefKey(repair, inspection)
  const direct = inspection.measurements.find(entry => entry.key === refKey)
  if (direct) return direct
  const circuit = findCircuit(site, inspection.findings.find(finding => finding.refKey === refKey)?.circuitId)
  if (!circuit) return undefined
  return inspection.measurements.find(entry => entry.key === measurementKey('DC絶縁抵抗', circuit.circuitId.split('/')[0], circuit.circuitId))
}

// 再測定値を点検時と同じ条件（開放電圧・他回路）で判定する
export function judgeRemeasure(raw: string, target: MeasurementEntry, inspection: Inspection, site: Site): MeasurementEntry {
  const entries = inspection.measurements.map(entry => entry.key === target.key ? { ...entry, raw } : entry)
  return judgeMeasurements(entries, site, inspection.weather).find(entry => entry.key === target.key)!
}

export const decideRepair = (repair: RepairCase, decision: RepairDecision, decidedOn: string): RepairCase => ({ ...repair, status: '対応決定', customerDecision: decision, decidedOn })

export const scheduleRepair = (repair: RepairCase): RepairCase => ({ ...repair, status: '作業予定' })

export const completeRepair = (repair: RepairCase, work: { workNote: string; afterPhotoIds: string[]; remeasure?: MeasurementEntry }): RepairCase => ({ ...repair, status: '完了', workNote: work.workNote, afterPhotoIds: work.afterPhotoIds, ...(work.remeasure ? { remeasure: work.remeasure } : {}) })

// 一覧・カルテに出す結果。再測定が適合なら「修正済み」。
export function repairResult(repair: RepairCase) {
  if (repair.status !== '完了') return repair.status
  if (repair.remeasure?.judgement === '適合') return '修正済み'
  return repair.customerDecision === '経過観察' ? '経過観察' : '完了'
}


// 修繕の連動：ある案件の再測定が適合なら、同じ点検で同じ欄（同じ回路のDC絶縁抵抗）を指摘している未完了の案件も修正済みにする。
// 例：パネル割れを交換して絶縁抵抗が戻れば、絶縁抵抗の不適合の案件も「アレイB 1段目5列目の交換により修正」で完了。
export function resolveLinkedRepairs(repairs: RepairCase[], completed: RepairCase, inspection: Inspection, site: Site): RepairCase[] {
  const remeasure = completed.remeasure
  if (completed.status !== '完了' || remeasure?.judgement !== '適合') return repairs
  const completedRef = repairRefKey(completed, inspection)
  const finding = inspection.findings.find(item => item.refKey === completedRef)
  const cause = `${panelLocation(site, finding?.arrayId, finding?.panels) || completed.title}の${decisionWord(completed.customerDecision)}により修正`
  return repairs.map(repair => repair.caseId !== completed.caseId && repair.inspectionId === completed.inspectionId && repair.status !== '完了' && repairRefKey(repair, inspection) === remeasure.key
    ? { ...repair, status: '完了', customerDecision: completed.customerDecision, decidedOn: completed.decidedOn, workNote: cause, remeasure }
    : repair)
}
