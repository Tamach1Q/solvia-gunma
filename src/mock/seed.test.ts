import { buildMeasurementEntries } from '../logic/judge'
import { describe, expect, it } from 'vitest'
import { measurementKey } from '../logic/judge'
import { buildProposals } from '../logic/proposals'
import { circuitForPanel, panelKw, pcsRatedKw, siteCircuits } from '../logic/site'
import { applyScenario, scenarioCircuitId, scenarioPanel } from './scenario'
import { createSeed, demoSiteId } from './seed'

const now = new Date(2026, 9, 28)
const seed = createSeed(now)
const demoSite = seed.sites.find(site => site.siteId === demoSiteId)!
const demoInspections = seed.inspections.filter(inspection => inspection.siteId === demoSiteId).sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))
const dcKey = measurementKey('DC絶縁抵抗', 'PCS-2', 'PCS-2/回路2')

describe('シードデータ', () => {
  it('5エリアに8発電所', () => {
    expect(seed.sites).toHaveLength(8)
    expect(new Set(seed.sites.map(site => site.area))).toEqual(new Set(['前橋市', '渋川市', '高崎市', '伊勢崎市', '沼田市']))
  })
  it('デモ対象はアレイA・B各3段×9列、1段＝1回路（9直列×Voc41V＝369V）、5.5kW PCS×3台、370W×54枚', () => {
    expect(demoSite.name).toBe('渋川市 第2太陽光発電所')
    expect(demoSite.arrays.map(array => [array.label, array.rows, array.cols])).toEqual([['アレイA', 3, 9], ['アレイB', 3, 9]])
    expect(demoSite.pcs.map(pcs => [pcs.pcsId, pcs.ratedKw, pcs.circuits.map(circuit => `${circuit.arrayId}${circuit.rows.join('')}`)])).toEqual([
      ['PCS-1', 5.5, ['A1', 'A2']], ['PCS-2', 5.5, ['A3', 'B1']], ['PCS-3', 5.5, ['B2', 'B3']],
    ])
    expect(siteCircuits(demoSite).every(circuit => circuit.seriesCount * demoSite.module.vocPerModule === 369)).toBe(true)
    expect(demoSite.module).toMatchObject({ pmaxW: 370, count: 54 })
    expect(panelKw(demoSite) / pcsRatedKw(demoSite)).toBeCloseTo(1.21, 2)
    expect(demoSite.capacityKw).toBe(16.5)
  })
  it('パネルの位置から担当回路を引ける', () => {
    expect(circuitForPanel(demoSite, 'B', 1)?.circuitId).toBe('PCS-2/回路2')
    expect(circuitForPanel(demoSite, 'A', 3)?.circuitId).toBe('PCS-2/回路1')
    expect(circuitForPanel(demoSite, 'B', 4)).toBeUndefined()
  })
  it.each(seed.sites.map(site => [site.name, site] as const))('%s：回路がアレイの全段を重複なく担当し、容量が整合している', (_, site) => {
    const circuits = siteCircuits(site)
    const covered = circuits.flatMap(circuit => circuit.rows.map(row => `${circuit.arrayId}-${row}`))
    const allRows = site.arrays.flatMap(array => Array.from({ length: array.rows }, (__, index) => `${array.arrayId}-${index + 1}`))
    expect([...covered].sort()).toEqual([...allRows].sort())
    for (const circuit of circuits) expect(circuit.seriesCount).toBe(circuit.rows.length * site.arrays.find(array => array.arrayId === circuit.arrayId)!.cols)
    expect(circuits.reduce((sum, circuit) => sum + circuit.seriesCount, 0)).toBe(site.module.count)
    expect(site.module.count).toBe(site.arrays.reduce((sum, array) => sum + array.rows * array.cols, 0))
    expect(site.capacityKw).toBeCloseTo(pcsRatedKw(site))
    // 開放電圧は単相PCSの入力上限（約450V）に収める
    for (const circuit of circuits) expect(circuit.seriesCount * site.module.vocPerModule).toBeLessThanOrEqual(460)
  })
  it.each(seed.sites.map(site => [site.name, site] as const))('%s：パネル容量/PCS容量が1.1〜1.4', (_, site) => {
    const ratio = panelKw(site) / pcsRatedKw(site)
    expect(ratio).toBeGreaterThanOrEqual(1.1)
    expect(ratio).toBeLessThanOrEqual(1.4)
  })
  it('オプティマイザー方式（SolarEdge）の機器は使わない', () => {
    expect(seed.sites.some(site => site.monitoringSystem === 'SolarEdge' || site.pcs.some(pcs => pcs.maker === 'SolarEdge'))).toBe(false)
  })
  it('住所は大字までで、番地を含めない', () => {
    for (const site of seed.sites) expect(site.address).not.toMatch(/\d/)
  })
  it('デモ対象の過去3回は実行日から相対で作り、PCS-2 回路2が25→18→12MΩと低下している', () => {
    const past = demoInspections.filter(inspection => inspection.status === '完了')
    expect(past.map(inspection => inspection.scheduledOn.slice(0, 4))).toEqual(['2023', '2024', '2025'])
    expect(past.map(inspection => inspection.measurements.find(entry => entry.key === dcKey)!.raw)).toEqual(['25', '18', '12'])
    expect(past.flatMap(inspection => inspection.measurements).every(entry => entry.judgement === '適合')).toBe(true)
  })
  it('前回はアレイB周辺の雑草を指摘し、除草の修繕案件は完了済み', () => {
    const last = demoInspections.filter(inspection => inspection.status === '完了').at(-1)!
    expect(last.visual.find(entry => entry.itemId === '1-4')!.result).toBe('×')
    expect(seed.repairCases.find(item => item.siteId === demoSiteId)).toMatchObject({ status: '完了', inspectionId: last.inspectionId, customerDecision: 'その他（作業実施）' })
  })
  it('全発電所に今月の点検がある。報告書チェック待ちは未完了で、完了済みの点検だけ1年後の予定がある', () => {
    for (const site of seed.sites) {
      const thisMonth = seed.inspections.filter(inspection => inspection.siteId === site.siteId && inspection.scheduledOn.startsWith('2026-10'))
      expect(thisMonth).toHaveLength(1)
      const pending = seed.reportReviews.some(review => review.inspection.inspectionId === thisMonth[0].inspectionId && review.status === 'チェック待ち')
      if (pending) {
        expect(thisMonth[0].status).toBe('報告書作成済み')
        expect(seed.inspections.some(inspection => inspection.siteId === site.siteId && inspection.scheduledOn.startsWith('2027-10') && inspection.status === '未依頼')).toBe(false)
      } else if (thisMonth[0].scheduledOn < '2026-10-28') {
        expect(thisMonth[0].status).toBe('完了')
        expect(seed.inspections.some(inspection => inspection.siteId === site.siteId && inspection.scheduledOn.startsWith('2027-10') && inspection.status === '未依頼')).toBe(true)
      } else expect(thisMonth[0].status).toBe('未依頼')
    }
    expect(demoInspections.at(-1)).toMatchObject({ scheduledOn: '2026-10-28', status: '未依頼' })
  })
  it('同じ日付からは同じシードになる', () => {
    expect(createSeed(now)).toEqual(seed)
  })
  it('月初・月末・うるう日でも日付が今月の範囲に収まる', () => {
    for (const date of [new Date(2027, 0, 1), new Date(2027, 0, 31), new Date(2028, 1, 29)]) {
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const state = createSeed(date)
      for (const site of state.sites) expect(state.inspections.filter(inspection => inspection.siteId === site.siteId && inspection.scheduledOn.startsWith(month))).toHaveLength(1)
    }
  })
})

describe('デモシナリオとご提案文', () => {
  const current = { ...demoInspections.at(-1)!, measurements: buildMeasurementEntries(demoSite) }
  const previous = demoInspections.at(-2)!
  const filled = applyScenario(current, demoSite, previous)

  it('PCS-2 回路2のDC絶縁抵抗が0.3MΩで不適合、それ以外の測定はすべて適合', () => {
    const target = filled.measurements.find(entry => entry.key === dcKey)!
    expect(target).toMatchObject({ raw: '0.3', judgement: '不適合' })
    expect(target.reason).toMatch(/^基準0\.4MΩ以上（開放電圧3\d\dV＞300V）に対し0\.3MΩ$/)
    expect(filled.measurements.filter(entry => entry.key !== dcKey).every(entry => entry.judgement === '適合')).toBe(true)
  })
  it('アレイB 1段目5列目のモジュール破損が目視×、他の目視は○', () => {
    expect(filled.visual.filter(entry => entry.result === '×').map(entry => entry.itemId)).toEqual(['2-2'])
    expect(filled.visual.every(entry => entry.result !== null)).toBe(true)
    expect(filled.findings.find(finding => finding.refKey === '2-2')).toMatchObject({ arrayId: 'B', panels: [{ row: 1, col: 5 }], circuitId: 'PCS-2/回路2' })
  })
  it('割れパネルはPCS-2 回路2が担当する段にある', () => {
    expect(circuitForPanel(demoSite, scenarioPanel.arrayId, scenarioPanel.row)?.circuitId).toBe(scenarioCircuitId)
    expect(scenarioCircuitId).toBe('PCS-2/回路2')
  })
  it.each([['0.35', '不適合'], ['85', '適合']])('手入力済みの絶縁抵抗 %sMΩ を残し、空欄だけ補完する', (raw, judgement) => {
    const typed = { ...current, measurements: current.measurements.map(entry => entry.key === '接地抵抗_架台' ? { ...entry, raw: '42' } : entry.key === dcKey ? { ...entry, raw } : entry) }
    const result = applyScenario(typed, demoSite, previous)
    expect(result.measurements.find(entry => entry.key === '接地抵抗_架台')!.raw).toBe('42')
    expect(result.measurements.find(entry => entry.key === dcKey)).toMatchObject({ raw, judgement })
    expect(result.measurements.every(entry => entry.raw.trim())).toBe(true)
    expect(result.findings.some(finding => finding.refKey === dcKey)).toBe(false)
  })
  it('ご提案文は割れと絶縁低下を1本にまとめる（交換→再測定）', () => {
    expect(buildProposals(filled, demoSite, previous)).toEqual([
      'アレイB 1段目5列目のモジュールに割れを確認しました。同じ回路（PCS-2 回路2）の絶縁抵抗も0.3MΩ（基準0.4MΩ以上）に低下しており、割れた箇所からの浸水が原因と考えられます。該当モジュールの交換と、交換後の絶縁抵抗の再測定をご提案します。',
    ])
  })
})
