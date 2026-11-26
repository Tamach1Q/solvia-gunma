// avoid-ai-design-ignore: I3 アイコンはAGENTS.mdの指定でlucide-reactに統一している
import { ArrowLeft, Camera, Check } from 'lucide-react'
import { useState } from 'react'
import { JudgementMark, StatusChip, VisualResultMark } from '../components/ui'
import { measurementUnits } from '../config/thresholds'
import { criterionText } from '../logic/criteria'
import { toDateString } from '../logic/dates'
import { formatDate, formatShortDate } from '../logic/format'
import { circuitLabel, measurementValue } from '../logic/labels'
import { reportIssues } from '../logic/report'
import { completeRepair, decideRepair, judgeRemeasure, remeasureTarget, repairRefKey, repairResult, repairSteps, scheduleRepair } from '../logic/repairs'
import { repairTone } from '../logic/status'
import type { Inspection, InspectionPhoto, RepairCase, RepairDecision, Site } from '../types'

const decisions: RepairDecision[] = ['交換', '修理', '経過観察', 'その他（作業実施）']

export function RepairListScreen({ sites, inspections, repairCases, onOpen }: { sites: Site[]; inspections: Inspection[]; repairCases: RepairCase[]; onOpen: (caseId: string) => void }) {
  const order = (repair: RepairCase) => repairSteps.indexOf(repair.status)
  const rows = [...repairCases].sort((a, b) => order(a) - order(b) || b.caseId.localeCompare(a.caseId))
  return <div className="page" data-testid="repairs-screen">
    <div className="page-heading"><div><h1>修繕案件</h1><p>点検で見つかった指摘を、お客様の確認から作業完了まで伴走します。</p></div></div>
    <section className="summary-strip" aria-label="修繕案件の状況">
      {repairSteps.map(step => <div key={step} className={step === 'お客様確認中' && repairCases.some(item => item.status === step) ? 'is-alert' : ''}><span>{step}</span><strong>{repairCases.filter(item => item.status === step).length}</strong></div>)}
    </section>
    <section className="panel">
      {rows.length ? <table className="data-table mobile-record-table">
        <thead><tr><th>指摘</th><th>発電所</th><th>点検日</th><th>お客様の回答</th><th>状態</th></tr></thead>
        <tbody>{rows.map(repair => {
          const inspection = inspections.find(item => item.inspectionId === repair.inspectionId)
          return <tr key={repair.caseId} data-testid="repair-row">
            <td data-label="指摘"><button className="link-button" onClick={() => onOpen(repair.caseId)}>{repair.title}</button></td>
            <td data-label="発電所">{sites.find(site => site.siteId === repair.siteId)?.name}</td>
            <td data-label="点検日" className="numeric-cell">{inspection ? formatShortDate(inspection.inspectedOn ?? inspection.scheduledOn) : '—'}</td>
            <td data-label="お客様の回答">{repair.customerDecision ?? <span className="text-muted">未回答</span>}</td>
            <td data-label="状態"><StatusChip label={repairResult(repair)} tone={repairTone(repairResult(repair))} /></td>
          </tr>
        })}</tbody>
      </table> : <p className="panel-empty">修繕案件はありません。点検を完了すると、不適合と目視の×から自動で作られます。</p>}
    </section>
  </div>
}

export function RepairDetailScreen({ repair, site, inspection, photos, onChange, onUploadPhoto, onBack, onOpenKarte }: { repair: RepairCase; site: Site; inspection: Inspection; photos: InspectionPhoto[]; onChange: (repair: RepairCase) => void; onUploadPhoto: (file: File, label: string) => Promise<InspectionPhoto>; onBack: () => void; onOpenKarte: () => void }) {
  const refKey = repairRefKey(repair, inspection)
  const issue = reportIssues(inspection, site).find(item => item.key === refKey)
  const findingPhotos = inspection.findings.filter(finding => finding.refKey === refKey).flatMap(finding => finding.photoIds)
  const visualPhotos = inspection.visual.find(entry => entry.itemId === refKey)?.photoIds ?? []
  const beforePhotos = [...new Set([...visualPhotos, ...findingPhotos])].map(id => photos.find(photo => photo.photoId === id)).filter((photo): photo is InspectionPhoto => Boolean(photo))
  const afterPhotos = repair.afterPhotoIds.map(id => photos.find(photo => photo.photoId === id)).filter((photo): photo is InspectionPhoto => Boolean(photo))
  const target = remeasureTarget(repair, inspection, site)
  const result = repairResult(repair)
  const stepIndex = repairSteps.indexOf(repair.status)

  return <div className="page" data-testid="repair-detail">
    <button className="back-button" onClick={onBack}><ArrowLeft />修繕案件の一覧へ戻る</button>
    <div className="page-heading"><div><h1>{repair.title}</h1><p>{site.name}・{formatDate(inspection.inspectedOn ?? inspection.scheduledOn)}の点検で指摘</p></div><div className="heading-actions"><StatusChip label={result} tone={repairTone(result)} /><button className="button button-secondary" onClick={onOpenKarte} data-testid="repair-open-karte">発電所カルテ</button></div></div>
    <ol className="step-list" aria-label="修繕の進み具合">{repairSteps.map((step, index) => <li key={step} className={index < stepIndex || repair.status === '完了' ? 'is-done' : index === stepIndex ? 'is-current' : ''} aria-current={index === stepIndex ? 'step' : undefined}>{index < stepIndex || repair.status === '完了' ? <Check size={16} /> : null}{step}</li>)}</ol>

    <div className="repair-layout">
      <section className="panel">
        <header className="panel-header"><h2>指摘の内容</h2></header>
        <div className="repair-issue">
          {issue && <p className="repair-issue-head">{issue.mark === '×' || issue.mark === '△' ? <VisualResultMark result={issue.mark} /> : <JudgementMark judgement={issue.mark} />}<strong>{issue.title}</strong>{issue.value && <span className="numeric text-fail">{issue.value}</span>}</p>}
          {issue?.detail && <p>{issue.detail}</p>}
          {issue?.location && <p>異常箇所：{issue.location}</p>}
          {beforePhotos.length > 0 && <div className="repair-photos">{beforePhotos.map(photo => <figure key={photo.photoId}><img src={photo.url} alt={photo.photoType} /><figcaption>点検時：{photo.photoType}</figcaption></figure>)}</div>}
        </div>
      </section>

      <section className="panel" data-testid="repair-action">
        <header className="panel-header"><h2>{{ お客様確認中: 'お客様の回答を記録', 対応決定: '対応の準備', 作業予定: '作業の記録', 完了: '対応の記録' }[repair.status]}</h2></header>
        <div className="repair-form">
          {repair.status === 'お客様確認中' && <DecisionForm onDecide={(decision, decidedOn) => onChange(decideRepair(repair, decision, decidedOn))} />}
          {repair.status === '対応決定' && <>
            <p>お客様の回答：<strong>{repair.customerDecision}</strong>（{formatDate(repair.decidedOn!)}）</p>
            {repair.customerDecision === '経過観察'
              ? <button className="button button-primary" onClick={() => onChange(completeRepair(repair, { workNote: '経過観察（次回点検で確認）', afterPhotoIds: [] }))} data-testid="repair-observe">経過観察として完了にする</button>
              : <button className="button button-primary" onClick={() => onChange(scheduleRepair(repair))} data-testid="repair-schedule">作業予定にする</button>}
          </>}
          {repair.status === '作業予定' && <WorkForm repair={repair} site={site} inspection={inspection} target={target} photos={photos} onUploadPhoto={onUploadPhoto} onComplete={onChange} />}
          {repair.status === '完了' && <dl className="info-list repair-record">
            <div><dt>お客様の回答</dt><dd>{repair.customerDecision}{repair.decidedOn && `（${formatDate(repair.decidedOn)}）`}</dd></div>
            <div><dt>作業内容</dt><dd>{repair.workNote}</dd></div>
            {repair.remeasure && <div><dt>再測定</dt><dd className="numeric">{circuitLabel(repair.remeasure.circuitId ?? '')} {measurementValue(repair.remeasure)} <JudgementMark judgement={repair.remeasure.judgement} /></dd></div>}
            {afterPhotos.length > 0 && <div><dt>作業後の写真</dt><dd><div className="repair-photos">{afterPhotos.map(photo => <figure key={photo.photoId}><img src={photo.url} alt={photo.photoType} /></figure>)}</div></dd></div>}
          </dl>}
        </div>
      </section>
    </div>
  </div>
}

function DecisionForm({ onDecide }: { onDecide: (decision: RepairDecision, decidedOn: string) => void }) {
  const [decision, setDecision] = useState<RepairCase['customerDecision']>()
  const [decidedOn, setDecidedOn] = useState(toDateString(new Date()))
  return <>
    <fieldset className="choice-group"><legend>お客様の回答</legend>{decisions.map(item => <label key={item} className={`choice ${decision === item ? 'is-active' : ''}`}><input type="radio" name="decision" value={item} checked={decision === item} onChange={() => setDecision(item)} />{item}</label>)}</fieldset>
    <label className="form-row"><span>回答日</span><input type="date" value={decidedOn} onChange={event => setDecidedOn(event.target.value)} /></label>
    <button className="button button-primary" disabled={!decision || !decidedOn} onClick={() => decision && onDecide(decision, decidedOn)} data-testid="repair-decide">対応を決定する</button>
  </>
}

function WorkForm({ repair, site, inspection, target, photos, onUploadPhoto, onComplete }: { repair: RepairCase; site: Site; inspection: Inspection; target?: ReturnType<typeof remeasureTarget>; photos: InspectionPhoto[]; onUploadPhoto: (file: File, label: string) => Promise<InspectionPhoto>; onComplete: (repair: RepairCase) => void }) {
  const [workNote, setWorkNote] = useState('')
  const [photoIds, setPhotoIds] = useState(repair.afterPhotoIds)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')
  const remeasure = target && raw.trim() ? judgeRemeasure(raw, target, inspection, site) : undefined
  // 完了するまでは、このフォームで選んだ写真（photoIds）を表示する
  const shownPhotos = photos.filter(photo => photoIds.includes(photo.photoId))
  return <>
    <label className="form-row form-row-stack"><span>作業内容（必須）</span><textarea value={workNote} onChange={event => setWorkNote(event.target.value)} placeholder="例：アレイB 1段目5列目のモジュールを交換" data-testid="repair-work-note" /></label>
    <div className="form-row form-row-stack"><span>作業後の写真</span>
      {shownPhotos.length > 0 && <div className="repair-photos">{shownPhotos.map(photo => <figure key={photo.photoId}><img src={photo.url} alt={photo.photoType} /></figure>)}</div>}
      <label className="button button-secondary file-button"><Camera />{photoIds.length ? '写真を追加' : '写真を選ぶ'}<input className="file-input-accessible" aria-label="作業後の写真を追加" type="file" accept="image/*" capture="environment" data-testid="repair-photo" onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void onUploadPhoto(file, `作業後：${repair.title}`).then(photo => setPhotoIds(current => [...current, photo.photoId])).catch(reason => setError(reason instanceof Error ? reason.message : '写真を保存できませんでした'))
      }} /></label>
    </div>
    {target && <div className="form-row form-row-stack"><span>再測定（任意）：{circuitLabel(target.circuitId ?? '')} 絶縁抵抗（DC）</span>
      <div className="remeasure-input"><input type="text" inputMode="decimal" value={raw} onChange={event => setRaw(event.target.value)} aria-label="再測定値" data-testid="repair-remeasure" /><span>{measurementUnits[target.kind]}</span>{remeasure && <JudgementMark judgement={remeasure.judgement} />}</div>
      <small className="text-muted">基準 {criterionText(target, site, inspection.measurements)}／点検時 {measurementValue(target)}</small>
    </div>}
    {error && <p className="alert-fail">{error}</p>}
    <button className="button button-primary" disabled={!workNote.trim() || (remeasure?.judgement === '未入力')} onClick={() => onComplete(completeRepair(repair, { workNote: workNote.trim(), afterPhotoIds: photoIds, remeasure }))} data-testid="repair-complete">作業完了にする</button>
  </>
}
