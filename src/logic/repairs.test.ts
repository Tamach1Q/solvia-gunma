import { describe, expect, it } from 'vitest'
import { applyScenario, scenarioPhotos } from '../mock/scenario'
import { createSeed, demoSiteId } from '../mock/seed'
import { pastInspections } from './history'
import { completeInspection, nextInspection } from './lifecycle'
import { approveInspectionReport, submitInspectionReport } from './reportWorkflow'
import { checkReport, reportFingerprint } from './reportCheck'
import { completeRepair, createRepairCases, decideRepair, judgeRemeasure, remeasureTarget, repairResult, resolveLinkedRepairs, scheduleRepair } from './repairs'

const seed = createSeed(new Date(2026, 9, 28))
const site = seed.sites.find(item => item.siteId === demoSiteId)!
const current = seed.inspections.find(item => item.siteId === demoSiteId && item.status === '未依頼')!
const previous = pastInspections(seed.inspections, current).at(-1)
const filled = { ...applyScenario(current, site, previous), status: '報告書作成済み' as const, inspectedOn: '2026-10-28' }
const state = { ...seed, inspections: seed.inspections.map(item => item.inspectionId === filled.inspectionId ? filled : item) }
const submitted = submitInspectionReport({ ...state, photos: [...state.photos, ...scenarioPhotos(filled.inspectionId)] }, filled.inspectionId)
const submittedReview = submitted.reportReviews.find(item => item.inspection.inspectionId === filled.inspectionId)!
const checkedState = { ...submitted, reportReviews: submitted.reportReviews.map(item => item.reviewId === submittedReview.reviewId ? { ...item, check: { fingerprint: reportFingerprint(item, site), checkedAt: new Date().toISOString(), issues: checkReport(item, site) } } : item) }
const approvedState = approveInspectionReport(checkedState, submittedReview.reviewId, '確認担当', true)

describe('修繕案件の自動作成', () => {
  it('測定の不適合と目視の×から2件作る', () => {
    expect(createRepairCases(filled, site).map(repair => [repair.title, repair.status])).toEqual([
      ['PCS-2 回路2 絶縁抵抗（DC）の不適合（0.3MΩ）', 'お客様確認中'],
      ['モジュール表面の汚れ・破損（アレイB 1段目5列目）', 'お客様確認中'],
    ])
  })
  it('再測定の対象：測定の指摘はその欄、パネル割れは担当回路のDC絶縁抵抗', () => {
    const [insulation, panel] = createRepairCases(filled, site)
    expect(remeasureTarget(insulation, filled, site)?.key).toBe('DC絶縁抵抗:PCS-2:PCS-2/回路2')
    expect(remeasureTarget(panel, filled, site)?.key).toBe('DC絶縁抵抗:PCS-2:PCS-2/回路2')
  })
})

describe('修繕案件の進行', () => {
  const [, panel] = createRepairCases(filled, site)
  it('お客様確認中 → 対応決定（交換） → 作業予定 → 完了。再測定が適合なら修正済み', () => {
    const decided = decideRepair(panel, '交換', '2026-11-02')
    expect(decided).toMatchObject({ status: '対応決定', customerDecision: '交換', decidedOn: '2026-11-02' })
    const scheduled = scheduleRepair(decided)
    expect(scheduled.status).toBe('作業予定')
    const remeasure = judgeRemeasure('85', remeasureTarget(panel, filled, site)!, filled, site)
    expect(remeasure).toMatchObject({ raw: '85', judgement: '適合' })
    const done = completeRepair(scheduled, { workNote: 'アレイB 1段目5列目のモジュールを交換', afterPhotoIds: ['PH-1'], remeasure })
    expect(done).toMatchObject({ status: '完了', workNote: 'アレイB 1段目5列目のモジュールを交換', afterPhotoIds: ['PH-1'] })
    expect(repairResult(done)).toBe('修正済み')
  })
  it('再測定が基準未満なら修正済みにしない', () => {
    const remeasure = judgeRemeasure('0.35', remeasureTarget(panel, filled, site)!, filled, site)
    expect(repairResult(completeRepair(scheduleRepair(decideRepair(panel, '修理', '2026-11-02')), { workNote: '補修', afterPhotoIds: [], remeasure }))).toBe('完了')
  })
  it('経過観察で再測定なしなら「経過観察」', () => {
    expect(repairResult(completeRepair(decideRepair(panel, '経過観察', '2026-11-02'), { workNote: '', afterPhotoIds: [] }))).toBe('経過観察')
  })
})

describe('点検の完了', () => {
  it('完了・修繕案件2件・1年後の予定（未依頼）を作る', () => {
    const next = completeInspection(approvedState, filled.inspectionId, '2026-10-28')
    expect(next.inspections.find(item => item.inspectionId === filled.inspectionId)?.status).toBe('完了')
    expect(next.repairCases.filter(item => item.inspectionId === filled.inspectionId)).toHaveLength(2)
    expect(next.inspections.find(item => item.siteId === demoSiteId && item.scheduledOn === '2027-10-28')).toMatchObject({ status: '未依頼', inspectionId: 'INS-S-03-20271028' })
  })
  it('2回押しても重複しない', () => {
    const once = completeInspection(approvedState, filled.inspectionId, '2026-10-28')
    const twice = completeInspection(once, filled.inspectionId, '2026-10-28')
    expect(twice.repairCases).toHaveLength(once.repairCases.length)
    expect(twice.inspections).toHaveLength(once.inspections.length)
  })
  it('うるう日の1年後は2/28', () => {
    expect(nextInspection({ ...filled, inspectedOn: '2028-02-29' }, site).scheduledOn).toBe('2029-02-28')
  })
})

describe('修繕案件の連動', () => {
  const [insulation, panel] = createRepairCases(filled, site)
  const finish = (raw: string) => completeRepair(scheduleRepair(decideRepair(panel, '交換', '2026-11-02')), { workNote: '交換', afterPhotoIds: [], remeasure: judgeRemeasure(raw, remeasureTarget(panel, filled, site)!, filled, site) })
  it('パネル交換後の再測定が適合なら、同じ回路の絶縁抵抗の案件も修正済みにする', () => {
    const done = finish('85')
    const [linked] = resolveLinkedRepairs([insulation, done], done, filled, site)
    expect(linked).toMatchObject({ status: '完了', customerDecision: '交換', decidedOn: '2026-11-02', workNote: 'アレイB 1段目5列目の交換により修正' })
    expect(repairResult(linked)).toBe('修正済み')
  })
  it('再測定が不適合なら連動しない', () => {
    const done = finish('0.35')
    expect(resolveLinkedRepairs([insulation, done], done, filled, site)[0]).toBe(insulation)
  })
  it('別の点検の案件は連動しない', () => {
    const done = finish('85')
    const other = { ...insulation, inspectionId: 'INS-OTHER' }
    expect(resolveLinkedRepairs([other, done], done, filled, site)[0]).toBe(other)
  })
})
