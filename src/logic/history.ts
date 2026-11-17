import type { Inspection } from '../types'

// その点検より前に完了した、同じ発電所の点検（古い順）
export const pastInspections = (inspections: Inspection[], inspection: Pick<Inspection, 'siteId' | 'scheduledOn' | 'inspectionId'>) => inspections
  .filter(item => item.siteId === inspection.siteId && item.inspectionId !== inspection.inspectionId && item.status === '完了' && (item.inspectedOn ?? item.scheduledOn) < inspection.scheduledOn)
  .sort((a, b) => (a.inspectedOn ?? a.scheduledOn).localeCompare(b.inspectedOn ?? b.scheduledOn))

export const previousInspection = (inspections: Inspection[], inspection: Pick<Inspection, 'siteId' | 'scheduledOn' | 'inspectionId'>) => pastInspections(inspections, inspection).at(-1)

// 前回点検での指摘件数（目視×、測定の不適合・要確認）
export const findingCount = (inspection: Inspection | undefined) => inspection ? inspection.visual.filter(entry => entry.result === '×').length + inspection.measurements.filter(entry => entry.judgement === '不適合' || entry.judgement === '要確認').length : 0
