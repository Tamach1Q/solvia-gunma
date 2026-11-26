import { visualItemIds, visualItems } from '../config/visualItems'
import type { Finding, Inspection, MeasurementEntry, Site } from '../types'
import { formatNumber } from './format'
import { circuitOpenVoltage, dcInsulationMin, parseMeasurement } from './judge'
import { circuitLabel, measurementTitle, panelLocation } from './labels'
import { circuitForPanel } from './site'

export type ProposalOptions = { boltTightenedOnSite?: boolean }

const sentence = (text: string) => text.trim().replace(/[。．.]+$/, '')

// 指摘の種類ごとの文例（SDD 6.3）。報告書画面で編集される前提の初期文。
export function buildProposals(inspection: Inspection, site: Site, previous?: Inspection, options: ProposalOptions = {}): string[] {
  const findingFor = (refKey: string) => inspection.findings.find(finding => finding.refKey === refKey)
  const measurementProposal = (entry: MeasurementEntry) => {
    const title = entry.circuitId ? circuitLabel(entry.circuitId) : entry.pcsId ?? ''
    if (entry.kind === 'DC絶縁抵抗' && entry.value !== null) {
      if (entry.judgement === '不適合') {
        const min = dcInsulationMin(circuitOpenVoltage(inspection.measurements, site, entry.pcsId, entry.circuitId).voltage)
        return `${title}で絶縁抵抗の低下（${formatNumber(entry.value)}MΩ、基準${formatNumber(min)}MΩ以上）を確認しました。ケーブル・コネクタの損傷や浸水の可能性があります。系統の切り分けによる詳細調査と、該当箇所の補修をご提案します。`
      }
      const before = previous?.measurements.find(item => item.key === entry.key)
      const beforeValue = before ? parseMeasurement(before.raw).value : null
      if (entry.judgement === '要確認' && beforeValue !== null && entry.value < beforeValue) return `${title}の絶縁抵抗は基準内ですが、前回（${formatNumber(beforeValue)}MΩ）から低下しています。次回点検までの経過観察、または早期の詳細調査をご検討ください。`
    }
    const comment = findingFor(entry.key)?.comment || entry.reason
    return `${measurementTitle(entry)}について${sentence(comment)}。対応方法をご相談させてください。`
  }
  const visualProposal = (itemId: string, comment: string) => {
    const finding = findingFor(itemId)
    if (itemId === visualItemIds.panelDamage) {
      const location = panelLocation(site, finding?.arrayId, finding?.panels)
      return `${location ? `${location}の` : ''}モジュールに破損を確認しました。発電低下や感電・火災のおそれがあるため、交換をご提案します。`
    }
    if (itemId === visualItemIds.boltLoose) return `架台ボルトに緩みを確認しました。${options.boltTightenedOnSite ? '当日増し締め済みです。' : '次回作業で増し締めを行います。'}`
    if (itemId === visualItemIds.weeds) return '発電に影響する雑草・影を確認しました。除草作業をご提案します。'
    const title = visualItems.find(item => item.itemId === itemId)?.title ?? itemId
    return `${title}について${sentence(comment || '異常を確認しました')}。対応方法をご相談させてください。`
  }
  // 同じ回路で目視×とDC絶縁抵抗の不適合が重なったら、原因と対処が1つにつながるので1本のご提案にまとめる
  const findingCircuit = (finding: Finding | undefined) => finding?.circuitId ?? (finding?.arrayId && finding.panels?.[0] ? circuitForPanel(site, finding.arrayId, finding.panels[0].row)?.circuitId : undefined)
  const visualFailures = inspection.visual.filter(entry => entry.result === '×')
  const merged = inspection.measurements.filter(entry => entry.kind === 'DC絶縁抵抗' && entry.judgement === '不適合' && entry.value !== null && entry.circuitId).flatMap(entry => {
    const visual = visualFailures.find(item => findingCircuit(findingFor(item.itemId)) === entry.circuitId)
    return visual ? [{ entry, visual }] : []
  })
  const mergedProposal = ({ entry, visual }: (typeof merged)[number]) => {
    const finding = findingFor(visual.itemId)
    const location = panelLocation(site, finding?.arrayId, finding?.panels)
    const min = dcInsulationMin(circuitOpenVoltage(inspection.measurements, site, entry.pcsId, entry.circuitId).voltage)
    const insulation = `同じ回路（${circuitLabel(entry.circuitId!)}）の絶縁抵抗も${formatNumber(entry.value!)}MΩ（基準${formatNumber(min)}MΩ以上）に低下しており`
    if (visual.itemId === visualItemIds.panelDamage) return `${location ? `${location}の` : ''}モジュールに割れを確認しました。${insulation}、割れた箇所からの浸水が原因と考えられます。該当モジュールの交換と、交換後の絶縁抵抗の再測定をご提案します。`
    const title = visualItems.find(item => item.itemId === visual.itemId)?.title ?? visual.itemId
    return `${location ? `${location}の` : ''}${title}について${sentence(visual.comment || '異常を確認しました')}。${insulation}、関連が考えられます。該当箇所の補修と、補修後の絶縁抵抗の再測定をご提案します。`
  }
  const failed = inspection.measurements.filter(entry => entry.judgement === '不適合' && !merged.some(item => item.entry === entry)).map(measurementProposal)
  const visual = visualFailures.filter(entry => !merged.some(item => item.visual === entry)).map(entry => visualProposal(entry.itemId, entry.comment))
  const caution = inspection.measurements.filter(entry => entry.judgement === '要確認').map(measurementProposal)
  const observation = inspection.visual.filter(entry => entry.result === '△').map(entry => `${visualItems.find(item => item.itemId === entry.itemId)?.title ?? entry.itemId}について${sentence(entry.comment)}。次回点検で状態の変化を確認します。`)
  return [...merged.map(mergedProposal), ...failed, ...visual, ...observation, ...caution]
}
