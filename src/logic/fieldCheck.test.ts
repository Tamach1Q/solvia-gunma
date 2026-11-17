import { describe, expect, it } from 'vitest'
import { applyScenario } from '../mock/scenario'
import { createSeed, demoSiteId } from '../mock/seed'
import { criterionText } from './criteria'
import { missingItems } from './fieldCheck'
import { pastInspections } from './history'
import { measurementKey } from './judge'

const seed = createSeed(new Date(2026, 9, 28))
const site = seed.sites.find(item => item.siteId === demoSiteId)!
const current = seed.inspections.find(item => item.siteId === demoSiteId && item.status === '未依頼')!
const previous = pastInspections(seed.inspections, current).at(-1)

describe('入力漏れチェック', () => {
  it('何も入れていなければ、天候・目視20項目・測定25欄がすべて漏れになる', () => {
    const missing = missingItems(current)
    expect(missing[0]).toMatchObject({ step: 'start', title: '天候' })
    expect(missing.filter(item => item.step === 'visual')).toHaveLength(20)
    expect(missing.filter(item => item.step === 'measure')).toHaveLength(25)
  })
  it('デモ入力（写真付き）なら漏れはない', () => {
    const filled = applyScenario(current, site, previous)
    expect(missingItems(filled)).toEqual([])
  })
  it('×なのにコメント・写真がないものを挙げる', () => {
    const filled = applyScenario(current, site, previous)
    const broken = { ...filled, visual: filled.visual.map(entry => entry.itemId === 'AR-01' ? { ...entry, comment: ' ', photoIds: [] } : entry) }
    expect(missingItems(broken).map(item => item.reason)).toEqual(['×の内容（コメント）がありません', '×なのに写真がありません'])
  })
  it('読めない測定値は「数値として読み取れません」', () => {
    const filled = applyScenario(current, site, previous)
    const key = measurementKey('接地抵抗_架台')
    const broken = { ...filled, measurements: filled.measurements.map(entry => entry.key === key ? { ...entry, raw: 'abc', judgement: '未入力' as const } : entry) }
    expect(missingItems(broken)).toEqual([{ step: 'measure', key: `measure:${key}`, title: '発電所 接地抵抗（架台）', reason: '数値として読み取れません' }])
  })
})

describe('基準の表記', () => {
  const entries = current.measurements
  const find = (key: string) => entries.find(entry => entry.key === key)!
  it('種類ごとに thresholds から作る', () => {
    expect(criterionText(find(measurementKey('DC絶縁抵抗', 'PCS-2', 'PCS-2/回路2')), site, entries)).toBe('0.4MΩ以上')
    expect(criterionText(find(measurementKey('DC開放電圧', 'PCS-2', 'PCS-2/回路2')), site, entries)).toBe('直列数が同じ回路の中央値±5%以内')
    expect(criterionText(find('AC絶縁抵抗:PCS-1'), site, entries)).toBe('1MΩ以上')
    expect(criterionText(find('系統電圧UO:PCS-1'), site, entries)).toBe('95〜107V')
    expect(criterionText(find('接地抵抗_架台'), site, entries)).toBe('100Ω以下（D種）')
  })
})
