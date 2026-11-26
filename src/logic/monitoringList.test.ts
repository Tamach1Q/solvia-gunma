import { describe, expect, it } from 'vitest'
import { createSeed } from '../mock/seed'
import type { SiteState } from '../types'
import { monitoringList, type MonitoringListRow } from './monitoringList'

const base = createSeed(new Date(2026, 10, 22)).sites[0]
const rows: MonitoringListRow[] = Array.from({ length: 200 }, (_, index) => ({
  site: { ...base, siteId: `S-${index}`, name: `発電所${index + 1}`, area: index % 2 ? '高崎市' : '前橋市', monitoringSystem: index % 3 ? 'エコめがね' : 'ラプラス' },
  state: (['正常', '修繕対応中', '経過観察', '異常停止中'] as SiteState[])[index % 4],
  monitor: { siteId: `S-${index}`, outputKw: 20 },
  next: index % 2 ? { scheduledOn: `2026-12-${String(index % 28 + 1).padStart(2, '0')}` } : undefined,
}))
const options = { query: '', state: 'すべて' as const, area: '', system: '', sort: '状態' as const, page: 1, pageSize: 25 }

describe('統合監視の200件の一覧', () => {
  it('25件ずつ8ページになり、全件が重複なく表示される', () => {
    const results = Array.from({ length: 8 }, (_, index) => monitoringList(rows, { ...options, page: index + 1 }))
    expect(results.every(result => result.pages === 8 && result.rows.length === 25)).toBe(true)
    expect(new Set(results.flatMap(result => result.rows.map(row => row.site.siteId))).size).toBe(200)
    expect(results[7]).toMatchObject({ from: 176, to: 200, total: 200 })
  })
  it('異常・対応を優先し、同じ状態では発電所名を自然順で並べる', () => {
    expect(monitoringList(rows, { ...options, pageSize: 200 }).rows.map(row => row.state)).toEqual([
      ...Array(50).fill('異常停止中'), ...Array(50).fill('修繕対応中'), ...Array(50).fill('経過観察'), ...Array(50).fill('正常'),
    ])
    expect(monitoringList(rows, options).rows[0].site.name).toBe('発電所4')
  })
  it('検索・状態・エリア・監視システムを同時に絞り込む', () => {
    const result = monitoringList(rows, { ...options, query: '発電所', state: '異常停止中', area: '高崎市', system: 'ラプラス', pageSize: 200 })
    expect(result.total).toBeGreaterThan(0)
    expect(result.rows.every(row => row.state === '異常停止中' && row.site.area === '高崎市' && row.site.monitoringSystem === 'ラプラス')).toBe(true)
    expect(monitoringList(rows, { ...options, query: 'ラプラス' }).rows.every(row => row.site.monitoringSystem === 'ラプラス')).toBe(true)
  })
  it('条件変更でページ数が減った場合や0件でも表示範囲が破綻しない', () => {
    expect(monitoringList(rows, { ...options, state: '異常停止中', page: 8 })).toMatchObject({ page: 2, pages: 2, total: 50, from: 26, to: 50 })
    expect(monitoringList(rows, { ...options, query: '存在しない', page: 8 })).toMatchObject({ page: 1, pages: 1, total: 0, from: 0, to: 0 })
  })
  it('次回点検日順は未予定を末尾にし、入力配列は変更しない', () => {
    const before = rows.map(row => row.site.siteId)
    const result = monitoringList(rows, { ...options, sort: '次回点検日', pageSize: 200 })
    expect(result.rows.slice(0, 100).every(row => row.next)).toBe(true)
    expect(result.rows.slice(100).every(row => !row.next)).toBe(true)
    expect(rows.map(row => row.site.siteId)).toEqual(before)
  })
})
