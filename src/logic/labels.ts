import { measurementLabels, measurementUnits } from '../config/thresholds'
import type { MeasurementEntry, Site } from '../types'
import { formatQuantity } from './format'
import { parseMeasurement } from './judge'

// circuitIdは「PCS-2/回路2」形式（発電所内で一意）。表示時は「PCS-2 回路2」。
export const circuitLabel = (circuitId: string) => circuitId.replace('/', ' ')

export function measurementTitle(entry: Pick<MeasurementEntry, 'kind' | 'pcsId' | 'circuitId'>) {
  const target = entry.circuitId ? circuitLabel(entry.circuitId) : entry.pcsId ?? '発電所'
  return `${target} ${measurementLabels[entry.kind]}`
}

export function panelLocation(site: Site, arrayId: string | undefined, panels: { row: number; col: number }[] | undefined) {
  const array = site.arrays.find(item => item.arrayId === arrayId)
  if (!array) return ''
  const positions = (panels ?? []).map(panel => `${panel.row}段目${panel.col}列目`).join('・')
  return positions ? `${array.label} ${positions}` : array.label
}

// 測定値の表示。「>2000」「∞」の上限超え表記はそのまま見せる。
export function measurementValue(entry: Pick<MeasurementEntry, 'kind' | 'raw'>) {
  const parsed = parseMeasurement(entry.raw)
  if (parsed.status !== 'ok') return entry.raw || '—'
  if (parsed.overRange) return parsed.value === null ? '∞' : `>${formatQuantity(parsed.value, measurementUnits[entry.kind])}`
  return formatQuantity(parsed.value!, measurementUnits[entry.kind])
}

export const arrayRowsLabel = (site: Site, arrayId: string, rows: number[]) => `${site.arrays.find(array => array.arrayId === arrayId)?.label ?? arrayId} ${rows.map(row => `${row}段目`).join('・')}`
