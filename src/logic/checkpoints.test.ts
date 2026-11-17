import { describe, expect, it } from 'vitest'
import { createSeed, demoSiteId } from '../mock/seed'
import type { Inspection } from '../types'
import { buildCheckpoints, decliningRun } from './checkpoints'
import { pastInspections } from './history'
import { judgeMeasurements, measurementKey } from './judge'

const seed = createSeed(new Date(2026, 9, 28))
const siteOf = (siteId: string) => seed.sites.find(site => site.siteId === siteId)!
const currentOf = (siteId: string) => seed.inspections.find(inspection => inspection.siteId === siteId && inspection.scheduledOn.startsWith('2026-10'))!
const checkpointsOf = (siteId: string) => buildCheckpoints(siteOf(siteId), pastInspections(seed.inspections, currentOf(siteId)), seed.repairCases)
const dcKey = measurementKey('DC絶縁抵抗', 'PCS-2', 'PCS-2/回路2')

describe('decliningRun', () => {
  it('直近から遡って連続して下がっている区間を返す', () => {
    expect(decliningRun([25, 18, 12])).toEqual([25, 18, 12])
    expect(decliningRun([30, 40, 25, 18])).toEqual([40, 25, 18])
    expect(decliningRun([25, 18, 18])).toEqual([18])
    expect(decliningRun([25, null, 18, 12])).toEqual([18, 12])
  })
})

describe('今回の確認ポイント', () => {
  it('デモ対象：PCS-2 回路2が3回連続で低下（初回比−52%）', () => {
    expect(checkpointsOf(demoSiteId).find(point => point.kind === 'trend')).toMatchObject({
      target: 'PCS-2 回路2 絶縁抵抗（DC）', label: '前回値が低下傾向', reason: '3回連続で低下（25→18→12MΩ、初回比−52%）：推移を確認', refKey: dcKey,
    })
  })
  it('デモ対象：前回指摘（雑草）は重点確認、除草は完了済みなので未対応の修繕には出ない', () => {
    const points = checkpointsOf(demoSiteId)
    expect(points.filter(point => point.kind === 'previousFinding').map(point => point.target)).toEqual(['周囲の状況（雑草・影・鳥の巣）'])
    expect(points.some(point => point.kind === 'openRepair')).toBe(false)
    expect(points.filter(point => point.kind === 'trend')).toHaveLength(1)
    expect(points.some(point => point.kind === 'nearThreshold')).toBe(false)
  })
  it('前回の絶縁抵抗が基準の3倍未満の回路（沼田市 第2：1.1MΩ）', () => {
    expect(checkpointsOf('S-08').find(point => point.kind === 'nearThreshold')).toMatchObject({ target: 'PCS-1 回路1 絶縁抵抗（DC）', label: '前回値が基準に近い：推移を確認', reason: '前回1.1MΩ（基準0.4MΩ以上の3倍未満）' })
  })
  it('筋書きにない確認ポイントは出ない（乱数で低下傾向などができない）', () => {
    const summary = seed.sites.map(site => [site.siteId, checkpointsOf(site.siteId).map(point => `${point.kind}:${point.target}`)])
    expect(Object.fromEntries(summary)).toEqual({
      'S-01': [], 'S-02': [], 'S-04': [], 'S-05': [], 'S-06': [],
      'S-03': ['trend:PCS-2 回路2 絶縁抵抗（DC）', 'previousFinding:周囲の状況（雑草・影・鳥の巣）'],
      'S-07': ['previousFinding:避雷素子（SPD）の劣化', 'openRepair:接続箱2 SPD交換'],
      'S-08': ['nearThreshold:PCS-1 回路1 絶縁抵抗（DC）'],
    })
  })
  it('前回から未完了の修繕案件（伊勢崎市 第1：SPD交換）', () => {
    expect(checkpointsOf('S-07').find(point => point.kind === 'openRepair')).toMatchObject({ target: '接続箱2 SPD交換', label: '未対応の修繕あり' })
  })

  describe('低下傾向のしきい値', () => {
    const site = siteOf(demoSiteId)
    const past = pastInspections(seed.inspections, currentOf(demoSiteId))
    const withValues = (values: string[]): Inspection[] => past.slice(-values.length).map((inspection, index) => ({ ...inspection, visual: inspection.visual.map(entry => ({ ...entry, result: '○' })), measurements: judgeMeasurements(inspection.measurements.map(entry => entry.key === dcKey ? { ...entry, raw: values[index] } : entry), site) }))
    const trend = (values: string[]) => buildCheckpoints(site, withValues(values), []).filter(point => point.kind === 'trend')

    it('1回下がっただけ（2回分）は拾わない', () => {
      expect(trend(['25', '12'])).toEqual([])
    })
    it('3回連続でも初回比30%未満は拾わない', () => {
      expect(trend(['25', '22', '18'])).toEqual([])
    })
    it('初回比ちょうど30%は拾う', () => {
      expect(trend(['10', '8', '7'])[0]?.reason).toBe('3回連続で低下（10→8→7MΩ、初回比−30%）：推移を確認')
    })
    it('途中で上がっていれば、連続した区間だけで判断する', () => {
      expect(trend(['25', '30', '18'])).toEqual([])
    })
  })
})
