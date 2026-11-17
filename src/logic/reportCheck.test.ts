import { describe, expect, it } from 'vitest'
import { createSeed } from '../mock/seed'
import { reportCheckService } from '../services/reportCheckService'
import type { ReportReview } from '../types'
import { approveReport, checkReport, createReportReview, hasCurrentCheck, returnReport, unresolvedIssues } from './reportCheck'

const now = new Date(2026, 9, 28, 14)
const seed = createSeed(now)
const ownerReview = seed.reportReviews[0]
const photoReview = seed.reportReviews[1]
const siteOf = (review: ReportReview) => seed.sites.find(site => site.siteId === review.siteId)!
const checked = async (review: ReportReview) => ({ ...review, check: await reportCheckService.check(review, siteOf(review)) })
const clean = () => ({ ...ownerReview, owner: siteOf(ownerReview).owner })

describe('報告書チェック', () => {
  it('チェック待ち2件・承認済み4件で、名前と写真の取り違えをそれぞれ指摘する', () => {
    expect(seed.reportReviews.filter(review => review.status === 'チェック待ち')).toHaveLength(2)
    expect(seed.reportReviews.filter(review => review.status === '承認済み')).toHaveLength(4)
    expect(checkReport(ownerReview, siteOf(ownerReview)).map(issue => issue.key)).toEqual(['owner'])
    expect(checkReport(photoReview, siteOf(photoReview)).map(issue => issue.title)).toEqual(['別の発電所の写真が掲載されています'])
    for (const review of seed.reportReviews.slice(2)) expect(checkReport(review, siteOf(review))).toEqual([])
  })
  it('オーナー名の空白・全角半角の差は取り違えにしない', () => {
    expect(checkReport({ ...clean(), owner: ` ${siteOf(ownerReview).owner.replace(' ', '　')} ` }, siteOf(ownerReview))).toEqual([])
  })
  it('同じ発電所でも写真の点検項目が違えば指摘する', () => {
    const review = { ...clean(), photos: ownerReview.photos.map(photo => ({ ...photo, inspectionItemId: 'JB-01' })) }
    expect(checkReport(review, siteOf(review))[0].title).toBe('写真と点検項目が一致しません')
  })
  it('写真の欠落・所見の空白・未入力の測定値を検出する', () => {
    const review = { ...clean(), photos: [], inspection: { ...ownerReview.inspection, reportText: { summary: ' ', proposals: [] }, measurements: ownerReview.inspection.measurements.map((entry, index) => index ? entry : { ...entry, judgement: '未入力' as const }) } }
    expect(checkReport(review, siteOf(review)).map(issue => issue.key)).toEqual(['summary', 'measurements', `photo:${review.attachments[0].attachmentId}`])
  })
  it('目視×に掲載写真がなければ指摘する', () => {
    const review = { ...clean(), attachments: [], inspection: { ...ownerReview.inspection, visual: ownerReview.inspection.visual.map((entry, index) => index ? entry : { ...entry, result: '×' as const }) } }
    expect(checkReport(review, siteOf(review))[0].key).toBe('missing-photo:AR-01')
  })
  it('承認には最新のチェック・担当者名・全体確認・指摘への対応が必要', async () => {
    const review = await checked(clean())
    const site = siteOf(review)
    expect(approveReport(clean(), site, '担当者', true, now).status).toBe('チェック待ち')
    expect(approveReport(review, site, ' ', true, now).status).toBe('チェック待ち')
    expect(approveReport(review, site, '担当者', false, now).status).toBe('チェック待ち')
    const unresolved = await checked(ownerReview)
    expect(approveReport(unresolved, site, '担当者', true, now).status).toBe('チェック待ち')
    expect(approveReport(review, site, ' 担当者 ', true, now)).toMatchObject({ status: '承認済み', reviewedBy: '担当者', reviewedAt: now.toISOString() })
  })
  it('修正や台帳更新の後は、古いチェックでは承認できない', async () => {
    const review = await checked(clean())
    const changed = { ...review, owner: '別の名前' }
    expect(hasCurrentCheck(changed, siteOf(review))).toBe(false)
    expect(approveReport(changed, siteOf(review), '担当者', true, now).status).toBe('チェック待ち')
    expect(hasCurrentCheck(review, { ...siteOf(review), owner: '台帳更新後' })).toBe(false)
  })
  it('写真の差し替え後は、再チェックするまで承認できない', async () => {
    const review = await checked(photoReview)
    const changed = { ...review, attachments: review.attachments.map(item => ({ ...item, photoId: review.photos[0].photoId })) }
    expect(checkReport(changed, siteOf(changed))).toEqual([])
    expect(approveReport(changed, siteOf(changed), '担当者', true, now).status).toBe('チェック待ち')
    expect(approveReport(await checked(changed), siteOf(changed), '担当者', true, now).status).toBe('承認済み')
  })
  it('記載を変えずに承認するには、該当する指摘の根拠を残す必要がある', async () => {
    const review = await checked(ownerReview)
    const issue = review.check.issues[0]
    const confirmed = { ...review, confirmations: { [issue.key]: { fingerprint: issue.fingerprint, note: '登記変更をオーナーに確認済み' } } }
    expect(unresolvedIssues(confirmed, siteOf(review))).toEqual([])
    expect(approveReport(confirmed, siteOf(review), '担当者', true, now).status).toBe('承認済み')
    expect(unresolvedIssues({ ...confirmed, owner: 'さらに別の名前' }, siteOf(review))).toHaveLength(1)
    expect(unresolvedIssues({ ...confirmed, confirmations: { owner: { fingerprint: issue.fingerprint, note: ' ' } } }, siteOf(review))).toHaveLength(1)
  })
  it('差し戻しは理由と担当者を必須にし、承認済みの記録は変更しない', () => {
    expect(returnReport(ownerReview, '担当者', ' ', now)).toBe(ownerReview)
    expect(returnReport(ownerReview, ' ', '写真の確認をお願いします', now)).toBe(ownerReview)
    expect(returnReport(ownerReview, '担当者', '写真の確認をお願いします', now)).toMatchObject({ status: '差し戻し', returnNote: '写真の確認をお願いします', reviewedBy: '担当者' })
    const approved = seed.reportReviews[2]
    expect(returnReport(approved, '担当者', '変更', now)).toBe(approved)
    expect(approveReport(approved, siteOf(approved), '別担当者', true, now)).toBe(approved)
  })
  it('提出時の点検データをコピーし、元の文章の変更から独立させる', () => {
    const source = structuredClone(ownerReview.inspection)
    const review = createReportReview(source, siteOf(ownerReview), [], now)
    source.reportText!.summary = '提出後の書き換え'
    expect(review.inspection.reportText?.summary).not.toBe('提出後の書き換え')
  })
})
