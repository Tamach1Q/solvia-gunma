import { visualItems } from '../config/visualItems'
import type { Inspection, InspectionPhoto, ReportCheckIssue, ReportReview, Site } from '../types'
import { buildReportText, inspectionPhotos } from './report'

export const reviewItemTitle = (itemId: string) => visualItems.find(item => item.itemId === itemId)?.title ?? itemId
const normalize = (value: string) => value.normalize('NFKC').replace(/[\s　]/g, '')
export const reportFingerprint = (review: ReportReview, site: Site) => JSON.stringify({ owner: review.owner, siteName: review.siteName, inspection: review.inspection, attachments: review.attachments, photos: review.photos, reference: { siteId: site.siteId, name: site.name, owner: site.owner } })

// 写真の登録情報・台帳・点検記録を照合する。測定値そのものの適否は judge.ts の判定を使う。
export function checkReport(review: ReportReview, site: Site): ReportCheckIssue[] {
  const issues: ReportCheckIssue[] = []
  const add = (key: string, category: ReportCheckIssue['category'], title: string, actual: string, expected: string) => issues.push({ key, category, title, actual, expected, fingerprint: JSON.stringify([actual, expected]) })
  if (normalize(review.owner) !== normalize(site.owner)) add('owner', '基本情報', 'オーナー名が台帳と一致しません', review.owner || '記載なし', site.owner)
  if (normalize(review.siteName) !== normalize(site.name)) add('siteName', '基本情報', '発電所名が台帳と一致しません', review.siteName || '記載なし', site.name)
  if (!review.inspection.inspector.trim()) add('inspector', '記入漏れ', '点検者が記載されていません', '記載なし', '点検を実施した担当者名')
  if (!review.inspection.reportText?.summary.trim()) add('summary', '記入漏れ', '総合所見が記載されていません', '記載なし', '点検結果を踏まえた総合所見')
  const missing = review.inspection.measurements.filter(entry => entry.judgement === '未入力').length
  if (missing) add('measurements', '記入漏れ', '測定値に未入力があります', `${missing}項目が未入力`, '測定結果の入力と判定')
  for (const attachment of review.attachments) {
    const photo = review.photos.find(item => item.photoId === attachment.photoId)
    const title = reviewItemTitle(attachment.itemId)
    if (!photo?.url) add(`photo:${attachment.attachmentId}`, '写真', `${title}の写真を確認できません`, '掲載写真がありません', `${title}の写真`)
    else if (photo.siteId !== site.siteId) add(`photo:${attachment.attachmentId}`, '写真', '別の発電所の写真が掲載されています', photo.photoType, `${site.name}で撮影した写真`)
    else if (photo.inspectionItemId !== attachment.itemId) add(`photo:${attachment.attachmentId}`, '写真', '写真と点検項目が一致しません', reviewItemTitle(photo.inspectionItemId), title)
  }
  for (const visual of review.inspection.visual.filter(entry => entry.result === '×' || entry.result === '△')) {
    if (!review.attachments.some(item => item.itemId === visual.itemId)) add(`missing-photo:${visual.itemId}`, '写真', `${reviewItemTitle(visual.itemId)}の指摘写真がありません`, '掲載なし', '指摘箇所が分かる写真')
  }
  return issues
}

export const hasCurrentCheck = (review: ReportReview, site: Site) => review.check?.fingerprint === reportFingerprint(review, site)
export const unresolvedIssues = (review: ReportReview, site: Site) => checkReport(review, site).filter(issue => {
  const confirmation = review.confirmations[issue.key]
  return confirmation?.fingerprint !== issue.fingerprint || !confirmation.note.trim()
})

export function approveReport(review: ReportReview, site: Site, reviewer: string, confirmed: boolean, now = new Date()): ReportReview {
  if (review.status !== 'チェック待ち' || !hasCurrentCheck(review, site) || unresolvedIssues(review, site).length || !confirmed || !reviewer.trim()) return review
  return { ...review, status: '承認済み', reviewedBy: reviewer.trim(), reviewedAt: now.toISOString(), returnNote: undefined }
}

export function returnReport(review: ReportReview, reviewer: string, note: string, now = new Date()): ReportReview {
  if (review.status !== 'チェック待ち' || !reviewer.trim() || !note.trim()) return review
  return { ...review, status: '差し戻し', reviewedBy: reviewer.trim(), reviewedAt: now.toISOString(), returnNote: note.trim() }
}

export function createReportReview(inspection: Inspection, site: Site, photos: InspectionPhoto[], now = new Date()): ReportReview {
  const related = inspectionPhotos(inspection, photos)
  const included = inspection.reportLayout ? inspection.reportLayout.filter(item => item.zone).map(item => related.find(photo => photo.photoId === item.photoId)).filter((photo): photo is InspectionPhoto => Boolean(photo)) : related
  return {
    reviewId: `REVIEW-${inspection.inspectionId}`, siteId: site.siteId, siteName: inspection.reportHeader?.siteName ?? site.name, owner: inspection.reportHeader?.owner ?? site.owner,
    inspection: structuredClone({ ...inspection, reportText: inspection.reportText ?? buildReportText(inspection, site) }),
    photos: related.map(photo => ({ ...photo, siteId: photo.siteId ?? site.siteId })),
    attachments: included.map(photo => ({ attachmentId: `ATT-${photo.photoId}`, itemId: photo.inspectionItemId, photoId: photo.photoId, zone: inspection.reportLayout?.find(item => item.photoId === photo.photoId)?.zone ?? 'ledger' })),
    submittedAt: now.toISOString(), status: 'チェック待ち', confirmations: {},
  }
}
