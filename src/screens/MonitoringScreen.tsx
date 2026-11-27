import { useMemo, useState } from 'react'
import { formatNumber, formatQuantity, formatShortDate, formatTime } from '../logic/format'
import { monitoringSnapshot } from '../mock/monitoring'
import type { Inspection, RepairCase, Site } from '../types'

type SiteState = '要対応' | '要確認' | '修繕対応中' | '正常'
const stateOrder: SiteState[] = ['要対応', '要確認', '修繕対応中', '正常']
const stateTone: Record<SiteState, string> = { 要対応: 'red', 要確認: 'amber', 修繕対応中: 'blue', 正常: 'green' }
const areaOrder = ['渋川市', '前橋市', '高崎市', '伊勢崎市', '沼田市']

export function MonitoringScreen({ sites, inspections, repairCases, onOpenKarte, onRegisterIncident }: { sites: Site[]; inspections: Inspection[]; repairCases: RepairCase[]; onOpenKarte: (siteId: string) => void; onRegisterIncident: (monitor: import('../types').MonitoringStatus) => void }) {
  const now = useMemo(() => new Date(), [])
  const rows = useMemo(() => {
    const snapshot = monitoringSnapshot(sites, now)
    return sites.map(site => {
      const monitor = snapshot.find(item => item.siteId === site.siteId)!
      const openRepair = repairCases.find(item => item.siteId === site.siteId && item.status !== '完了')
      const state: SiteState = monitor.level !== '正常' ? monitor.level : openRepair ? '修繕対応中' : '正常'
      const next = inspections.filter(item => item.siteId === site.siteId && item.status !== '完了').sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))[0]
      return { site, monitor, openRepair, state, next }
    }).sort((a, b) => stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state) || areaOrder.indexOf(a.site.area) - areaOrder.indexOf(b.site.area))
  }, [sites, inspections, repairCases, now])
  const [query, setQuery] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const search = query.trim().normalize('NFKC').toLowerCase()
  const visible = rows.filter(({ site, state }) => `${site.name} ${site.address} ${site.monitoringSystem}`.normalize('NFKC').toLowerCase().includes(search) && (!attentionOnly || state === '要対応' || state === '要確認'))
  const count = (state: SiteState) => rows.filter(row => row.state === state).length

  return <div className="page" data-testid="monitoring-screen">
    <div className="page-heading"><div><h1>統合監視</h1><p>監視システムをまたいで、発電所の状態と対応中の案件をまとめて確認します。</p></div><span className="page-meta">{formatTime(now)} 取得</span></div>
    <section className="summary-strip monitoring-metrics" aria-label="発電所の状態">
      {stateOrder.map(state => <div key={state} className={state === '要対応' && count(state) ? 'is-alert' : ''}><span>{state === '正常' ? '正常稼働' : state}</span><strong>{count(state)}{state === '正常' && <small> / {rows.length}</small>}</strong></div>)}
    </section>
    <section aria-label="発電所一覧">
      <div className="monitoring-heading"><h2>発電所</h2><span className="text-muted">{formatNumber(visible.length)}件を表示</span></div>
      <div className="monitoring-filters"><label className="monitoring-search"><span>発電所を検索</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="発電所名・所在地・監視システム" /></label><button className={`button button-${attentionOnly ? 'primary' : 'secondary'}`} aria-pressed={attentionOnly} onClick={() => setAttentionOnly(!attentionOnly)}>要確認・要対応のみ</button></div>
      <div className="monitoring-grid">{visible.map(({ site, monitor, openRepair, state, next }) => <article className="panel monitoring-card" key={site.siteId} data-testid="monitoring-row" data-state={state}>
        <div className="monitoring-card-top"><span>{site.area}</span><span className={`status status-${stateTone[state]}`}><i />{state}</span></div>
        <h3>{site.name}</h3><p className="text-muted">{site.monitoringSystem}</p>
        <div className="monitoring-output"><span>現在出力 / 容量</span><strong>{formatNumber(monitor.outputKw, 1)} / {formatQuantity(site.capacityKw, 'kW', 1)}</strong></div>
        <div className="monitoring-alert">{monitor.alert ? <><span className={state === '要対応' ? 'text-fail' : ''}>{monitor.alert}</span><small>{formatTime(monitor.alertAt!)} 受信</small></> : openRepair ? <><span>{openRepair.title}</span><small>修繕：{openRepair.status}</small></> : <span className="text-muted">アラームなし</span>}</div>
        <p className="monitoring-next">次回点検：{next ? <>{formatShortDate(next.scheduledOn, now)} · {next.status}</> : '予定なし'}</p>
        {monitor.alert && <button className="button button-primary" onClick={() => onRegisterIncident(monitor)}>不具合対応台帳へ</button>}<button className="button button-secondary" onClick={() => onOpenKarte(site.siteId)}>発電所カルテ</button>
      </article>)}</div>
      {!visible.length && <div className="panel empty-state" role="status">該当する発電所がありません。検索条件を変更してください。</div>}
    </section>
  </div>
}
