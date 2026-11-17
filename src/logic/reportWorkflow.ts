import type { DemoState } from '../mock/seed'
import type { Inspection, ReportReview, Site } from '../types'
import { buildReportText } from './report'
import { approveReport, createReportReview, hasCurrentCheck, reportFingerprint, returnReport, unresolvedIssues } from './reportCheck'

// 写真の差し替えを目視・異常箇所・報告書の配置にまとめて反映する。
export function inspectionFromReview(review: ReportReview, previous = review): Inspection {
  const swaps = new Map(previous.attachments.map(old => [old.photoId, review.attachments.find(item => item.attachmentId === old.attachmentId)?.photoId ?? old.photoId]))
  const replace = (ids: string[]) => [...new Set(ids.map(id => swaps.get(id) ?? id))]
  return {
    ...review.inspection, reportHeader: { siteName: review.siteName, owner: review.owner },
    reportLayout: [...review.attachments.map(item => ({ photoId: item.photoId, zone: item.zone ?? review.inspection.reportLayout?.find(entry => entry.photoId === item.photoId)?.zone ?? 'ledger' as const })), ...(review.inspection.reportLayout ?? []).filter(item => item.zone === null)],
    visual: review.inspection.visual.map(entry => ({ ...entry, photoIds: [...new Set([...replace(entry.photoIds), ...review.attachments.filter(item => item.itemId === entry.itemId).map(item => item.photoId)])] })),
    findings: review.inspection.findings.map(finding => ({ ...finding, photoIds: replace(finding.photoIds) })),
  }
}

const content = (inspection: Inspection, site: Site) => JSON.stringify({
  siteId: inspection.siteId, scheduledOn: inspection.scheduledOn, inspectedOn: inspection.inspectedOn ?? inspection.scheduledOn,
  inspector: inspection.inspector, weather: inspection.weather, visual: inspection.visual, measurements: inspection.measurements, findings: inspection.findings,
  header: inspection.reportHeader ?? { siteName: site.name, owner: site.owner }, text: inspection.reportText ?? buildReportText(inspection, site), layout: inspection.reportLayout ?? [], options: inspection.reportOptions,
})

export const reviewMatchesInspection = (review: ReportReview, inspection: Inspection, site: Site) => review.inspection.inspectionId === inspection.inspectionId && content(inspectionFromReview(review), site) === content(inspection, site)

export function approvedInspectionReport(state: DemoState, inspectionId: string): ReportReview | undefined {
  const inspection = state.inspections.find(item => item.inspectionId === inspectionId)
  const site = inspection && state.sites.find(item => item.siteId === inspection.siteId)
  const review = state.reportReviews.find(item => item.inspection.inspectionId === inspectionId)
  return inspection && site && review?.status === '承認済み' && hasCurrentCheck(review, site) && !unresolvedIssues(review, site).length && reviewMatchesInspection(review, inspection, site) ? review : undefined
}

export type ReportProgress = '作成待ち' | '作成中' | 'チェック待ち' | '差し戻し' | '再提出待ち' | '承認済み'
export function reportProgress(inspection: Inspection, site: Site, review?: ReportReview): ReportProgress | null {
  if (review) return review.status === '差し戻し' ? '差し戻し' : reviewMatchesInspection(review, inspection, site) && (review.status !== '承認済み' || hasCurrentCheck(review, site)) ? review.status : '再提出待ち'
  return inspection.status === '提出済み' ? '作成待ち' : inspection.status === '報告書作成済み' ? '作成中' : null
}

// 確認画面の変更も元の点検に戻し、同じ報告書を双方の画面で表示する。
export function syncReportReview(state: DemoState, review: ReportReview, previous = review): DemoState {
  const source = state.inspections.find(item => item.inspectionId === review.inspection.inspectionId)
  if (!source || source.siteId !== review.siteId) return state
  const inspection = inspectionFromReview(review, previous)
  const normalized = { ...review, inspection }
  return {
    ...state,
    inspections: state.inspections.map(item => item.inspectionId === source.inspectionId ? { ...item, ...inspection, status: item.status } : item),
    reportReviews: state.reportReviews.map(item => item.reviewId === review.reviewId ? normalized : item),
    photos: [...state.photos.filter(photo => !review.photos.some(item => item.photoId === photo.photoId)), ...review.photos],
  }
}

export function editReportReview(state: DemoState, reviewId: string, patch: Partial<ReportReview>): DemoState {
  const review = state.reportReviews.find(item => item.reviewId === reviewId)
  if (!review || review.status === '承認済み') return state
  return syncReportReview(state, { ...review, ...patch, check: undefined, confirmations: {} }, review)
}

export function submitInspectionReport(state: DemoState, inspectionId: string, now = new Date()): DemoState {
  const inspection = state.inspections.find(item => item.inspectionId === inspectionId)
  const site = inspection && state.sites.find(item => item.siteId === inspection.siteId)
  if (!inspection || !site || !['報告書作成済み', '完了'].includes(inspection.status)) return state
  const previous = state.reportReviews.find(item => item.inspection.inspectionId === inspectionId)
  if (previous && previous.status !== '差し戻し' && reviewMatchesInspection(previous, inspection, site) && (previous.status !== '承認済み' || hasCurrentCheck(previous, site))) return state
  const next = createReportReview(inspection, site, state.photos, now)
  if (previous) next.photos = [...next.photos, ...previous.photos.filter(photo => !next.photos.some(item => item.photoId === photo.photoId))]
  const reviews = [...state.reportReviews.filter(item => item.inspection.inspectionId !== inspectionId), next]
  return syncReportReview({ ...state, reportReviews: reviews }, next)
}

export function approveInspectionReport(state: DemoState, reviewId: string, name: string, confirmed: boolean, now = new Date()): DemoState {
  const review = state.reportReviews.find(item => item.reviewId === reviewId)
  const inspection = review && state.inspections.find(item => item.inspectionId === review.inspection.inspectionId)
  const site = inspection && state.sites.find(item => item.siteId === inspection.siteId)
  if (!review || !inspection || !site || !reviewMatchesInspection(review, inspection, site)) return state
  const approved = approveReport(review, site, name, confirmed, now)
  return approved === review ? state : { ...state, reportReviews: state.reportReviews.map(item => item.reviewId === reviewId ? approved : item) }
}

export function returnInspectionReport(state: DemoState, reviewId: string, name: string, note: string, now = new Date()): DemoState {
  const review = state.reportReviews.find(item => item.reviewId === reviewId)
  if (!review) return state
  const returned = returnReport(review, name, note, now)
  return returned === review ? state : { ...state, reportReviews: state.reportReviews.map(item => item.reviewId === reviewId ? returned : item) }
}

// 保存時のチェック結果は照合した内容そのものにひも付ける。
export const storeReportCheck = (review: ReportReview, site: Site, check: NonNullable<ReportReview['check']>) => reportFingerprint(review, site) === check.fingerprint ? { ...review, check } : review
