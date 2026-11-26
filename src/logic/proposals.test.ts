import { buildMeasurementEntries } from './judge'
import { describe, expect, it } from 'vitest'
import { createSeed, demoSiteId } from '../mock/seed'
import type { Finding, Inspection } from '../types'
import { judgeMeasurements, measurementKey } from './judge'
import { buildProposals } from './proposals'

const seed = createSeed(new Date(2026, 9, 28))
const site = seed.sites.find(item => item.siteId === demoSiteId)!
const [, , previous, empty] = seed.inspections.filter(item => item.siteId === demoSiteId).sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))

const current = { ...empty, measurements: buildMeasurementEntries(site) }

const withVisual = (inspection: Inspection, itemId: string, comment: string): Inspection => ({ ...inspection, visual: inspection.visual.map(entry => entry.itemId === itemId ? { ...entry, result: '×', comment } : entry) })
const withRaw = (inspection: Inspection, key: string, raw: string): Inspection => ({ ...inspection, measurements: judgeMeasurements(inspection.measurements.map(entry => entry.key === key ? { ...entry, raw } : entry), site, '晴れ', previous.measurements) })

describe('buildProposals', () => {
  it('ボルトの緩みは当日増し締め済みか次回作業かを選べる', () => {
    const inspection = withVisual(current, '3-2', '')
    expect(buildProposals(inspection, site, previous)).toEqual(['架台ボルトに緩みを確認しました。次回作業で増し締めを行います。'])
    expect(buildProposals(inspection, site, previous, { boltTightenedOnSite: true })).toEqual(['架台ボルトに緩みを確認しました。当日増し締め済みです。'])
  })
  it('雑草・影は除草を提案する', () => {
    expect(buildProposals(withVisual(current, '1-4', '南側に雑草'), site, previous)).toEqual(['発電に影響する雑草・影を確認しました。除草作業をご提案します。'])
  })
  it('テンプレートに当てはまらない目視×は項目とコメントから作る', () => {
    expect(buildProposals(withVisual(current, '6-2', 'SPD表示窓が赤色。'), site, previous)).toEqual(['分電盤・ブレーカーについてSPD表示窓が赤色。対応方法をご相談させてください。'])
  })
  it('DC絶縁抵抗の要確認は前回値を添える', () => {
    const key = measurementKey('DC絶縁抵抗', 'PCS-2', 'PCS-2/回路2')
    expect(buildProposals(withRaw(current, key, '5'), site, previous)).toEqual(['PCS-2 回路2の絶縁抵抗は基準内ですが、前回（12MΩ）から低下しています。次回点検までの経過観察、または早期の詳細調査をご検討ください。'])
  })
  it('テンプレートのない測定の不適合は判定理由から作る', () => {
    expect(buildProposals(withRaw(current, '接地抵抗_架台', '150'), site, previous)).toEqual(['発電所 接地抵抗（架台）について基準100Ω以下（D種）に対し150Ω。対応方法をご相談させてください。'])
  })
  it('指摘がなければ空', () => {
    expect(buildProposals(current, site, previous)).toEqual([])
  })
})

describe('同じ回路の目視×と絶縁抵抗の不適合', () => {
  const key = measurementKey('DC絶縁抵抗', 'PCS-2', 'PCS-2/回路2')
  const failing = withRaw(current, key, '0.3')
  const withFinding = (inspection: Inspection, itemId: string, comment: string, finding: Omit<Finding, 'findingId' | 'source' | 'refKey' | 'comment' | 'photoIds'>): Inspection => ({ ...withVisual(inspection, itemId, comment), findings: [...inspection.findings, { findingId: `F-${itemId}`, source: 'visual', refKey: itemId, comment, photoIds: [], ...finding }] })

  it('パネル位置から回路を引き、1本のご提案（交換→再測定）にまとめる', () => {
    const inspection = withFinding(failing, '2-2', '表面ガラスの割れ', { arrayId: 'B', panels: [{ row: 1, col: 5 }] })
    expect(buildProposals(inspection, site, previous)).toEqual(['アレイB 1段目5列目のモジュールに割れを確認しました。同じ回路（PCS-2 回路2）の絶縁抵抗も0.3MΩ（基準0.4MΩ以上）に低下しており、割れた箇所からの浸水が原因と考えられます。該当モジュールの交換と、交換後の絶縁抵抗の再測定をご提案します。'])
  })
  it('パネル以外の目視×も、同じ回路なら補修→再測定の1本にまとめる', () => {
    const inspection = withFinding(failing, '4-3', 'コネクタの被覆が裂けている', { arrayId: 'B', panels: [{ row: 1, col: 9 }], circuitId: 'PCS-2/回路2' })
    expect(buildProposals(inspection, site, previous)).toEqual(['アレイB 1段目9列目のコネクタについてコネクタの被覆が裂けている。同じ回路（PCS-2 回路2）の絶縁抵抗も0.3MΩ（基準0.4MΩ以上）に低下しており、関連が考えられます。該当箇所の補修と、補修後の絶縁抵抗の再測定をご提案します。'])
  })
  it('別の回路のパネル割れは別々のご提案にする', () => {
    const inspection = withFinding(failing, '2-2', '表面ガラスの割れ', { arrayId: 'A', panels: [{ row: 1, col: 2 }] })
    const proposals = buildProposals(inspection, site, previous)
    expect(proposals).toHaveLength(2)
    expect(proposals[0]).toMatch(/^PCS-2 回路2で絶縁抵抗の低下（0\.3MΩ/)
    expect(proposals[1]).toMatch(/^アレイA 1段目2列目のモジュールに破損を確認しました。/)
  })
})
