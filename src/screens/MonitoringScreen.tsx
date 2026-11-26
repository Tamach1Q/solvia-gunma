import { useMemo, useState } from 'react'
import { StatusChip } from '../components/ui'
import { formatNumber, formatQuantity, formatShortDate, formatTime } from '../logic/format'
import { monitoringList, monitoringStateOrder, type MonitoringFilter, type MonitoringSort } from '../logic/monitoringList'
import { inspectionStatusLabel } from '../logic/status'
import { monitoringSnapshot } from '../mock/monitoring'
import type { Inspection, RepairCase, Site, SiteState } from '../types'

const stateTone = { 異常停止中: 'red', 経過観察: 'amber', '現状維持（オーナー意向）': 'neutral', 修繕対応中: 'blue', 復旧済: 'green', '管理外・解約済': 'neutral', 正常: 'green' } as const

export function MonitoringScreen({ sites, inspections, repairCases, onOpenKarte, onOpenInspection, onOpenRepair, onOpenReports }: { sites: Site[]; inspections: Inspection[]; repairCases: RepairCase[]; onOpenKarte: (siteId: string) => void; onOpenInspection: (inspectionId: string) => void; onOpenRepair: (caseId: string) => void; onOpenReports: () => void }) {
  const now = useMemo(() => new Date(), [])
  const rows = useMemo(() => {
    const snapshot = monitoringSnapshot(sites, now)
    return sites.map(site => {
      const monitor = snapshot.find(item => item.siteId === site.siteId)!
      const openRepair = repairCases.find(item => item.siteId === site.siteId && item.status !== '完了')
      const state = monitor.state ?? (openRepair ? '修繕対応中' : monitor.detection?.needsReview ? null : '正常')
      const next = inspections.filter(item => item.siteId === site.siteId && item.status !== '完了').sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))[0]
      return { site, monitor, openRepair, state, next }
    })
  }, [sites, inspections, repairCases, now])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MonitoringFilter>('すべて')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [area, setArea] = useState('')
  const [system, setSystem] = useState('')
  const [sort, setSort] = useState<MonitoringSort>('状態')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [openActions, setOpenActions] = useState<string | null>(null)
  const result = monitoringList(rows, { query, state: filter, pendingOnly, area, system, sort, page, pageSize })
  const count = (state: SiteState) => rows.filter(row => row.state === state).length
  const chooseFilter = (value: MonitoringFilter) => { setFilter(value); setPage(1); setOpenActions(null) }
  const changePage = (value: number) => { setPage(value); setOpenActions(null); document.getElementById('monitoring-list-title')?.scrollIntoView({ block: 'start' }) }
  const clear = () => { setQuery(''); setFilter('すべて'); setPendingOnly(false); setArea(''); setSystem(''); setPage(1); setOpenActions(null) }
  const areas = [...new Set(sites.map(site => site.area))].sort((a, b) => a.localeCompare(b, 'ja'))
  const systems = [...new Set(sites.map(site => site.monitoringSystem))].sort((a, b) => a.localeCompare(b, 'ja'))

  return <div className="page monitoring-page" data-testid="monitoring-screen">
    <div className="page-heading"><div><h1>統合監視</h1><p>発電所の状態を一覧し、異常や対応中の案件を確認します。</p></div><div className="heading-actions"><span className="page-meta">{formatTime(now)} 取得</span><button className="button button-secondary" onClick={onOpenReports}>報告書一覧</button></div></div>
    <section className="monitoring-counts" aria-label="発電所の状態">
      <button aria-pressed={filter === 'すべて' && !pendingOnly} onClick={() => { setPendingOnly(false); chooseFilter('すべて') }}><span>すべて</span><strong>{formatNumber(rows.length)}</strong></button>
      {monitoringStateOrder.map(state => <button key={state} className={state === '異常停止中' && count(state) ? 'is-alert' : ''} aria-pressed={filter === state} onClick={() => chooseFilter(filter === state ? 'すべて' : state)}><span>{state}</span><strong>{formatNumber(count(state))}</strong></button>)}
    </section>
    <section aria-label="発電所一覧" className="monitoring-list-section">
      <div className="monitoring-heading"><h2 id="monitoring-list-title">発電所一覧</h2><span className="text-muted" role="status">{formatNumber(result.total)}件中 {formatNumber(result.from)}〜{formatNumber(result.to)}件</span></div>
      <div className="monitoring-list-filters">
        <label className="monitoring-list-search"><span>発電所を検索</span><input type="search" aria-label="発電所を検索" value={query} onChange={event => { setQuery(event.target.value); setPage(1); setOpenActions(null) }} placeholder="発電所名・所在地・監視システム" /></label>
        <label><span>状態</span><select aria-label="状態で絞り込む" value={filter} onChange={event => chooseFilter(event.target.value as MonitoringFilter)}>{(['すべて', ...monitoringStateOrder] as const).map(value => <option key={value}>{value}</option>)}</select></label>
        <label><span>エリア</span><select aria-label="エリア" value={area} onChange={event => { setArea(event.target.value); setPage(1); setOpenActions(null) }}><option value="">すべて</option>{areas.map(value => <option key={value}>{value}</option>)}</select></label>
        <label><span>監視システム</span><select aria-label="監視システム" value={system} onChange={event => { setSystem(event.target.value); setPage(1); setOpenActions(null) }}><option value="">すべて</option>{systems.map(value => <option key={value}>{value}</option>)}</select></label>
        <button className="button button-secondary" aria-pressed={pendingOnly} onClick={() => { setPendingOnly(!pendingOnly); setPage(1); setOpenActions(null) }}>検知の確認待ち</button>
        <button className="button button-ghost" onClick={clear}>条件をクリア</button>
      </div>
      <div className="monitoring-list-options"><label>並び順<select aria-label="並び順" value={sort} onChange={event => { setSort(event.target.value as MonitoringSort); setPage(1); setOpenActions(null) }}>{(['状態', '発電所名', 'エリア', '次回点検日'] as const).map(value => <option key={value} value={value}>{value === '状態' ? '異常・対応を優先' : value}</option>)}</select></label><label>表示件数<select aria-label="表示件数" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); setOpenActions(null) }}>{[25, 50, 100].map(value => <option key={value} value={value}>{formatNumber(value)}件</option>)}</select></label></div>
      {result.total ? <div className="panel monitoring-table-scroll"><table className="data-table monitoring-table">
        <thead><tr><th>状態</th><th>発電所・エリア</th><th>監視システム</th><th className="numeric">現在出力 / 容量</th><th>異常・対応内容</th><th>次回点検</th><th>操作</th></tr></thead>
        <tbody>{result.rows.map(({ site, monitor, openRepair, state, next }) => <tr key={site.siteId} data-testid="monitoring-row" data-state={state ?? undefined} data-needs-review={monitor.detection?.needsReview || undefined}>
          <td className="monitoring-state">{state ? <StatusChip label={state} tone={stateTone[state]} /> : <span aria-label="状態未設定">—</span>}</td>
          <td className="monitoring-site"><button className="link-button" onClick={() => onOpenKarte(site.siteId)}>{site.name}</button><small>{site.area}<span className="monitoring-mobile-system"> · {site.monitoringSystem}</span></small></td>
          <td className="monitoring-system">{site.monitoringSystem}</td>
          <td className="numeric monitoring-power">{formatNumber(monitor.outputKw, 1)} / {formatQuantity(site.capacityKw, 'kW', 1)}</td>
          <td className="monitoring-content">{monitor.detection ? <><span className={state === '異常停止中' ? 'text-fail' : ''}>{monitor.detection.text}</span><small>{monitor.detection.source} · {formatTime(monitor.detection.detectedAt)}{monitor.detection.needsReview && ' · 確認待ち'}</small></> : !openRepair && <span className="text-muted">アラームなし</span>}{openRepair && <><button className="link-button" onClick={() => onOpenRepair(openRepair.caseId)}>{openRepair.title}</button><small>修繕：{openRepair.status}</small></>}</td>
          <td className="monitoring-visit">{next ? <><span>{formatShortDate(next.scheduledOn, now)}</span><small>{inspectionStatusLabel(next.status)}</small></> : '予定なし'}</td>
          <td className="monitoring-actions"><button className="button button-ghost" aria-expanded={openActions === site.siteId} aria-controls={`monitoring-actions-${site.siteId}`} onClick={() => setOpenActions(openActions === site.siteId ? null : site.siteId)} aria-label={`${site.name}の操作`}>操作</button>{openActions === site.siteId && <div id={`monitoring-actions-${site.siteId}`} className="monitoring-row-actions"><button className="button button-ghost" onClick={() => onOpenKarte(site.siteId)}>発電所カルテ</button>{next && <button className="button button-ghost" onClick={() => onOpenInspection(next.inspectionId)}>点検・報告書を開く</button>}{openRepair && <button className="button button-ghost" onClick={() => onOpenRepair(openRepair.caseId)}>修繕案件を開く</button>}</div>}</td>
        </tr>)}</tbody>
      </table></div> : <div className="panel empty-state" role="status"><strong>該当する発電所がありません。検索条件を変更してください。</strong><button className="button button-secondary" onClick={clear}>条件をクリア</button></div>}
      <nav className="monitoring-pagination" aria-label="発電所一覧のページ"><span>{formatNumber(result.page)} / {formatNumber(result.pages)}ページ</span><button className="button button-secondary" disabled={result.page === 1} onClick={() => changePage(result.page - 1)}>前のページ</button><button className="button button-secondary" disabled={result.page === result.pages} onClick={() => changePage(result.page + 1)}>次のページ</button></nav>
    </section>
  </div>
}
