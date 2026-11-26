import { describe, expect, it } from 'vitest'
import { adminLocationHash, readAdminLocation } from './navigation'

describe('管理画面のURL', () => {
  it('初回と不正な画面指定は統合監視を開く', () => {
    expect(readAdminLocation('').view).toBe('monitoring')
    expect(readAdminLocation('#view=unknown').view).toBe('monitoring')
  })
  it('報告書の点検IDを再読み込み後も復元できる', () => {
    const route = { view: 'report' as const, inspectionId: 'INS-S-03-20261119', siteId: null, repairId: null, reviewId: null }
    expect(readAdminLocation(adminLocationHash(route))).toEqual(route)
  })
  it('提出報告書・修繕・カルテの対象をそれぞれ復元できる', () => {
    for (const route of [
      { view: 'checkedReport' as const, reviewId: 'REVIEW-1' },
      { view: 'repair' as const, repairId: 'RC-1' },
      { view: 'karte' as const, siteId: 'S-03' },
    ]) {
      const expected = { inspectionId: null, siteId: null, repairId: null, reviewId: null, ...route }
      expect(readAdminLocation(adminLocationHash(expected))).toEqual(expected)
    }
  })
})
