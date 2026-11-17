import { checkpointRules } from '../config/thresholds'
import { visualItems } from '../config/visualItems'
import type { Inspection, RepairCase, Site } from '../types'
import { formatDate, formatNumber } from './format'
import { circuitOpenVoltage, dcInsulationMin, parseMeasurement } from './judge'
import { measurementTitle } from './labels'

export type CheckpointKind = 'trend' | 'nearThreshold' | 'previousFinding' | 'openRepair'
export interface Checkpoint { key: string; kind: CheckpointKind; target: string; label: string; reason: string; refKey?: string }

const finiteValue = (raw: string | undefined) => {
  if (raw === undefined) return null
  const parsed = parseMeasurement(raw)
  return parsed.status === 'ok' && !parsed.overRange ? parsed.value : null
}

// 直近から遡って、連続して低下している区間（古い順）。値が読めない回で途切れる。
export function decliningRun(values: (number | null)[]) {
  const run: number[] = []
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (value === null || (run.length && value <= run[0])) break
    run.unshift(value)
  }
  return run
}

// 点検準備の「今回の確認ポイント」（SDD 4.2）。どのルールで出たかを必ず理由として添える。
export function buildCheckpoints(site: Site, history: Inspection[], repairCases: RepairCase[]): Checkpoint[] {
  const previous = history.at(-1)
  const points: Checkpoint[] = []
  if (previous) {
    for (const entry of previous.measurements.filter(item => item.kind === 'DC絶縁抵抗')) {
      const values = history.map(inspection => finiteValue(inspection.measurements.find(item => item.key === entry.key)?.raw))
      const run = decliningRun(values)
      const first = run[0]
      const last = run.at(-1)!
      // 浮動小数の誤差で「ちょうど30%」がこぼれないよう丸めて比べる
      if (run.length >= checkpointRules.trendMinInspections && Math.round((first - last) / first * 1e9) / 1e9 >= checkpointRules.trendMinDropRatio) {
        points.push({ key: `trend:${entry.key}`, kind: 'trend', target: measurementTitle(entry), label: '前回値が低下傾向', reason: `${run.length}回連続で低下（${run.map(value => formatNumber(value)).join('→')}MΩ、初回比−${Math.round((first - last) / first * 100)}%）：推移を確認`, refKey: entry.key })
      }
      const value = finiteValue(entry.raw)
      const min = dcInsulationMin(circuitOpenVoltage(previous.measurements, site, entry.pcsId, entry.circuitId).voltage)
      if (value !== null && value < min * checkpointRules.nearThresholdFactor) {
        points.push({ key: `near:${entry.key}`, kind: 'nearThreshold', target: measurementTitle(entry), label: '前回値が基準に近い：推移を確認', reason: `前回${formatNumber(value)}MΩ（基準${formatNumber(min)}MΩ以上の${checkpointRules.nearThresholdFactor}倍未満）`, refKey: entry.key })
      }
    }
    for (const entry of previous.visual.filter(item => item.result === '×')) {
      const item = visualItems.find(definition => definition.itemId === entry.itemId)
      points.push({ key: `visual:${entry.itemId}`, kind: 'previousFinding', target: item?.title ?? entry.itemId, label: '前回指摘あり：重点確認', reason: `${formatDate(previous.inspectedOn ?? previous.scheduledOn)}の点検で指摘${entry.comment ? `（${entry.comment}）` : ''}`, refKey: entry.itemId })
    }
  }
  for (const repair of repairCases.filter(item => item.siteId === site.siteId && item.status !== '完了')) {
    points.push({ key: `repair:${repair.caseId}`, kind: 'openRepair', target: repair.title, label: '未対応の修繕あり', reason: `修繕案件が「${repair.status}」のまま${repair.customerDecision ? `（お客様回答：${repair.customerDecision}${repair.decidedOn ? `、${formatDate(repair.decidedOn)}` : ''}）` : ''}` })
  }
  return points
}
