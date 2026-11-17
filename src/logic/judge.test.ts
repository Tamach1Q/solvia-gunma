import { describe, expect, it } from 'vitest'
import { rainCaution } from '../config/thresholds'
import type { MeasurementEntry, Site } from '../types'
import { buildMeasurementEntries, judgeAcInsulation, judgeDcInsulation, judgeGridVoltage, judgeGrounding, judgeMeasurements, judgeOpenVoltage, measurementKey, parseMeasurement } from './judge'

const site: Site = {
  siteId: 'T-01', name: 'テスト発電所', area: '渋川市', address: '', capacityKw: 49.5, gridConnectedOn: '2020-01-01', owner: '', monitoringSystem: '',
  module: { model: 'M', vocPerModule: 44, pmaxW: 330, count: 18 },
  pcs: [{ pcsId: 'PCS-1', maker: '', model: '', ratedKw: 5.5, gridType: '単相3線', circuits: [{ circuitId: 'PCS-1/回路1', seriesCount: 9, arrayId: 'A', rows: [1] }, { circuitId: 'PCS-1/回路2', seriesCount: 9, arrayId: 'A', rows: [2] }] }],
  arrays: [{ arrayId: 'A', label: 'アレイA', rows: 2, cols: 9 }], groundingClass: 'D', groundingRelaxed: false,
}

describe('parseMeasurement', () => {
  it('∞と>N（全角含む）を上限超えとして読む', () => {
    expect(parseMeasurement('∞')).toEqual({ value: null, overRange: true, status: 'ok' })
    expect(parseMeasurement('>2000')).toEqual({ value: 2000, overRange: true, status: 'ok' })
    expect(parseMeasurement('＞２０００')).toEqual({ value: 2000, overRange: true, status: 'ok' })
    expect(parseMeasurement(' 0.3 ')).toEqual({ value: 0.3, overRange: false, status: 'ok' })
  })
  it('空欄と読めない値を区別する', () => {
    expect(parseMeasurement('').status).toBe('empty')
    expect(parseMeasurement('abc').status).toBe('invalid')
    expect(parseMeasurement('1.2.3').status).toBe('invalid')
  })
})

describe('DC絶縁抵抗', () => {
  it('開放電圧300V超は0.4MΩちょうどで適合、未満で不適合', () => {
    expect(judgeDcInsulation('0.4', { openVoltageV: 396 }).judgement).toBe('適合')
    expect(judgeDcInsulation('0.39', { openVoltageV: 396 }).judgement).toBe('不適合')
  })
  it('開放電圧300Vちょうどは0.2MΩ基準、301Vは0.4MΩ基準', () => {
    expect(judgeDcInsulation('0.2', { openVoltageV: 300 }).judgement).toBe('適合')
    expect(judgeDcInsulation('0.19', { openVoltageV: 300 }).judgement).toBe('不適合')
    expect(judgeDcInsulation('0.3', { openVoltageV: 301 }).judgement).toBe('不適合')
  })
  it('判定理由に基準と開放電圧を書く', () => {
    expect(judgeDcInsulation('0.3', { openVoltageV: 396 }).reason).toBe('基準0.4MΩ以上（開放電圧396V＞300V）に対し0.3MΩ')
  })
  it('∞・>N表記は上限超えとして適合', () => {
    expect(judgeDcInsulation('∞', { openVoltageV: 396 }).judgement).toBe('適合')
    const over = judgeDcInsulation('>2000', { openVoltageV: 396, previousMOhm: 50000 })
    expect(over.judgement).toBe('適合')
    expect(over.reason).toContain('>2,000MΩ')
  })
  it('前回値の50%ちょうどは適合、50%未満は要確認', () => {
    expect(judgeDcInsulation('10', { openVoltageV: 396, previousMOhm: 20 }).judgement).toBe('適合')
    const drop = judgeDcInsulation('9.9', { openVoltageV: 396, previousMOhm: 20 })
    expect(drop.judgement).toBe('要確認')
    expect(drop.reason).toContain('前回20MΩ')
  })
  it('直列数が同じ他回路の中央値の1/10ちょうどは適合、未満は要確認', () => {
    expect(judgeDcInsulation('6', { openVoltageV: 396, peerMedianMOhm: 60 }).judgement).toBe('適合')
    expect(judgeDcInsulation('5.9', { openVoltageV: 396, peerMedianMOhm: 60 }).judgement).toBe('要確認')
  })
  it('基準未満は前回比より優先して不適合', () => {
    expect(judgeDcInsulation('0.3', { openVoltageV: 396, previousMOhm: 12, peerMedianMOhm: 80 }).judgement).toBe('不適合')
  })
})

describe('AC絶縁抵抗', () => {
  it('1MΩ以上で適合', () => {
    expect(judgeAcInsulation('1').judgement).toBe('適合')
    expect(judgeAcInsulation('0.99').judgement).toBe('不適合')
    expect(judgeAcInsulation('∞').judgement).toBe('適合')
  })
})

describe('開放電圧', () => {
  it('中央値から±5%以内は適合、±5%超は要確認、±10%超は不適合', () => {
    expect(judgeOpenVoltage('420', 400).judgement).toBe('適合')
    expect(judgeOpenVoltage('380', 400).judgement).toBe('適合')
    expect(judgeOpenVoltage('421', 400).judgement).toBe('要確認')
    expect(judgeOpenVoltage('440', 400).judgement).toBe('要確認')
    expect(judgeOpenVoltage('360', 400).judgement).toBe('要確認')
    expect(judgeOpenVoltage('441', 400).judgement).toBe('不適合')
    expect(judgeOpenVoltage('359', 400).judgement).toBe('不適合')
  })
  it('判定理由に中央値と偏差を書く', () => {
    expect(judgeOpenVoltage('380', 400).reason).toBe('直列数が同じ回路の中央値400Vに対し380V（−5%）')
  })
})

describe('系統電圧', () => {
  it('単相3線は101±6V', () => {
    expect(judgeGridVoltage('95', '単相3線').judgement).toBe('適合')
    expect(judgeGridVoltage('107', '単相3線').judgement).toBe('適合')
    expect(judgeGridVoltage('94.9', '単相3線').judgement).toBe('不適合')
    expect(judgeGridVoltage('107.1', '単相3線').judgement).toBe('不適合')
  })
  it('三相3線は202±20V', () => {
    expect(judgeGridVoltage('182', '三相3線').judgement).toBe('適合')
    expect(judgeGridVoltage('222', '三相3線').judgement).toBe('適合')
    expect(judgeGridVoltage('223', '三相3線').judgement).toBe('不適合')
  })
})

describe('接地抵抗', () => {
  it('D種は100Ω以下、緩和要件なら500Ω以下、C種は10Ω以下', () => {
    expect(judgeGrounding('100', site).judgement).toBe('適合')
    expect(judgeGrounding('101', site).judgement).toBe('不適合')
    expect(judgeGrounding('500', { groundingClass: 'D', groundingRelaxed: true }).judgement).toBe('適合')
    expect(judgeGrounding('501', { groundingClass: 'D', groundingRelaxed: true }).judgement).toBe('不適合')
    expect(judgeGrounding('10', { groundingClass: 'C', groundingRelaxed: false }).judgement).toBe('適合')
    expect(judgeGrounding('11', { groundingClass: 'C', groundingRelaxed: false }).judgement).toBe('不適合')
  })
  it('雨上がりは判定に関係なく注意を付ける', () => {
    expect(judgeGrounding('30', site, '雨上がり')).toMatchObject({ judgement: '適合', caution: rainCaution })
    expect(judgeGrounding('300', site, '雨上がり')).toMatchObject({ judgement: '不適合', caution: rainCaution })
    expect(judgeGrounding('', site, '雨上がり')).toMatchObject({ judgement: '未入力', caution: rainCaution })
    expect(judgeGrounding('30', site, '晴れ').caution).toBeUndefined()
    expect(judgeGrounding('30', site, '雨').caution).toBeUndefined()
  })
})

describe('未入力', () => {
  it('空欄と読めない値は未入力', () => {
    expect(judgeDcInsulation('', { openVoltageV: 396 })).toMatchObject({ judgement: '未入力', reason: '' })
    expect(judgeAcInsulation('abc')).toMatchObject({ judgement: '未入力', reason: '数値として読み取れません' })
  })
})

describe('judgeMeasurements', () => {
  const withRaws = (raws: Record<string, string>): MeasurementEntry[] => buildMeasurementEntries(site).map(entry => ({ ...entry, raw: raws[entry.key] ?? '' }))
  const dc1 = measurementKey('DC絶縁抵抗', 'PCS-1', 'PCS-1/回路1')
  const voc1 = measurementKey('DC開放電圧', 'PCS-1', 'PCS-1/回路1')
  const voc2 = measurementKey('DC開放電圧', 'PCS-1', 'PCS-1/回路2')

  it('発電所の構成から測定欄を作る', () => {
    expect(buildMeasurementEntries(site).map(entry => entry.key)).toEqual([
      voc1, dc1, voc2, measurementKey('DC絶縁抵抗', 'PCS-1', 'PCS-1/回路2'),
      'AC絶縁抵抗:PCS-1', '系統電圧UO:PCS-1', '系統電圧WO:PCS-1', '接地抵抗_PCS:PCS-1', '接地抵抗_架台',
    ])
  })
  it('DC絶縁抵抗の基準は実測の開放電圧を優先し、なければ公称値（直列数×Voc）を使う', () => {
    const nominal = judgeMeasurements(withRaws({ [dc1]: '0.3' }), site).find(entry => entry.key === dc1)!
    expect(nominal.reason).toBe('基準0.4MΩ以上（開放電圧396V・公称＞300V）に対し0.3MΩ')
    const measured = judgeMeasurements(withRaws({ [dc1]: '0.3', [voc1]: '290', [voc2]: '292' }), site).find(entry => entry.key === dc1)!
    expect(measured.judgement).toBe('適合')
  })
  it('前回の同じ欄と比べる', () => {
    const previous = judgeMeasurements(withRaws({ [dc1]: '25' }), site)
    expect(judgeMeasurements(withRaws({ [dc1]: '12' }), site, '晴れ', previous).find(entry => entry.key === dc1)!.judgement).toBe('要確認')
  })
  it('雨上がりは接地抵抗の欄だけに注意を付ける', () => {
    const judged = judgeMeasurements(withRaws({ [dc1]: '80', '接地抵抗_架台': '30' }), site, '雨上がり')
    expect(judged.find(entry => entry.key === '接地抵抗_架台')!.caution).toBe(rainCaution)
    expect(judged.find(entry => entry.key === dc1)!.caution).toBeUndefined()
  })
})

describe('比較の母集団は発電所内で直列数が同じ全回路', () => {
  // PCS 3台×2回路、全回路9直列。PCS内だけで比べると、相方の回路まで外れ値に引っ張られる構成。
  const sixCircuits: Site = {
    ...site, module: { ...site.module, count: 54 },
    arrays: [{ arrayId: 'A', label: 'アレイA', rows: 3, cols: 9 }, { arrayId: 'B', label: 'アレイB', rows: 3, cols: 9 }],
    pcs: [1, 2, 3].map(pcsNumber => ({ pcsId: `PCS-${pcsNumber}`, maker: '', model: '', ratedKw: 5.5, gridType: '単相3線' as const, circuits: [1, 2].map(number => ({ circuitId: `PCS-${pcsNumber}/回路${number}`, seriesCount: 9, arrayId: pcsNumber * 2 + number - 2 <= 3 ? 'A' : 'B', rows: [((pcsNumber * 2 + number - 3) % 3) + 1] })) })),
  }
  const raws = (kind: 'DC開放電圧' | 'DC絶縁抵抗', values: string[]) => Object.fromEntries(values.map((value, index) => [measurementKey(kind, `PCS-${Math.floor(index / 2) + 1}`, `PCS-${Math.floor(index / 2) + 1}/回路${index % 2 + 1}`), value]))
  const judged = (values: Record<string, string>) => judgeMeasurements(buildMeasurementEntries(sixCircuits).map(entry => ({ ...entry, raw: values[entry.key] ?? '' })), sixCircuits)

  it('1回路だけ−11%なら、その回路だけが不適合になり、同じPCSの相方は適合のまま', () => {
    const result = judged(raws('DC開放電圧', ['390', '391', '389', '347', '392', '390'])).filter(entry => entry.kind === 'DC開放電圧')
    expect(result.map(entry => entry.judgement)).toEqual(['適合', '適合', '適合', '不適合', '適合', '適合'])
    expect(result[3].reason).toBe('直列数が同じ回路の中央値390Vに対し347V（−11%）')
  })
  it('DC絶縁抵抗の1/10判定もPCSをまたいで比べる', () => {
    const result = judged(raws('DC絶縁抵抗', ['80', '75', '90', '6', '85', '70'])).filter(entry => entry.kind === 'DC絶縁抵抗')
    expect(result.map(entry => entry.judgement)).toEqual(['適合', '適合', '適合', '要確認', '適合', '適合'])
    expect(result[3].reason).toBe('基準内だが直列数が同じ他回路の中央値80MΩの1/10未満（6MΩ）')
  })
  it('直列数が違う回路とは比べない', () => {
    const mixed: Site = { ...sixCircuits, pcs: sixCircuits.pcs.map(pcs => pcs.pcsId === 'PCS-3' ? { ...pcs, circuits: pcs.circuits.map(circuit => ({ ...circuit, seriesCount: 8 })) } : pcs) }
    const values = raws('DC開放電圧', ['390', '391', '389', '392', '347', '346'])
    const result = judgeMeasurements(buildMeasurementEntries(mixed).map(entry => ({ ...entry, raw: values[entry.key] ?? '' })), mixed).filter(entry => entry.kind === 'DC開放電圧')
    expect(result.map(entry => entry.judgement)).toEqual(['適合', '適合', '適合', '適合', '適合', '適合'])
  })
})
