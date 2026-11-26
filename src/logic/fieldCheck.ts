import { visualItems } from '../config/visualItems'
import type { Finding, MeasurementEntry, VisualEntry, Weather } from '../types'
import { measurementTitle } from './labels'

export type FieldStep = 'start' | 'visual' | 'measure' | 'check'
export type MissingItem = { step: FieldStep; key: string; title: string; reason: string }
type Entries = { visual: VisualEntry[]; measurements: MeasurementEntry[]; findings: Finding[]; weather?: Weather }

// 提出前の入力漏れ（SDD 4.3-5）：天候、未判定の目視、×なのにコメント・写真がない目視、未入力の測定値
export function missingItems(entries: Entries): MissingItem[] {
  const missing: MissingItem[] = []
  if (!entries.weather) missing.push({ step: 'start', key: 'weather', title: '天候', reason: '天候が選ばれていません' })
  for (const entry of entries.visual) {
    const title = visualItems.find(item => item.itemId === entry.itemId)?.title ?? entry.itemId
    if (!entry.result) missing.push({ step: 'visual', key: `visual:${entry.itemId}`, title, reason: '判定が入っていません' })
    else if (entry.result === '×' || entry.result === '△') {
      if (!entry.comment.trim()) missing.push({ step: 'visual', key: `comment:${entry.itemId}`, title, reason: `${entry.result}の内容（コメント）がありません` })
      if (!entry.photoIds.length) missing.push({ step: 'visual', key: `photo:${entry.itemId}`, title, reason: `${entry.result}なのに写真がありません` })
    }
  }
  for (const entry of entries.measurements.filter(item => item.judgement === '未入力')) missing.push({ step: 'measure', key: `measure:${entry.key}`, title: measurementTitle(entry), reason: entry.raw ? '数値として読み取れません' : '測定値が入っていません' })
  return missing
}
