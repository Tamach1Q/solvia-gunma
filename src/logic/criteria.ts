import { thresholds } from '../config/thresholds'
import type { MeasurementEntry, Site } from '../types'
import { formatNumber } from './format'
import { circuitOpenVoltage, dcInsulationMin, groundingMax } from './judge'

// 現場の入力欄・報告書に出す「基準」の短い表記。値は thresholds.ts から作る。
export function criterionText(entry: Pick<MeasurementEntry, 'kind' | 'pcsId' | 'circuitId'>, site: Site, entries: MeasurementEntry[]) {
  const pcs = site.pcs.find(item => item.pcsId === entry.pcsId)
  switch (entry.kind) {
    case 'DC開放電圧': return `直列数が同じ回路の中央値±${thresholds.openVoltage.cautionDeviation * 100}%以内`
    case 'DC絶縁抵抗': return `${formatNumber(dcInsulationMin(circuitOpenVoltage(entries, site, entry.pcsId, entry.circuitId).voltage))}MΩ以上`
    case 'AC絶縁抵抗': return `${thresholds.acInsulation.minMOhm}MΩ以上`
    case '系統電圧UO':
    case '系統電圧WO': {
      const { nominalV, toleranceV } = thresholds.gridVoltage[pcs?.gridType ?? '単相3線']
      return `${nominalV - toleranceV}〜${nominalV + toleranceV}V`
    }
    default: return `${groundingMax(site)}Ω以下（${site.groundingClass}種）`
  }
}
