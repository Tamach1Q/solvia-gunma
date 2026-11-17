import { rainCaution, thresholds } from '../config/thresholds'
import type { Inspection, Judgement, MeasurementEntry, MeasurementKind, Pcs, Site, Weather } from '../types'
import { formatNumber } from './format'
import { findCircuit } from './site'

export type Parsed = { value: number | null; overRange: boolean; status: 'empty' | 'invalid' | 'ok' }
export type JudgeResult = { value: number | null; judgement: Judgement; reason: string; caution?: string }

const toHalfWidth = (text: string) => text.replace(/[０-９．＞]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))

// 絶縁抵抗計の「∞」「>2000」表記は上限超えとして扱う。>Nは数値Nを残し、∞はnull。
export function parseMeasurement(raw: string): Parsed {
  const text = toHalfWidth(raw).replace(/\s/g, '')
  if (!text) return { value: null, overRange: false, status: 'empty' }
  if (text === '∞') return { value: null, overRange: true, status: 'ok' }
  const match = text.match(/^(>)?(\d+(?:\.\d+)?|\.\d+)$/)
  if (!match) return { value: null, overRange: false, status: 'invalid' }
  return { value: Number(match[2]), overRange: Boolean(match[1]), status: 'ok' }
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const notEntered = (parsed: Parsed): JudgeResult | null => parsed.status === 'empty' ? { value: null, judgement: '未入力', reason: '' } : parsed.status === 'invalid' ? { value: null, judgement: '未入力', reason: '数値として読み取れません' } : null
const overRangeLabel = (parsed: Parsed, unit: string) => parsed.value === null ? '∞' : `>${formatNumber(parsed.value)}${unit}`
// 浮動小数の誤差で境界値（ちょうど5%など）の判定がぶれないよう丸める
const ratio = (value: number) => Math.round(value * 1e9) / 1e9

export function dcInsulationMin(openVoltageV: number) {
  const rule = thresholds.dcInsulation
  return openVoltageV > rule.highVoltageBoundaryV ? rule.minMOhmAboveBoundary : rule.minMOhmAtOrBelowBoundary
}

export function judgeDcInsulation(raw: string, context: { openVoltageV: number; nominalVoltage?: boolean; previousMOhm?: number | null; peerMedianMOhm?: number | null }): JudgeResult {
  const parsed = parseMeasurement(raw)
  const empty = notEntered(parsed)
  if (empty) return empty
  const rule = thresholds.dcInsulation
  const min = dcInsulationMin(context.openVoltageV)
  const basis = `基準${formatNumber(min)}MΩ以上（開放電圧${formatNumber(context.openVoltageV)}V${context.nominalVoltage ? '・公称' : ''}${context.openVoltageV > rule.highVoltageBoundaryV ? '＞' : '≦'}${rule.highVoltageBoundaryV}V）`
  if (parsed.overRange) return { value: parsed.value, judgement: '適合', reason: `${basis}に対し測定上限超え（${overRangeLabel(parsed, 'MΩ')}）` }
  const value = parsed.value!
  if (value < min) return { value, judgement: '不適合', reason: `${basis}に対し${formatNumber(value)}MΩ` }
  const previous = context.previousMOhm
  if (previous && value < previous * rule.dropFromPreviousRatio) return { value, judgement: '要確認', reason: `基準内だが前回${formatNumber(previous)}MΩから${formatNumber(value)}MΩへ低下（前回比${Math.round(value / previous * 100)}%）` }
  const peer = context.peerMedianMOhm
  if (peer && value < peer * rule.belowPeerMedianRatio) return { value, judgement: '要確認', reason: `基準内だが直列数が同じ他回路の中央値${formatNumber(peer)}MΩの1/10未満（${formatNumber(value)}MΩ）` }
  return { value, judgement: '適合', reason: `${basis}に対し${formatNumber(value)}MΩ` }
}

export function judgeAcInsulation(raw: string): JudgeResult {
  const parsed = parseMeasurement(raw)
  const empty = notEntered(parsed)
  if (empty) return empty
  const min = thresholds.acInsulation.minMOhm
  if (parsed.overRange) return { value: parsed.value, judgement: '適合', reason: `基準${min}MΩ以上に対し測定上限超え（${overRangeLabel(parsed, 'MΩ')}）` }
  const value = parsed.value!
  return { value, judgement: value >= min ? '適合' : '不適合', reason: `基準${min}MΩ以上に対し${formatNumber(value)}MΩ` }
}

export function judgeOpenVoltage(raw: string, peerMedianV: number | null): JudgeResult {
  const parsed = parseMeasurement(raw)
  const empty = notEntered(parsed)
  if (empty) return empty
  if (parsed.value === null || parsed.overRange) return { value: null, judgement: '未入力', reason: '数値として読み取れません' }
  const value = parsed.value
  if (!peerMedianV) return { value, judgement: '適合', reason: `直列数が同じ回路がほかにありません（${formatNumber(value)}V）` }
  const rule = thresholds.openVoltage
  const deviation = ratio(Math.abs(value - peerMedianV) / peerMedianV)
  const signed = `${value >= peerMedianV ? '+' : '−'}${formatNumber(Math.round(deviation * 1000) / 10)}%`
  const reason = `直列数が同じ回路の中央値${formatNumber(peerMedianV)}Vに対し${formatNumber(value)}V（${signed}）`
  return { value, judgement: deviation > rule.failDeviation ? '不適合' : deviation > rule.cautionDeviation ? '要確認' : '適合', reason }
}

export function judgeGridVoltage(raw: string, gridType: Pcs['gridType']): JudgeResult {
  const parsed = parseMeasurement(raw)
  const empty = notEntered(parsed)
  if (empty) return empty
  if (parsed.value === null || parsed.overRange) return { value: null, judgement: '未入力', reason: '数値として読み取れません' }
  const { nominalV, toleranceV } = thresholds.gridVoltage[gridType]
  const value = parsed.value
  const inRange = value >= nominalV - toleranceV && value <= nominalV + toleranceV
  return { value, judgement: inRange ? '適合' : '不適合', reason: `基準${nominalV}±${toleranceV}V（${nominalV - toleranceV}〜${nominalV + toleranceV}V）に対し${formatNumber(value)}V` }
}

export function groundingMax(site: Pick<Site, 'groundingClass' | 'groundingRelaxed'>) {
  return site.groundingClass === 'C' ? thresholds.grounding.C.maxOhm : site.groundingRelaxed ? thresholds.grounding.D.relaxedMaxOhm : thresholds.grounding.D.maxOhm
}

export function judgeGrounding(raw: string, site: Pick<Site, 'groundingClass' | 'groundingRelaxed'>, weather?: Weather): JudgeResult {
  const caution = weather === '雨上がり' ? rainCaution : undefined
  const parsed = parseMeasurement(raw)
  const empty = notEntered(parsed)
  if (empty) return { ...empty, caution }
  if (parsed.value === null || parsed.overRange) return { value: null, judgement: '不適合', reason: `基準${groundingMax(site)}Ω以下に対し測定上限超え`, caution }
  const max = groundingMax(site)
  const value = parsed.value
  const label = `${site.groundingClass}種${site.groundingClass === 'D' && site.groundingRelaxed ? '・緩和要件' : ''}`
  return { value, judgement: value <= max ? '適合' : '不適合', reason: `基準${max}Ω以下（${label}）に対し${formatNumber(value)}Ω`, caution }
}

export const measurementKey = (kind: MeasurementKind, pcsId?: string, circuitId?: string) => [kind, pcsId, circuitId].filter(Boolean).join(':')

// 発電所の構成から、測定欄（未入力）を並べる。回路ごと→PCSごと→発電所全体の順。
export function buildMeasurementEntries(site: Site): MeasurementEntry[] {
  const entry = (kind: MeasurementKind, pcsId?: string, circuitId?: string): MeasurementEntry => ({ key: measurementKey(kind, pcsId, circuitId), kind, pcsId, circuitId, raw: '', value: null, judgement: '未入力', reason: '' })
  return [
    ...site.pcs.flatMap(pcs => [
      ...pcs.circuits.flatMap(circuit => [entry('DC開放電圧', pcs.pcsId, circuit.circuitId), entry('DC絶縁抵抗', pcs.pcsId, circuit.circuitId)]),
      entry('AC絶縁抵抗', pcs.pcsId), entry('系統電圧UO', pcs.pcsId), entry('系統電圧WO', pcs.pcsId), entry('接地抵抗_PCS', pcs.pcsId),
    ]),
    entry('接地抵抗_架台'),
  ]
}

const finite = (entry: MeasurementEntry | undefined) => {
  if (!entry) return null
  const parsed = parseMeasurement(entry.raw)
  return parsed.status === 'ok' && !parsed.overRange ? parsed.value : null
}

// DC絶縁抵抗の基準を決める開放電圧。同じ回路の実測値があればそれを、なければ直列数×モジュールVocの公称値を使う。
export function circuitOpenVoltage(entries: MeasurementEntry[], site: Site, pcsId?: string, circuitId?: string) {
  const measured = finite(entries.find(item => item.key === measurementKey('DC開放電圧', pcsId, circuitId)))
  if (measured !== null) return { voltage: measured, nominal: false }
  const circuit = findCircuit(site, circuitId)
  return { voltage: (circuit?.seriesCount ?? 0) * site.module.vocPerModule, nominal: true }
}

// 入力値（raw）から全測定値の判定をやり直す。開放電圧や他回路の値に依存する判定があるため、1欄の変更でも全体を再計算する。
export function judgeMeasurements(entries: MeasurementEntry[], site: Site, weather?: Weather, previous?: MeasurementEntry[]): MeasurementEntry[] {
  // 比べる相手は発電所内で直列数が同じ全回路（PCSをまたぐ）。1PCSあたりの回路が少なくても中央値が外れ値に引っ張られない。
  const seriesOf = (entry: MeasurementEntry) => findCircuit(site, entry.circuitId)?.seriesCount
  const values = (kind: MeasurementKind, series: number | undefined, exceptKey?: string) => entries.filter(entry => entry.kind === kind && seriesOf(entry) === series && entry.key !== exceptKey).map(finite).filter((value): value is number => value !== null)
  return entries.map(entry => {
    const pcs = site.pcs.find(item => item.pcsId === entry.pcsId)
    let result: JudgeResult
    if (entry.kind === 'DC絶縁抵抗') {
      const openVoltage = circuitOpenVoltage(entries, site, entry.pcsId, entry.circuitId)
      result = judgeDcInsulation(entry.raw, { openVoltageV: openVoltage.voltage, nominalVoltage: openVoltage.nominal, previousMOhm: finite(previous?.find(item => item.key === entry.key)), peerMedianMOhm: median(values('DC絶縁抵抗', seriesOf(entry), entry.key)) })
    } else if (entry.kind === 'DC開放電圧') result = judgeOpenVoltage(entry.raw, median(values('DC開放電圧', seriesOf(entry))))
    else if (entry.kind === 'AC絶縁抵抗') result = judgeAcInsulation(entry.raw)
    else if (entry.kind === '系統電圧UO' || entry.kind === '系統電圧WO') result = judgeGridVoltage(entry.raw, pcs?.gridType ?? '単相3線')
    else result = judgeGrounding(entry.raw, site, weather)
    const { caution, ...rest } = result
    const next: MeasurementEntry = { ...entry, ...rest }
    if (caution) next.caution = caution
    else delete next.caution
    return next
  })
}

export const judgeInspection = (inspection: Inspection, site: Site, previous?: Inspection): Inspection => ({ ...inspection, measurements: judgeMeasurements(inspection.measurements, site, inspection.weather, previous?.measurements) })
