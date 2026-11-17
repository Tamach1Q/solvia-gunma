// MOCK: 「デモ入力」ボタンで一括入力するシナリオ値（SDD 6.4）。
// アレイB 1段目5列目のモジュール割れから浸水し、その段を担当するPCS-2 回路2の絶縁抵抗が0.3MΩまで低下した、という筋書き。
import { judgeMeasurements, measurementKey } from '../logic/judge'
import type { Finding, Inspection, InspectionPhoto, Site } from '../types'
import { sampleMeasurementRaws, seededRandom } from './seed'
import { scenarioPhotoUrl } from './scenarioPhoto'
export { scenarioPhotoUrl } from './scenarioPhoto'

export const scenarioCircuitId = 'PCS-2/回路2'
export const scenarioPanel = { arrayId: 'B', row: 1, col: 5 }
const insulationKey = measurementKey('DC絶縁抵抗', 'PCS-2', scenarioCircuitId)

export const scenarioPhotoId = (inspectionId: string) => `PH-${inspectionId}-PANEL`
export const scenarioPhotos = (inspectionId: string): InspectionPhoto[] => [{ photoId: scenarioPhotoId(inspectionId), inspectionItemId: 'AR-01', equipmentId: `${scenarioPanel.arrayId}-${scenarioPanel.row}-${scenarioPanel.col}`, photoType: 'モジュール表面ガラスの割れ', takenAt: new Date().toISOString(), url: scenarioPhotoUrl }]

export function applyScenario(inspection: Inspection, site: Site, previous?: Pick<Inspection, 'measurements'>): Inspection {
  const weather = inspection.weather ?? '晴れ'
  const raws = sampleMeasurementRaws(site, seededRandom(`scenario-${site.siteId}`), { [insulationKey]: '0.3' })
  const photoId = scenarioPhotoId(inspection.inspectionId)
  const visual = inspection.visual.map(entry => entry.itemId === 'AR-01'
    ? { ...entry, result: '×' as const, comment: 'アレイB 1段目5列目のモジュール表面ガラスに割れ', photoIds: [photoId] }
    : { ...entry, result: entry.result ?? '○' as const })
  const panels = [{ row: scenarioPanel.row, col: scenarioPanel.col }]
  const findings: Finding[] = [
    { findingId: `F-${inspection.inspectionId}-PANEL`, source: 'visual', refKey: 'AR-01', arrayId: scenarioPanel.arrayId, panels, circuitId: scenarioCircuitId, comment: 'モジュール表面ガラスの割れ（雨水が入りやすい状態）', photoIds: [photoId] },
    { findingId: `F-${inspection.inspectionId}-INSULATION`, source: 'measurement', refKey: insulationKey, arrayId: scenarioPanel.arrayId, panels, circuitId: scenarioCircuitId, comment: '回路の切り分けで、割れたモジュールの系統に低下を確認', photoIds: [photoId] },
  ]
  // 先に手入力された欄は残す（デモ当日、数値を2〜3個打ってもらってから残りを埋めるため）。筋書きの欄だけは上書きする。
  const measurements = judgeMeasurements(inspection.measurements.map(entry => ({ ...entry, raw: entry.key === insulationKey ? raws[entry.key] : entry.raw || raws[entry.key] })), site, weather, previous?.measurements)
  return { ...inspection, weather, visual, measurements, findings: [...inspection.findings.filter(finding => !findings.some(item => item.refKey === finding.refKey)), ...findings] }
}
