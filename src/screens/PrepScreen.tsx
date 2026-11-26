import { ArrowLeft, FileText, Send } from 'lucide-react'
import { InspectionStatusChip, JudgementMark, StatusChip, VisualResultMark } from '../components/ui'
import { ReportWorkflowNotice } from '../components/ReportWorkflowNotice'
import { visualItems } from '../config/visualItems'
import type { Checkpoint, CheckpointKind } from '../logic/checkpoints'
import { formatDate, formatDateWithWeekday, formatQuantity } from '../logic/format'
import { arrayRowsLabel, circuitLabel, measurementValue } from '../logic/labels'
import { overallCounts, reportIssues } from '../logic/report'
import { panelKw, pcsRatedKw, siteCircuits } from '../logic/site'
import type { Tone } from '../logic/status'
import type { ReportProgress } from '../logic/reportWorkflow'
import type { Inspection, MeasurementEntry, MeasurementKind, ReportReview, Site } from '../types'

const checkpointTone: Record<CheckpointKind, Tone> = { trend: 'amber', nearThreshold: 'amber', previousFinding: 'amber', openRepair: 'blue' }

// highlighted：今回の確認ポイントになっている測定欄
function MeasurementCell({ entries, kind, pcsId, circuitId, highlighted }: { entries: MeasurementEntry[]; kind: MeasurementKind; pcsId?: string; circuitId?: string; highlighted?: Set<string> }) {
  const entry = entries.find(item => item.kind === kind && item.pcsId === pcsId && item.circuitId === circuitId)
  if (!entry) return <td className="numeric text-muted">—</td>
  return <td className={`numeric ${highlighted?.has(entry.key) ? 'is-highlighted' : ''}`}><span className="measurement-value">{measurementValue(entry)}</span>{entry.judgement !== '適合' && <JudgementMark judgement={entry.judgement} />}</td>
}

// localMode：同じ端末で現場入力している点検（共有URLを使わない）
const startedStatuses: Inspection['status'][] = ['点検中', '提出済み', '報告書作成済み', '完了']
const submittedStatuses: Inspection['status'][] = ['提出済み', '報告書作成済み', '完了']

export function PrepScreen({ site, inspection, previous, checkpoints, onBack, onLocal, onRequest, onReport, review, progress, onReview }: { site: Site; inspection: Inspection; previous?: Inspection; checkpoints: Checkpoint[]; onBack: () => void; onLocal: () => void; onRequest: () => void; onReport: () => void; review?: ReportReview; progress: ReportProgress | null; onReview: () => void }) {
  const circuits = siteCircuits(site)
  const canEnter = !submittedStatuses.includes(inspection.status)
  const shared = Boolean(inspection.shareToken && !inspection.localField)
  const previousFindings = previous?.visual.filter(entry => entry.result === '×') ?? []
  const ground = previous?.measurements.find(entry => entry.kind === '接地抵抗_架台')
  const highlighted = new Set(checkpoints.flatMap(point => point.refKey ? [point.refKey] : []))

  return <div className="page" data-testid="prep-screen">
    <button className="back-button" onClick={onBack}><ArrowLeft />点検予定へ戻る</button>
    <div className="page-heading">
      <div><h1>{site.name}</h1><p>{site.address}・{formatDateWithWeekday(inspection.scheduledOn)}・{inspection.inspector}</p></div>
      <div className="heading-actions">
        <InspectionStatusChip status={inspection.status} />
        {canEnter && !shared && <button className="button button-primary" onClick={onLocal}>{inspection.localField ? '点検を再開' : '自分で点検'}</button>}
        {canEnter && !inspection.localField && <button className="button button-secondary" onClick={onRequest} data-testid="request-field"><Send />{shared ? '現場の進捗' : '現場に共有'}</button>}
        {!canEnter && <button className="button button-primary" onClick={onReport} data-testid="to-report"><FileText />{inspection.status === '提出済み' ? '報告書を作成' : '報告書を開く'}</button>}
      </div>
    </div>

    <ReportWorkflowNotice progress={progress} review={review} completed={inspection.status === '完了'} onOpen={onReview} />
    <div className="prep-layout">
      <div className="prep-main">
        {startedStatuses.includes(inspection.status) && <FieldResult site={site} inspection={inspection} />}
        <section className="panel" data-testid="checkpoints">
          <header className="panel-header"><h2>今回の確認ポイント</h2><span className="panel-count">{checkpoints.length}件</span></header>
          {checkpoints.length ? <ul className="checkpoint-list">{checkpoints.map(point => <li key={point.key} data-testid="checkpoint">
            <div><strong>{point.target}</strong><StatusChip label={point.label} tone={checkpointTone[point.kind]} /></div>
            <p>{point.reason}</p>
          </li>)}</ul> : <p className="panel-empty">前回の指摘や、推移を確認すべき測定値はありません。通常の項目で点検します。</p>}
        </section>

        <section className="panel">
          <header className="panel-header"><h2>前回の点検</h2>{previous && <span className="panel-count">{formatDate(previous.inspectedOn ?? previous.scheduledOn)}・{previous.weather}</span>}</header>
          {previous ? <>
            <div className="prep-subsection">
              <h3>指摘事項</h3>
              {previousFindings.length ? <ul className="plain-list">{previousFindings.map(entry => <li key={entry.itemId}><strong>{visualItems.find(item => item.itemId === entry.itemId)?.title}</strong>{entry.comment && <span>{entry.comment}</span>}</li>)}</ul> : <p className="text-muted">指摘はありませんでした。</p>}
            </div>
            {previous.measurements.length > 0 && <details className="prep-disclosure">
              <summary>前回の測定値</summary>
              <div className="prep-subsection">
                <h3>回路ごとの測定値</h3>
                <table className="data-table">
                  <thead><tr><th>回路</th><th>担当</th><th className="numeric">開放電圧</th><th className="numeric">絶縁抵抗（DC）</th></tr></thead>
                  <tbody>{circuits.map(circuit => { const pcsId = circuit.circuitId.split('/')[0]; return <tr key={circuit.circuitId}><td>{circuitLabel(circuit.circuitId)}</td><td>{arrayRowsLabel(site, circuit.arrayId, circuit.rows)}</td><MeasurementCell entries={previous.measurements} kind="DC開放電圧" pcsId={pcsId} circuitId={circuit.circuitId} /><MeasurementCell entries={previous.measurements} kind="DC絶縁抵抗" pcsId={pcsId} circuitId={circuit.circuitId} highlighted={highlighted} /></tr> })}</tbody>
                </table>
              </div>
              <div className="prep-subsection">
                <h3>PCSごとの測定値</h3>
                <table className="data-table">
                  <thead><tr><th>PCS</th><th className="numeric">絶縁抵抗（AC）</th><th className="numeric">系統電圧 U-O</th><th className="numeric">系統電圧 W-O</th><th className="numeric">接地抵抗</th></tr></thead>
                  <tbody>{site.pcs.map(pcs => <tr key={pcs.pcsId}><td>{pcs.pcsId}</td><MeasurementCell entries={previous.measurements} kind="AC絶縁抵抗" pcsId={pcs.pcsId} /><MeasurementCell entries={previous.measurements} kind="系統電圧UO" pcsId={pcs.pcsId} /><MeasurementCell entries={previous.measurements} kind="系統電圧WO" pcsId={pcs.pcsId} /><MeasurementCell entries={previous.measurements} kind="接地抵抗_PCS" pcsId={pcs.pcsId} /></tr>)}</tbody>
                </table>
                {ground && <p className="table-note">架台の接地抵抗：<span className="numeric">{measurementValue(ground)}</span></p>}
              </div>
            </details>}
          </> : <p className="panel-empty">この発電所は今回が初めての定期点検です。</p>}
        </section>
      </div>

      <aside className="prep-side">
        <details className="panel prep-disclosure">
          <summary>発電所の設備情報</summary>
          <dl className="info-list">
            <div><dt>オーナー</dt><dd>{site.owner} 様</dd></div>
            <div><dt>連系日</dt><dd>{formatDate(site.gridConnectedOn)}</dd></div>
            <div><dt>容量</dt><dd className="numeric">PCS {formatQuantity(pcsRatedKw(site), 'kW', 1)}／パネル {formatQuantity(panelKw(site), 'kW', 2)}</dd></div>
            <div><dt>モジュール</dt><dd>{site.module.model}<small className="numeric">{formatQuantity(site.module.pmaxW, 'W')}×{site.module.count}枚</small></dd></div>
            {site.pcs[0] && <div><dt>PCS</dt><dd>{site.pcs[0].maker} {site.pcs[0].model}<small className="numeric">{formatQuantity(site.pcs[0].ratedKw, 'kW', 1)}×{site.pcs.length}台・{site.pcs[0].gridType}</small></dd></div>}
            {circuits.length > 0 && <div><dt>回路</dt><dd className="numeric">{circuits.length}回路・{[...new Set(circuits.map(circuit => circuit.seriesCount))].join('／')}直列</dd></div>}
            <div><dt>接地</dt><dd>{site.groundingClass}種{site.groundingRelaxed ? '（緩和要件）' : ''}</dd></div>
            <div><dt>監視システム</dt><dd>{site.monitoringSystem}</dd></div>
          </dl>
        </details>
        {circuits.length > 0 && <details className="panel prep-disclosure">
          <summary>回路構成</summary>
          <table className="data-table">
            <thead><tr><th>回路</th><th>担当</th><th className="numeric">直列</th></tr></thead>
            <tbody>{circuits.map(circuit => <tr key={circuit.circuitId}><td>{circuitLabel(circuit.circuitId)}</td><td>{arrayRowsLabel(site, circuit.arrayId, circuit.rows)}</td><td className="numeric">{circuit.seriesCount}枚</td></tr>)}</tbody>
          </table>
        </details>}
      </aside>
    </div>
  </div>
}

// 結果確認（SDD 4.4）。現場の入力が5秒ごとに取り込まれるので、点検中はここがライブで増えていく。
function FieldResult({ site, inspection }: { site: Site; inspection: Inspection }) {
  const counts = overallCounts(inspection)
  const issues = reportIssues(inspection, site)
  return <section className="panel" data-testid="field-result">
    <header className="panel-header"><h2>現場の入力結果</h2><span className="panel-count">{inspection.status === '点検中' ? '入力中（自動で更新されます）' : `${inspection.weather ?? ''}・提出済み`}</span></header>
    <section className="summary-strip summary-strip-inset" aria-label="入力状況">
      <div><span>目視</span><strong>{inspection.visual.filter(entry => entry.result).length}<small> / {inspection.visual.length}</small></strong></div>
      {!!inspection.measurements.length && <div><span>測定</span><strong>{inspection.measurements.filter(entry => entry.judgement !== '未入力').length}<small> / {inspection.measurements.length}</small></strong></div>}
      <div className={counts.needsAction ? 'is-alert' : ''}><span>要対応</span><strong>{counts.needsAction}</strong></div>
      <div><span>要観察・測定の要確認</span><strong>{counts.caution}</strong></div>
    </section>
    {issues.length ? <ul className="issue-list">{issues.map(issue => <li key={issue.key} data-testid="field-issue">
      {issue.mark === '×' || issue.mark === '△' ? <VisualResultMark result={issue.mark} /> : <JudgementMark judgement={issue.mark} />}
      <div><strong>{issue.title}{issue.value && <span className="numeric">{issue.value}</span>}</strong><p>{issue.detail}</p>{issue.location && <p className="issue-location">異常箇所：{issue.location}</p>}</div>
    </li>)}</ul> : <p className="panel-empty">今のところ指摘はありません。</p>}
  </section>
}
