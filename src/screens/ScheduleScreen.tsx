import { ClipboardCheck, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { InspectionStatusChip, ReportReviewStatusChip } from '../components/ui'
import { toDateString } from '../logic/dates'
import { formatDateTime, formatMonth, formatQuantity, formatShortDate } from '../logic/format'
import { findingCount, previousInspection } from '../logic/history'
import { reportProgress } from '../logic/reportWorkflow'
import type { Area, Inspection, ReportReview, Site } from '../types'

type Row = { inspection: Inspection; site: Site; previous?: Inspection }

// 今月の点検をエリアごとにまとめる（近い発電所を同じ日にまとめて回る運用に合わせる）。エリアは訪問日の早い順。
export function ScheduleScreen({ sites, inspections, reviews, onOpenReview, onOpen, onLocal, onShare, onReport, onComplete, onReset }: { sites: Site[]; inspections: Inspection[]; reviews: ReportReview[]; onOpenReview: (reviewId: string) => void; onOpen: (inspectionId: string) => void; onLocal: (inspection: Inspection) => void; onShare: (inspection: Inspection) => void; onReport: (inspection: Inspection) => void; onComplete: (inspection: Inspection) => void; onReset: () => void }) {
  const today = useMemo(() => new Date(), [])
  const groups = useMemo(() => {
    const month = toDateString(today).slice(0, 7)
    const rows: Row[] = inspections.filter(inspection => inspection.scheduledOn.startsWith(month)).map(inspection => ({ inspection, site: sites.find(site => site.siteId === inspection.siteId)!, previous: previousInspection(inspections, inspection) }))
    const byArea = new Map<Area, Row[]>()
    for (const row of [...rows].sort((a, b) => a.inspection.scheduledOn.localeCompare(b.inspection.scheduledOn) || a.site.name.localeCompare(b.site.name, 'ja'))) byArea.set(row.site.area, [...(byArea.get(row.site.area) ?? []), row])
    return [...byArea.entries()].map(([area, items]) => ({ area, items, dates: [...new Set(items.map(item => item.inspection.scheduledOn))] }))
  }, [sites, inspections, today])
  // 来月以降の予定（点検を完了すると1年後の予定がここに加わる）
  const upcoming = useMemo(() => {
    const monthEnd = toDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    return inspections.filter(inspection => inspection.scheduledOn > monthEnd).sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn)).map(inspection => ({ inspection, site: sites.find(site => site.siteId === inspection.siteId)! }))
  }, [sites, inspections, today])
  const all = groups.flatMap(group => group.items)
  const count = (statuses: Inspection['status'][]) => all.filter(row => statuses.includes(row.inspection.status)).length

  return <div className="page" data-testid="schedule-screen">
    <div className="page-heading"><div><h1>点検予定</h1><p>{formatMonth(today)}時点の定期点検をエリアごとに確認します。</p></div><button className="button button-secondary" onClick={onReset} data-testid="reset-data"><RotateCcw />初期状態に戻す</button></div>
    {all.length ? <>
      <section className="summary-strip schedule-summary" aria-label="今月の点検の状況">
        <div><span>今月の点検</span><strong>{all.length}</strong></div>
        <div><span>未依頼</span><strong>{count(['未依頼'])}</strong></div>
        <div><span>リンク発行・点検中</span><strong>{count(['依頼済み', '点検中'])}</strong></div>
        <div><span>報告書の作成・確認中</span><strong>{count(['提出済み', '報告書作成済み'])}</strong></div>
        <div><span>完了</span><strong>{count(['完了'])}</strong></div>
      </section>
      {groups.map(group => <section className="panel schedule-group" key={group.area} data-testid="schedule-area">
        <header className="panel-header"><h2>{group.area}</h2><span className="panel-count">{group.dates.map(date => formatShortDate(date, today)).join('・')}</span><span className="panel-count">{group.items.length}件</span></header>
        <div className="schedule-table-scroll"><table className="data-table mobile-record-table schedule-current-table">
          <thead><tr><th>点検日</th><th>発電所</th><th className="numeric">容量</th><th>前回点検</th><th>前回の指摘</th><th>点検の状態</th><th>報告書チェック</th><th>操作</th></tr></thead>
          <tbody>{group.items.map(({ inspection, site, previous }) => {
            const findings = findingCount(previous)
            const review = reviews.find(item => item.inspection.inspectionId === inspection.inspectionId)
            const progress = reportProgress(inspection, site, review)
            const { status, localField, shareToken } = inspection
            return <tr key={inspection.inspectionId} data-testid="schedule-row">
              <td data-label="点検日" className="numeric-cell">{formatShortDate(inspection.scheduledOn, today)}</td>
              <td data-label="発電所"><button className="link-button" onClick={() => onOpen(inspection.inspectionId)} data-testid={`open-${site.siteId}`}>{site.name}</button><small>{site.address.replace('群馬県', '')}</small></td>
              <td data-label="容量" className="numeric">{formatQuantity(site.capacityKw, 'kW', 1)}</td>
              <td data-label="前回点検" className="numeric-cell">{previous ? formatShortDate(previous.inspectedOn ?? previous.scheduledOn, today) : <span className="text-muted">初回</span>}</td>
              <td data-label="前回の指摘">{findings ? <span className="text-caution">あり（{findings}件）</span> : <span className="text-muted">なし</span>}</td>
              <td data-label="点検の状態"><InspectionStatusChip status={inspection.status} /></td>
              <td data-label="報告書チェック" data-testid="schedule-report-status">{progress ? <>{review ? <button className="report-status-link" onClick={() => onOpenReview(review.reviewId)} aria-label={`${site.name}の報告書チェックを開く`}><ReportReviewStatusChip status={progress} /></button> : <ReportReviewStatusChip status={progress} />}{progress === '承認済み' && review?.reviewedAt && <small>{review.reviewedBy}<br />{formatDateTime(review.reviewedAt)}</small>}{progress === '差し戻し' && <small>報告書の修正が必要</small>}</> : <span className="text-muted">—</span>}</td>
              <td data-label="操作"><div className="schedule-actions">
                {status === '未依頼' && !shareToken && !localField && <><button className="button button-primary" onClick={() => onLocal(inspection)} data-testid="schedule-local">自分で点検</button><button className="button button-secondary" onClick={() => onShare(inspection)} data-testid="schedule-share">現場に共有</button></>}
                {(status === '未依頼' || status === '依頼済み' || status === '点検中') && (localField ? <button className="button button-primary" onClick={() => onLocal(inspection)} data-testid="schedule-local">点検を再開</button> : shareToken ? <button className="button button-secondary" onClick={() => onShare(inspection)} data-testid="schedule-share">現場の進捗</button> : status !== '未依頼' && <button className="button button-secondary" onClick={() => onOpen(inspection.inspectionId)}>点検内容を見る</button>)}
                {status === '提出済み' && <button className="button button-primary" onClick={() => onReport(inspection)} data-testid="schedule-report">報告書を作成</button>}
                {status === '報告書作成済み' && (progress === '承認済み' ? <button className="button button-primary" onClick={() => onComplete(inspection)}>点検を完了</button> : progress === 'チェック待ち' && review ? <button className="button button-secondary" onClick={() => onOpenReview(review.reviewId)}>チェック状況</button> : <button className="button button-primary" onClick={() => onReport(inspection)} data-testid="schedule-report">{progress === '差し戻し' || progress === '再提出待ち' ? '報告書を修正' : '報告書を開く'}</button>)}
                {status === '完了' && <button className="button button-secondary" onClick={() => onReport(inspection)}>報告書を見る</button>}
              </div></td>
            </tr>
          })}</tbody>
        </table></div>
      </section>)}
      {upcoming.length > 0 && <section className="panel schedule-group schedule-upcoming" data-testid="schedule-upcoming">
        <header className="panel-header"><h2>来月以降の予定</h2><span className="panel-count">{upcoming.length}件</span></header>
        <div className="schedule-table-scroll"><table className="data-table mobile-record-table">
          <thead><tr><th>予定日</th><th>発電所</th><th className="numeric">容量</th><th>エリア</th><th>前回点検</th><th>ステータス</th></tr></thead>
          <tbody>{upcoming.map(({ inspection, site }) => {
            const previous = previousInspection(inspections, inspection)
            return <tr key={inspection.inspectionId} data-testid="upcoming-row">
              <td data-label="予定日" className="numeric-cell">{formatShortDate(inspection.scheduledOn, today)}</td>
              <td data-label="発電所"><button className="link-button" onClick={() => onOpen(inspection.inspectionId)}>{site.name}</button></td>
              <td data-label="容量" className="numeric">{formatQuantity(site.capacityKw, 'kW', 1)}</td>
              <td data-label="エリア">{site.area}</td>
              <td data-label="前回点検" className="numeric-cell">{previous ? formatShortDate(previous.inspectedOn ?? previous.scheduledOn, today) : '—'}</td>
              <td data-label="状態"><InspectionStatusChip status={inspection.status} /></td>
            </tr>
          })}</tbody>
        </table></div>
      </section>}
    </> : <section className="panel empty-state" data-testid="schedule-empty"><ClipboardCheck size={28} /><strong>今月の点検予定はありません</strong><span>点検が完了すると、1年後の予定がここに追加されます。</span></section>}
  </div>
}
