import { describe, expect, it } from 'vitest'
import { visualItems } from '../config/visualItems'
import { applyGunmaVisual, gunmaPhotos, photoLibrary } from '../mock/inspectionPhotos'
import { createSeed, demoSiteId } from '../mock/seed'
import { missingItems } from './fieldCheck'
import { buildReportText, defaultReportLayout, overallCounts } from './report'
import { checkReport, createReportReview, reportFingerprint } from './reportCheck'
import { createRepairCases } from './repairs'
import { reportProgress, submitInspectionReport } from './reportWorkflow'

const seed = createSeed(new Date(2026, 10, 19))
const site = seed.sites.find(site => site.siteId === demoSiteId)!
const blank = seed.inspections.find(inspection => inspection.siteId === site.siteId && inspection.status === '未依頼')!
const filled = applyGunmaVisual(blank)
const photos = gunmaPhotos(filled.inspectionId)
const inspection = { ...filled, status: '報告書作成済み' as const, reportFormat: 'A' as const, reportText: buildReportText(filled, site), reportLayout: defaultReportLayout(filled, photos) }

describe('群馬用の目視点検と報告書', () => {
  it('両様式で共通の21項目と12枚を対応させ、測定なしで提出できる', () => {
    expect(visualItems).toHaveLength(21)
    expect(new Set(visualItems.map(item => item.itemId)).size).toBe(21)
    expect(photoLibrary).toHaveLength(12)
    expect(blank.measurements).toEqual([])
    expect(overallCounts(filled)).toMatchObject({ total: 21, ok: 16, caution: 4, needsAction: 1, measurementCount: 0 })
    expect(missingItems(filled)).toEqual([])
    expect(checkReport(createReportReview(inspection, site, photos), site)).toEqual([])
    expect(createRepairCases(filled, site).map(repair => repair.title)).toEqual(['運転状態'])
  })
  it('一括入力は手入力の判定・所見・写真を保持する', () => {
    const custom = { ...blank, visual: blank.visual.map(entry => entry.itemId === '5-2' ? { ...entry, result: '○' as const, comment: '現地で運転再開を確認', photoIds: ['own-photo'] } : entry) }
    const noteOnly = { ...blank, visual: blank.visual.map(entry => entry.itemId === '1-2' ? { ...entry, comment: '先にメモした内容' } : entry) }
    expect(applyGunmaVisual(noteOnly).visual.find(entry => entry.itemId === '1-2')?.comment).toBe('先にメモした内容')
    expect(applyGunmaVisual(custom).visual.find(entry => entry.itemId === '5-2')).toEqual(custom.visual.find(entry => entry.itemId === '5-2'))
  })
  it('要観察も所見と写真を必要とする', () => {
    const incomplete = { ...filled, visual: filled.visual.map(entry => entry.itemId === '1-2' ? { ...entry, comment: '', photoIds: [] } : entry) }
    expect(missingItems(incomplete).map(item => item.key)).toEqual(['comment:1-2', 'photo:1-2'])
  })
  it('掲載除外した指摘写真は報告書チェックで検出する', () => {
    const excluded = { ...inspection, reportLayout: inspection.reportLayout.map(entry => photos.find(photo => photo.photoId === entry.photoId)?.inspectionItemId === '3-1' ? { ...entry, zone: null } : entry) }
    expect(checkReport(createReportReview(excluded, site, photos), site).map(issue => issue.key)).toEqual(['missing-photo:3-1'])
  })
  it('様式・提出先・案件番号を変更すると以前の提出とは一致しない', () => {
    const state = submitInspectionReport({ ...seed, photos, inspections: seed.inspections.map(item => item.inspectionId === inspection.inspectionId ? inspection : item) }, inspection.inspectionId)
    const review = state.reportReviews.find(review => review.inspection.inspectionId === inspection.inspectionId)!
    for (const patch of [{ reportFormat: 'B' as const }, { reportContractor: '元請A社' }, { reportCaseNo: 'A-0042' }]) {
      const changed = { ...inspection, ...patch }
      expect(reportProgress(changed, site, review)).toBe('再提出待ち')
      expect(reportFingerprint({ ...review, inspection: changed }, site)).not.toBe(reportFingerprint(review, site))
    }
  })
})
