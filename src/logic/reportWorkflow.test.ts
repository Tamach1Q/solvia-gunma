import { describe, expect, it } from 'vitest'
import { createSeed, demoSiteId } from '../mock/seed'
import { applyScenario, scenarioPhotos } from '../mock/scenario'
import { completeInspection } from './lifecycle'
import { reportCheckService } from '../services/reportCheckService'
import type { DemoState } from '../mock/seed'
import { approveInspectionReport, approvedInspectionReport, editReportReview, reportProgress, returnInspectionReport, reviewMatchesInspection, storeReportCheck, submitInspectionReport } from './reportWorkflow'

const now = new Date(2026, 9, 28, 14)
const initial = createSeed(now)
const site = initial.sites.find(item => item.siteId === demoSiteId)!
const empty = initial.inspections.find(item => item.siteId === site.siteId && item.status === '未依頼')!
const inspection = { ...applyScenario(empty, site), status: '報告書作成済み' as const, inspectedOn: '2026-10-28' }
const draft = { ...initial, inspections: initial.inspections.map(item => item.inspectionId === inspection.inspectionId ? inspection : item), photos: [...initial.photos, ...scenarioPhotos(inspection.inspectionId)] }
const reviewOf = (state: DemoState) => state.reportReviews.find(item => item.inspection.inspectionId === inspection.inspectionId)!
const sourceOf = (state: DemoState) => state.inspections.find(item => item.inspectionId === inspection.inspectionId)!
const submitted = () => submitInspectionReport(draft, inspection.inspectionId, now)
const checked = async (state: DemoState) => {
  const review = reviewOf(state)
  const check = await reportCheckService.check(review, site)
  return { ...state, reportReviews: state.reportReviews.map(item => item.reviewId === review.reviewId ? storeReportCheck(item, site, check) : item) }
}

describe('点検と報告書チェックの連携', () => {
  it('提出した同じ案件がチェック待ちになり、二度提出しても重複しない', () => {
    const state = submitted()
    expect(reportProgress(sourceOf(state), site, reviewOf(state))).toBe('チェック待ち')
    expect(reviewMatchesInspection(reviewOf(state), sourceOf(state), site)).toBe(true)
    expect(submitInspectionReport(state, inspection.inspectionId, now)).toBe(state)
    expect(state.reportReviews).toHaveLength(initial.reportReviews.length + 1)
  })
  it('未提出・チェック待ちでは点検を完了せず、修繕や次回予定も作らない', () => {
    expect(completeInspection(draft, inspection.inspectionId, '2026-10-28')).toBe(draft)
    const state = submitted()
    expect(completeInspection(state, inspection.inspectionId, '2026-10-28')).toBe(state)
  })
  it('チェック画面の名前・文章の修正は、台帳を変えずに元の報告書に反映する', () => {
    const state = submitted()
    const review = reviewOf(state)
    const next = editReportReview(state, review.reviewId, { owner: '別の名前', inspection: { ...review.inspection, reportText: { summary: '確認して修正した所見', proposals: [] } } })
    expect(sourceOf(next).reportHeader?.owner).toBe('別の名前')
    expect(sourceOf(next).reportText?.summary).toBe('確認して修正した所見')
    expect(next.sites.find(item => item.siteId === site.siteId)?.owner).toBe(site.owner)
    expect(reviewMatchesInspection(reviewOf(next), sourceOf(next), site)).toBe(true)
  })
  it('写真の差し替えを元の写真配置・目視・異常箇所にも反映する', () => {
    const state = submitted()
    const review = reviewOf(state)
    const original = review.photos[0]
    const replacement = { ...original, photoId: 'PH-REPLACED' }
    const next = editReportReview(state, review.reviewId, { photos: [...review.photos, replacement], attachments: review.attachments.map(item => ({ ...item, photoId: replacement.photoId })) })
    expect(sourceOf(next).reportLayout?.map(item => item.photoId)).toContain(replacement.photoId)
    expect(sourceOf(next).visual.find(item => item.itemId === 'AR-01')?.photoIds).toEqual([replacement.photoId])
    expect(sourceOf(next).findings.every(item => item.photoIds.includes(replacement.photoId))).toBe(true)
    expect(next.photos.find(item => item.photoId === replacement.photoId)).toEqual(replacement)
    expect(reviewMatchesInspection(reviewOf(next), sourceOf(next), site)).toBe(true)
  })
  it('差し戻し後に元の報告書を修正・再提出し、同じ案件を承認して完了まで進む', async () => {
    const waiting = await checked(submitted())
    const returned = returnInspectionReport(waiting, reviewOf(waiting).reviewId, '確認担当', '総合所見を追記してください', now)
    expect(reportProgress(sourceOf(returned), site, reviewOf(returned))).toBe('差し戻し')
    const edited = { ...returned, inspections: returned.inspections.map(item => item.inspectionId === inspection.inspectionId ? { ...item, reportText: { summary: `${item.reportText!.summary}写真を確認して追記。`, proposals: item.reportText!.proposals } } : item) }
    const resubmitted = submitInspectionReport(edited, inspection.inspectionId, now)
    expect(resubmitted.reportReviews).toHaveLength(waiting.reportReviews.length)
    expect(reviewOf(resubmitted).status).toBe('チェック待ち')
    expect(reviewOf(resubmitted).check).toBeUndefined()
    expect(reviewOf(resubmitted).inspection.reportText?.summary).toContain('写真を確認して追記。')
    const approved = approveInspectionReport(await checked(resubmitted), reviewOf(resubmitted).reviewId, '確認担当', true, now)
    expect(reportProgress(sourceOf(approved), site, reviewOf(approved))).toBe('承認済み')
    expect(approvedInspectionReport(approved, inspection.inspectionId)?.reviewedBy).toBe('確認担当')
    const done = completeInspection(approved, inspection.inspectionId, '2026-10-28')
    expect(sourceOf(done).status).toBe('完了')
    expect(done.repairCases.filter(item => item.inspectionId === inspection.inspectionId)).toHaveLength(2)
    expect(done.inspections.some(item => item.siteId === site.siteId && item.scheduledOn === '2027-10-28')).toBe(true)
    expect(completeInspection(done, inspection.inspectionId, '2026-10-28')).toBe(done)
  })
  it('承認後に元の文章が変われば完了できず、再提出で承認を取り直す', async () => {
    const waiting = await checked(submitted())
    const approved = approveInspectionReport(waiting, reviewOf(waiting).reviewId, '確認担当', true, now)
    const changed = { ...approved, inspections: approved.inspections.map(item => item.inspectionId === inspection.inspectionId ? { ...item, reportHeader: { siteName: site.name, owner: '変更後の名前' } } : item) }
    expect(reportProgress(sourceOf(changed), site, reviewOf(changed))).toBe('再提出待ち')
    expect(completeInspection(changed, inspection.inspectionId, '2026-10-28')).toBe(changed)
    expect(reviewOf(submitInspectionReport(changed, inspection.inspectionId, now)).status).toBe('チェック待ち')
  })
  it('元の内容と違う提出記録では承認できず、承認済みの確認記録は編集しない', async () => {
    const waiting = await checked(submitted())
    const changed = { ...waiting, inspections: waiting.inspections.map(item => item.inspectionId === inspection.inspectionId ? { ...item, inspector: '別の担当者' } : item) }
    expect(approveInspectionReport(changed, reviewOf(changed).reviewId, '確認担当', true, now)).toBe(changed)
    const approved = approveInspectionReport(waiting, reviewOf(waiting).reviewId, '確認担当', true, now)
    expect(editReportReview(approved, reviewOf(approved).reviewId, { owner: '変更' })).toBe(approved)
  })
  it('初期の提出記録も元の点検とひも付いている', () => {
    for (const review of initial.reportReviews) {
      const source = initial.inspections.find(item => item.inspectionId === review.inspection.inspectionId)!
      const sourceSite = initial.sites.find(item => item.siteId === source.siteId)!
      expect(reviewMatchesInspection(review, source, sourceSite)).toBe(true)
    }
  })
})
