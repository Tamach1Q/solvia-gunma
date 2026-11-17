// MOCK: 報告書チェック用の提出記録。名前の取り違えと別発電所の写真を含む2件、承認済み4件を作る。
import { checkReport, createReportReview, reportFingerprint } from '../logic/reportCheck'
import { addDays, parseDate, toDateString } from '../logic/dates'
import type { Inspection, ReportReview, Site } from '../types'
import { modulePhotoUrl, scenarioPhotoUrl } from './scenarioPhoto'

export function createReviewSeed(sites: Site[], inspections: Inspection[], now: Date): ReportReview[] {
  return ['S-01', 'S-02', 'S-04', 'S-05', 'S-06', 'S-08'].map((siteId, index) => {
    const site = sites.find(item => item.siteId === siteId)!
    const inspection = inspections.filter(item => item.siteId === siteId && item.status === '完了').sort((a, b) => b.scheduledOn.localeCompare(a.scheduledOn))[0]
    const submittedAt = parseDate(addDays(toDateString(now), -index))
    submittedAt.setHours(9, 20 + index * 5)
    const record = createReportReview(inspection, site, [], submittedAt)
    const ownPhoto = { photoId: `PH-REVIEW-${siteId}`, siteId, inspectionItemId: 'AR-01', equipmentId: 'A-1-1', photoType: `${site.name}・モジュール表面`, takenAt: `${inspection.inspectedOn}T09:30:00+09:00`, url: modulePhotoUrl }
    const otherSite = sites.find(item => item.siteId !== siteId)!
    const wrongPhoto = { ...ownPhoto, photoId: `${ownPhoto.photoId}-OTHER`, siteId: otherSite.siteId, photoType: `${otherSite.name}・モジュール表面`, url: scenarioPhotoUrl }
    const review: ReportReview = { ...record, owner: index === 0 ? otherSite.owner : site.owner, photos: [ownPhoto, wrongPhoto], attachments: [{ attachmentId: `ATT-${siteId}`, itemId: 'AR-01', photoId: index === 1 ? wrongPhoto.photoId : ownPhoto.photoId }] }
    if (index >= 2) {
      review.check = { fingerprint: reportFingerprint(review, site), checkedAt: submittedAt.toISOString(), issues: checkReport(review, site) }
      review.status = '承認済み'
      review.reviewedBy = '管理担当 A'
      review.reviewedAt = new Date(submittedAt.getTime() + 3600000).toISOString()
    }
    return review
  })
}
