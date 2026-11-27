import { visualItems } from '../config/visualItems'
import type { Finding, Inspection, InspectionPhoto, Judgement, ReportZone, Site } from '../types'
import { formatDate } from './format'
import { circuitLabel, measurementTitle, measurementValue, panelLocation } from './labels'
import { buildProposals, type ProposalOptions } from './proposals'

// 総合判定の件数。要対応＝測定の不適合＋目視の×、要確認＝測定の要確認。該当なしの目視は数えない。
export function overallCounts(inspection: Inspection) {
  const visual = inspection.visual.filter(entry => entry.result && entry.result !== '該当なし')
  const measured = inspection.measurements.filter(entry => entry.judgement !== '未入力')
  const visualFail = visual.filter(entry => entry.result === '×').length
  const measurementFail = measured.filter(entry => entry.judgement === '不適合').length
  const caution = measured.filter(entry => entry.judgement === '要確認').length
  const total = visual.length + measured.length
  return { total, visualCount: visual.length, measurementCount: measured.length, needsAction: visualFail + measurementFail, caution, ok: total - visualFail - measurementFail - caution }
}

// 総合所見の初期文。点検データだけから組み立て、報告書画面で編集できる。
export function reportSummary(inspection: Inspection, site: Site) {
  const counts = overallCounts(inspection)
  const date = formatDate(inspection.inspectedOn ?? inspection.scheduledOn)
  const head = `${date}、${site.name}の${inspection.kind ?? '定期点検'}（目視${counts.visualCount}項目・測定${counts.measurementCount}項目）を実施しました。`
  const result = counts.needsAction ? `${counts.needsAction}件で対応が必要な状態を確認しました。内容とご提案は以下のとおりです。` : '対応が必要な項目はありませんでした。'
  const caution = counts.caution ? `また、${counts.caution}件は基準内ですが推移の確認が必要です。` : ''
  return head + result + caution
}

export const buildReportText = (inspection: Inspection, site: Site, previous?: Inspection, options?: ProposalOptions) => ({ summary: reportSummary(inspection, site), proposals: buildProposals(inspection, site, previous, options) })

// 点検で撮った写真（目視×と異常箇所にひも付くもの）
export function inspectionPhotos(inspection: Inspection, photos: InspectionPhoto[]) {
  const ids = [...new Set([...inspection.visual.flatMap(entry => entry.photoIds), ...inspection.findings.flatMap(finding => finding.photoIds)])]
  return ids.map(id => photos.find(photo => photo.photoId === id)).filter((photo): photo is InspectionPhoto => Boolean(photo))
}

// 写真の配置の初期値：異常箇所の写真は「異常箇所の詳細」に、それ以外は写真台帳に置く
export function defaultReportLayout(inspection: Inspection, photos: InspectionPhoto[]): { photoId: string; zone: ReportZone | null }[] {
  const findingPhotoIds = new Set(inspection.findings.flatMap(finding => finding.photoIds))
  return inspectionPhotos(inspection, photos).map(photo => ({ photoId: photo.photoId, zone: findingPhotoIds.has(photo.photoId) ? 'findings' : 'ledger' }))
}

export type ReportIssue = { key: string; title: string; mark: Judgement | '×'; value?: string; detail: string; location?: string }

// 指摘の一覧（測定の不適合→目視の×→測定の要確認）。異常箇所を指定していれば場所を添える。
export function reportIssues(inspection: Inspection, site: Site): ReportIssue[] {
  const locationOf = (refKey: string) => {
    const finding = inspection.findings.find(item => item.refKey === refKey)
    if (!finding) return undefined
    return [panelLocation(site, finding.arrayId, finding.panels), finding.circuitId && circuitLabel(finding.circuitId)].filter(Boolean).join('・') || undefined
  }
  const measurement = (judgement: Judgement) => inspection.measurements.filter(entry => entry.judgement === judgement).map(entry => ({ key: entry.key, title: measurementTitle(entry), mark: judgement, value: measurementValue(entry), detail: entry.reason, location: locationOf(entry.key) }))
  const visual = inspection.visual.filter(entry => entry.result === '×').map(entry => ({ key: entry.itemId, title: visualItems.find(item => item.itemId === entry.itemId)?.title ?? entry.itemId, mark: '×' as const, detail: entry.comment, location: locationOf(entry.itemId) }))
  return [...measurement('不適合'), ...visual, ...measurement('要確認')]
}

// 報告書の「異常箇所の詳細」：同じ回路・同じパネル位置の指摘（例：パネル割れと絶縁抵抗の不適合）は1枚のカードにまとめる
export function groupFindings(findings: Finding[]): Finding[][] {
  const groups = new Map<string, Finding[]>()
  for (const finding of findings) {
    const panels = [...(finding.panels ?? [])].sort((a, b) => a.row - b.row || a.col - b.col).map(panel => `${panel.row}-${panel.col}`).join(',')
    const key = finding.arrayId && panels ? `${finding.circuitId ?? ''}|${finding.arrayId}|${panels}` : finding.findingId
    groups.set(key, [...(groups.get(key) ?? []), finding])
  }
  return [...groups.values()]
}
