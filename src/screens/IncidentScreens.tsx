import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { formatDateTime, formatNumber, formatShortDate } from '../logic/format'
import { toDateString } from '../logic/dates'
import { canCloseIncident, incidentDecisions, incidentStatus, preliminaryChecks } from '../logic/incidents'
import type { Incident, IncidentDecision, IncidentLogKind, IncidentSource, Inspection, RepairCase, Site } from '../types'

type Common = { sites: Site[]; inspections: Inspection[]; repairCases: RepairCase[] }
const tone = (status: string) => status === '対応完了' || status === '復旧済' ? 'green' : status === '未判断' ? 'red' : status === '経過観察' || status === '復旧済・未完了' ? 'amber' : 'blue'
const Status = ({ value }: { value: string }) => <span className={'status status-' + tone(value)}><i />{value}</span>

export function IncidentListScreen({ sites, inspections, repairCases, incidents, onOpen, onOpenRepair, onCreate }: Common & { incidents: Incident[]; onOpen: (id: string) => void; onOpenRepair: (id: string) => void; onCreate: (siteId: string, title: string, source: IncidentSource) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('未完了')
  const [adding, setAdding] = useState(false)
  const [siteId, setSiteId] = useState(sites[0]?.siteId ?? '')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState<IncidentSource>('オーナー連絡')
  const incidentRows = incidents.map(item => ({ id: item.id, siteId: item.siteId, title: item.title, source: item.source, at: item.occurredAt, status: incidentStatus(item, inspections, repairCases), assignee: item.assignee, due: item.dueOn, closed: !!item.closedAt, repair: false }))
  const repairRows = repairCases.filter(item => !inspections.some(visit => visit.inspectionId === item.inspectionId && visit.incidentId)).map(item => ({ id: item.caseId, siteId: item.siteId, title: item.title, source: '定期点検', at: inspections.find(visit => visit.inspectionId === item.inspectionId)?.scheduledOn ?? '', status: item.status, assignee: '', due: '', closed: item.status === '完了', repair: true }))
  const rows = [...incidentRows, ...repairRows].sort((a,b) => b.at.localeCompare(a.at))
  const visible = rows.filter(row => (filter === 'すべて' || (filter === '完了' ? row.closed : !row.closed)) && ((sites.find(site => site.siteId === row.siteId)?.name ?? '') + row.title + row.assignee + row.source).includes(query.trim()))
  return <div className="page" data-testid="incident-list">
    <div className="page-heading"><div><h1>不具合対応台帳</h1><p>遠隔監視・点検・お客様連絡から発生した不具合と対応を管理します。</p></div><button className="button button-primary" onClick={() => setAdding(!adding)}><Plus />案件登録</button></div>
    <section className="summary-strip"><div className={rows.some(row => row.status === '未判断') ? 'is-alert' : ''}><span>未判断</span><strong>{rows.filter(row => row.status === '未判断').length}</strong></div><div><span>未完了</span><strong>{rows.filter(row => !row.closed).length}</strong></div><div><span>期限超過</span><strong>{rows.filter(row => !row.closed && row.due && row.due < toDateString(new Date())).length}</strong></div><div><span>完了</span><strong>{rows.filter(row => row.closed).length}</strong></div></section>
    {adding && <section className="panel"><header className="panel-header"><h2>新規案件</h2></header><form className="repair-form" onSubmit={event => { event.preventDefault(); if (title.trim() && siteId) onCreate(siteId, title.trim(), source) }}>
      <label className="review-input">発電所<select value={siteId} onChange={event => setSiteId(event.target.value)}>{sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}</select></label>
      <label className="review-input">発生経路<select value={source} onChange={event => setSource(event.target.value as IncidentSource)}>{['オーナー連絡','遠隔監視','定期点検','その他'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="review-input">異常内容<input required value={title} onChange={event => setTitle(event.target.value)} /></label><button className="button button-primary" disabled={!title.trim() || !siteId}>登録する</button></form></section>}
    <div className="monitoring-filters"><label className="monitoring-search"><span>案件を検索</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="発電所・異常内容・担当者" /></label><label className="review-input">対応状況<select value={filter} onChange={event => setFilter(event.target.value)}>{['未完了','完了','すべて'].map(value => <option key={value}>{value}</option>)}</select></label></div>
    <section className="panel"><div className="schedule-table-scroll"><table className="data-table"><thead><tr>{['発生日','発電所・異常内容','発生経路','状態','担当者','期限'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id}><td>{row.at ? formatShortDate(row.at) : '—'}</td><td><button className="link-button" onClick={() => row.repair ? onOpenRepair(row.id) : onOpen(row.id)}>{sites.find(site => site.siteId === row.siteId)?.name ?? row.siteId}</button><small>{row.title}</small></td><td>{row.source}</td><td><Status value={row.status} /></td><td>{row.assignee || '—'}</td><td className={!row.closed && row.due && row.due < toDateString(new Date()) ? 'text-fail' : ''}>{row.due ? formatShortDate(row.due) : '—'}</td></tr>)}</tbody></table></div>{!visible.length && <p className="panel-empty">該当する案件はありません。</p>}</section>
  </div>
}

export function IncidentDetailScreen({ incident, site, inspections, repairCases, onUpdate, onLog, onSchedule, onOpenInspection, onOpenRepair, onBack, onOpenKarte }: { incident: Incident; site: Site; inspections: Inspection[]; repairCases: RepairCase[]; onUpdate: (patch: Partial<Incident>) => void; onLog: (kind: IncidentLogKind, text: string, patch?: Partial<Incident>) => void; onSchedule: (date: string, inspector: string, note: string) => void; onOpenInspection: (id: string) => void; onOpenRepair: (id: string) => void; onBack: () => void; onOpenKarte: () => void }) {
  const [decision, setDecision] = useState(incident.decision)
  const [reason, setReason] = useState(incident.reason)
  const [logKind, setLogKind] = useState<IncidentLogKind>('電話')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(toDateString(new Date()))
  const [inspector, setInspector] = useState(incident.assignee)
  const [instruction, setInstruction] = useState(incident.title + 'の原因確認')
  const [closeNote, setCloseNote] = useState('')
  const visits = inspections.filter(item => item.incidentId === incident.id)
  const repairs = repairCases.filter(item => visits.some(visit => visit.inspectionId === item.inspectionId))
  const closed = !!incident.closedAt
  return <div className="page" data-testid="incident-detail">
    <button className="back-button" onClick={onBack}><ArrowLeft />不具合対応台帳へ戻る</button>
    <div className="page-heading"><div><h1>{incident.title}</h1><p>{site.name} · {incident.source} · {formatDateTime(incident.occurredAt)}</p></div><div className="heading-actions"><Status value={incidentStatus(incident, inspections, repairCases)} /><button className="button button-secondary" onClick={onOpenKarte}>発電所カルテ</button></div></div>
    <div className="repair-layout"><section className="panel"><header className="panel-header"><h2>対応情報</h2></header><div className="repair-form">
      <p>オーナー：{site.owner} ／ {site.monitoringSystem}</p>
      <label className="review-input">担当者<input disabled={closed} value={incident.assignee} onChange={event => onUpdate({ assignee: event.target.value })} /></label>
      <label className="review-input">対応期限<input disabled={closed} type="date" value={incident.dueOn} onChange={event => onUpdate({ dueOn: event.target.value })} /></label>
      <label className="review-input">対応原価（税別・円）<input disabled={closed} type="number" min="0" step="1" value={incident.costYen ?? ''} onChange={event => { const value = event.target.value; if (!value || (Number.isSafeInteger(Number(value)) && Number(value) >= 0)) onUpdate({ costYen: value ? Number(value) : undefined }) }} /></label>
      {incident.costYen !== undefined && <small>原価：{formatNumber(incident.costYen)}円</small>}
      <p>設備復旧：{incident.recoveredAt ? formatDateTime(incident.recoveredAt) : '未記録'}</p>
      <p>電話：{incident.logs.filter(log => log.kind === '電話').length}件 ／ メール：{incident.logs.filter(log => log.kind === 'メール').length}件</p>
    </div></section>
    <section className="panel"><header className="panel-header"><h2>一次切り分け・対応判断</h2></header><div className="repair-form">
      <p>監視情報：{incident.title}</p>
      <p className="text-muted">原因は確定していません。確認すべき情報：</p><ul>{preliminaryChecks(incident.title).map(check => <li key={check}>{check}</li>)}</ul>
      <label className="review-input">対応方針<select disabled={closed} value={decision} onChange={event => setDecision(event.target.value as IncidentDecision)}>{incidentDecisions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="review-input">判断理由<textarea disabled={closed} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <button className="button button-primary" disabled={closed || decision === '未判断' || !reason.trim()} onClick={() => onLog('判断', decision + '：' + reason.trim(), { decision, reason: reason.trim() })}>対応判断を記録</button>
    </div></section></div>
    <section className="panel"><header className="panel-header"><h2>駆けつけ点検・修繕</h2></header><div className="repair-form">
      {visits.map(visit => <div key={visit.inspectionId} className="heading-actions"><span>{formatShortDate(visit.scheduledOn)}・{visit.inspector}・{visit.status}</span><button className="button button-secondary" onClick={() => onOpenInspection(visit.inspectionId)}>点検準備を開く</button></div>)}
      {repairs.map(repair => <div key={repair.caseId} className="heading-actions"><span>{repair.title}・{repair.status}</span><button className="button button-secondary" onClick={() => onOpenRepair(repair.caseId)}>修繕案件を開く</button></div>)}
      {!closed && incident.decision === '駆けつけ' && !visits.some(visit => visit.status !== '完了') && <form className="repair-form" onSubmit={event => { event.preventDefault(); onSchedule(date, inspector, instruction) }}>
        <label className="review-input">点検日<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className="review-input">現場担当者<input required value={inspector} onChange={event => setInspector(event.target.value)} /></label>
        <label className="review-input">重点確認・申し送り<textarea required value={instruction} onChange={event => setInstruction(event.target.value)} /></label>
        <button className="button button-primary" disabled={!date || !inspector.trim() || !instruction.trim()}>駆けつけ点検を作成</button>
      </form>}
      {!visits.length && incident.decision !== '駆けつけ' && <p className="text-muted">駆けつけを決定すると点検予定を作成できます。</p>}
    </div></section>
    <section className="panel"><header className="panel-header"><h2>対応履歴</h2></header><div className="repair-form">
      {!closed && <form className="repair-form" onSubmit={event => { event.preventDefault(); if (note.trim()) { onLog(logKind, note.trim()); setNote('') } }}>
        <label className="review-input">記録種別<select value={logKind} onChange={event => setLogKind(event.target.value as IncidentLogKind)}>{['電話','メール','作業','メモ'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="review-input">内容<textarea required value={note} onChange={event => setNote(event.target.value)} /></label>
        <button className="button button-secondary" disabled={!note.trim()}>履歴を追加</button></form>}
      {[...incident.logs].reverse().map(log => <div key={log.id} className="incident-log"><strong>{log.kind} · {log.by}</strong><small className="text-muted">{formatDateTime(log.at)}</small><p>{log.text}</p></div>)}
    </div></section>
    <section className="panel"><header className="panel-header"><h2>復旧・対応完了</h2></header><div className="repair-form">
      <label className="review-input">確認根拠・備考<textarea value={closeNote} onChange={event => setCloseNote(event.target.value)} /></label>
      <div className="heading-actions">
        {!closed && !incident.recoveredAt && <button className="button button-secondary" disabled={!closeNote.trim()} onClick={() => { onLog('復旧', closeNote.trim(), { recoveredAt: new Date().toISOString() }); setCloseNote('') }}>復旧を記録</button>}
        {!closed && <button className="button button-primary" disabled={!closeNote.trim() || !canCloseIncident(incident, inspections, repairCases)} onClick={() => { onLog('完了', closeNote.trim(), { closedAt: new Date().toISOString() }); setCloseNote('') }}>対応完了</button>}
        {closed && <button className="button button-secondary" disabled={!closeNote.trim()} onClick={() => { onLog('再開', closeNote.trim(), { closedAt: undefined, recoveredAt: undefined }); setCloseNote('') }}>案件を再開</button>}
      </div>
      {!closed && !canCloseIncident(incident, inspections, repairCases) && <p className="text-muted">対応方針・復旧確認（または対応不要・現状維持の判断）、関連する点検・修繕の完了が必要です。</p>}
    </div></section>
  </div>
}
