import { CalendarClock } from 'lucide-react'
import { useMemo } from 'react'
import { InsulationTrendChart, type TrendSeries } from '../components/InsulationTrendChart'
import { InspectionStatusChip, JudgementMark, StatusChip } from '../components/ui'
import { checkpointRules } from '../config/thresholds'
import { decliningRun } from '../logic/checkpoints'
import { formatDate, formatDateWithWeekday, formatMonth, formatQuantity } from '../logic/format'
import { findingCount } from '../logic/history'
import { dcInsulationMin, measurementKey, parseMeasurement } from '../logic/judge'
import { circuitLabel, measurementValue } from '../logic/labels'
import { decisionWord, repairResult } from '../logic/repairs'
import { siteCircuits } from '../logic/site'
import { repairTone } from '../logic/status'
import type { Inspection, RepairCase, Site } from '../types'

const recordedStatuses: Inspection['status'][] = ['提出済み', '報告書作成済み', '完了']
const dateOf = (inspection: Inspection) => inspection.inspectedOn ?? inspection.scheduledOn

// 発電所カルテ（SDD 4.7）。点検を完了すると今回値が推移に加わり、1年後の予定が「次回点検」に出る。
export function KarteScreen({ sites, site, inspections, repairCases, onSelectSite, onOpenInspection, onOpenRepair }: { sites: Site[]; site: Site; inspections: Inspection[]; repairCases: RepairCase[]; onSelectSite: (siteId: string) => void; onOpenInspection: (inspectionId: string) => void; onOpenRepair: (caseId: string) => void }) {
  const siteInspections = useMemo(() => inspections.filter(item => item.siteId === site.siteId).sort((a, b) => dateOf(b).localeCompare(dateOf(a))), [inspections, site.siteId])
  const recorded = siteInspections.filter(item => recordedStatuses.includes(item.status)).reverse().slice(-4)
  const next = [...siteInspections].reverse().find(item => !recordedStatuses.includes(item.status))
  const repairs = repairCases.filter(item => item.siteId === site.siteId).sort((a, b) => b.caseId.localeCompare(a.caseId))
  // 直近の点検の修繕で再測定した値（例：交換後 85MΩ）
  const afterRepair = (key: string) => {
    const repair = repairs.find(item => item.inspectionId === recorded.at(-1)?.inspectionId && item.status === '完了' && item.remeasure?.key === key)
    const value = repair?.remeasure ? parseMeasurement(repair.remeasure.raw).value : null
    return repair?.remeasure && value ? { value, label: `${decisionWord(repair.customerDecision)}後 ${measurementValue(repair.remeasure)}` } : undefined
  }

  const series: TrendSeries[] = siteCircuits(site).map(circuit => {
    const key = measurementKey('DC絶縁抵抗', circuit.circuitId.split('/')[0], circuit.circuitId)
    return { key, circuitId: circuit.circuitId, points: recorded.map(inspection => {
      const entry = inspection.measurements.find(item => item.key === key)
      const parsed = entry ? parseMeasurement(entry.raw) : null
      return { date: dateOf(inspection), value: parsed?.status === 'ok' && !parsed.overRange ? parsed.value : null, label: entry ? measurementValue(entry) : '—', judgement: entry?.judgement ?? '未入力' }
    }), after: afterRepair(key) }
  })
  // 強調する回路：最新が不適合・要確認、または連続低下（初回比30%以上）
  const emphasized = series.filter(item => {
    const last = item.points.at(-1)
    const run = decliningRun(item.points.map(point => point.value))
    return (last && (last.judgement === '不適合' || last.judgement === '要確認')) || (run.length >= checkpointRules.trendMinInspections && (run[0] - run.at(-1)!) / run[0] >= checkpointRules.trendMinDropRatio)
  }).map(item => item.key)
  const threshold = dcInsulationMin(siteCircuits(site)[0].seriesCount * site.module.vocPerModule)

  return <div className="page" data-testid="karte-screen">
    <div className="page-heading">
      <div><h1>{site.name}</h1><p>{site.address}・PCS {formatQuantity(site.capacityKw, 'kW', 1)}・{site.owner} 様</p></div>
      <label className="site-select"><span>発電所</span><select value={site.siteId} onChange={event => onSelectSite(event.target.value)} data-testid="karte-site">{sites.map(item => <option key={item.siteId} value={item.siteId}>{item.name}</option>)}</select></label>
    </div>

    {next && <section className="next-inspection" data-testid="karte-next"><CalendarClock /><div><span>次回点検</span><strong>{formatDateWithWeekday(next.scheduledOn)}</strong></div><InspectionStatusChip status={next.status} /><button className="button button-secondary" onClick={() => onOpenInspection(next.inspectionId)}>点検準備を開く</button></section>}

    <section className="panel karte-trend">
      <header className="panel-header"><h2>絶縁抵抗（DC）の推移</h2><span className="panel-count">直近{recorded.length}回・対数目盛</span></header>
      {recorded.length ? <>
        <div className="chart-legend" aria-hidden="true">
          {emphasized.map(key => <span key={key} className="is-emphasized"><i />{circuitLabel(series.find(item => item.key === key)!.circuitId)}</span>)}
          <span><i />{emphasized.length ? `その他の回路（${series.length - emphasized.length}）` : `全回路（${series.length}）`}</span>
          {series.some(item => item.after) && <span className="is-after"><i />修繕後の再測定</span>}
          <span className="is-threshold"><i />基準</span>
        </div>
        <InsulationTrendChart series={series} dates={recorded.map(dateOf)} dateLabels={recorded.map(inspection => formatMonth(dateOf(inspection)))} emphasized={emphasized} threshold={threshold} />
        <details className="chart-table">
          <summary>表で見る</summary>
          <table className="data-table">
            <thead><tr><th>回路</th>{recorded.map(inspection => <th key={inspection.inspectionId} className="numeric">{formatMonth(dateOf(inspection))}</th>)}{series.some(item => item.after) && <th className="numeric">修繕後</th>}</tr></thead>
            <tbody>{series.map(item => <tr key={item.key}><td>{circuitLabel(item.circuitId)}</td>{item.points.map(point => <td key={point.date} className="numeric">{point.label}{point.judgement !== '適合' && point.judgement !== '未入力' && <JudgementMark judgement={point.judgement} />}</td>)}{series.some(entry => entry.after) && <td className="numeric">{item.after?.label ?? '—'}</td>}</tr>)}</tbody>
          </table>
        </details>
      </> : <p className="panel-empty">まだ点検の記録がありません。</p>}
    </section>

    <div className="karte-columns">
      <section className="panel">
        <header className="panel-header"><h2>点検履歴</h2><span className="panel-count">{siteInspections.length}件</span></header>
        <ul className="history-list">{siteInspections.map(inspection => <li key={inspection.inspectionId}>
          <span className="numeric">{formatDate(dateOf(inspection))}</span>
          <InspectionStatusChip status={inspection.status} />
          <span className="text-muted">{recordedStatuses.includes(inspection.status) ? `${inspection.weather ?? ''}・指摘${findingCount(inspection)}件` : '予定'}</span>
          {inspection.kind === '駆けつけ点検' && <small>駆けつけ点検</small>}<button className="link-button" onClick={() => onOpenInspection(inspection.inspectionId)}>開く</button>
        </li>)}</ul>
      </section>
      <section className="panel">
        <header className="panel-header"><h2>修繕履歴</h2><span className="panel-count">{repairs.length}件</span></header>
        {repairs.length ? <ul className="history-list">{repairs.map(repair => <li key={repair.caseId} data-testid="karte-repair">
          <button className="link-button" onClick={() => onOpenRepair(repair.caseId)}>{repair.title}</button>
          <StatusChip label={repairResult(repair)} tone={repairTone(repairResult(repair))} />
          <span className="text-muted">{repair.customerDecision ? `${repair.customerDecision}${repair.decidedOn ? `（${formatDate(repair.decidedOn)}回答）` : ''}` : 'お客様の回答待ち'}</span>
        </li>)}</ul> : <p className="panel-empty">修繕の記録はありません。</p>}
      </section>
    </div>
  </div>
}
