// avoid-ai-design-ignore: I3 アイコンはAGENTS.mdの指定でlucide-reactに統一している
import { ArrowLeft, CheckCircle2, FileSearch, Pencil, Printer, RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ArrayDiagram } from '../components/ArrayDiagram'
import { PhotoDropZone, PhotoPalette } from '../components/ReportPhotoLayout'
import { ReportWorkflowNotice } from '../components/ReportWorkflowNotice'
import { InspectionStatusChip, JudgementMark, VisualResultMark } from '../components/ui'
import { VisualIcon } from '../components/VisualIcon'
import { brand } from '../config/brand'
import { thresholdSource } from '../config/thresholds'
import { visualCategories, visualItemIds, visualItems } from '../config/visualItems'
import { criterionText } from '../logic/criteria'
import { formatDate, formatDateWithWeekday } from '../logic/format'
import { circuitLabel, measurementTitle, measurementValue, panelLocation } from '../logic/labels'
import { movePhoto } from '../logic/photoLayout'
import { groupFindings, overallCounts } from '../logic/report'
import { findCircuit } from '../logic/site'
import type { ReportProgress } from '../logic/reportWorkflow'
import type { Inspection, InspectionPhoto, MeasurementEntry, ReportReview, ReportZone, Site } from '../types'

const zoneLabels: Record<ReportZone, string> = { visual: '目視点検結果の下', measurement: '測定結果の下', findings: '異常箇所の詳細の下', ledger: '写真台帳' }

type ReportProps = {
  site: Site; inspection: Inspection; previous?: Inspection; photos: InspectionPhoto[]
  onChange: (patch: Partial<Inspection>) => void; onRegenerate: () => void; onOptions: (options: { boltTightenedOnSite: boolean }) => void
  onBack: () => void; onComplete: () => void; createdRepairs: number; nextScheduledOn?: string; onOpenRepairs: () => void; onOpenKarte: () => void
  onSubmitForCheck?: () => void; review?: ReportReview; progress?: ReportProgress | null; canComplete?: boolean; onOpenSchedule?: () => void; readOnly?: boolean; backLabel?: string
}

export function ReportScreen({ site, inspection, previous, photos, onChange, onRegenerate, onOptions, onBack, onComplete, createdRepairs, nextScheduledOn, onOpenRepairs, onOpenKarte, onSubmitForCheck, review, progress = null, canComplete = false, onOpenSchedule, readOnly = false, backLabel }: ReportProps) {
  const [editing, setEditing] = useState(false)
  const text = inspection.reportText ?? { summary: '', proposals: [] }
  const layout = inspection.reportLayout ?? []
  const placedPhotos = layout.map(entry => photos.find(photo => photo.photoId === entry.photoId)).filter((photo): photo is InspectionPhoto => Boolean(photo))
  const counts = overallCounts(inspection)
  const completed = inspection.status === '完了'
  const locked = readOnly || ((completed || review?.status === 'チェック待ち' || review?.status === '承認済み') && progress !== '差し戻し' && progress !== '再提出待ち')
  const header = inspection.reportHeader ?? { siteName: site.name, owner: site.owner }
  const boltFailed = inspection.visual.some(entry => entry.itemId === visualItemIds.boltLoose && entry.result === '×')
  const move = (photoId: string, zone: ReportZone | null, beforeId?: string) => onChange({ reportLayout: movePhoto(layout, photoId, zone, beforeId) })
  const zone = (name: ReportZone) => locked ? <div className="review-report-photos">{layout.filter(entry => entry.zone === name).map(entry => {
    const photo = photos.find(item => item.photoId === entry.photoId)
    return photo?.url ? <figure className="report-image-block" key={entry.photoId}><img src={photo.url} alt={photo.photoType} /><figcaption>{photo.photoType}</figcaption></figure> : null
  })}</div> : <PhotoDropZone zone={name} label={zoneLabels[name]} layout={layout} photos={placedPhotos} onMove={move} />
  const previousOf = (entry: MeasurementEntry) => previous?.measurements.find(item => item.key === entry.key)
  const findingTitle = (refKey: string) => {
    const entry = inspection.measurements.find(item => item.key === refKey)
    return visualItems.find(item => item.itemId === refKey)?.title ?? (entry ? measurementTitle(entry) : refKey)
  }

  const measurementRows = (entries: MeasurementEntry[]) => entries.map(entry => {
    const before = previousOf(entry)
    return <tr key={entry.key} className={`is-${entry.judgement}`}>
      <td>{measurementTitle(entry).replace(/^(PCS-\d+ 回路\d+|PCS-\d+|発電所) /, '')}</td>
      <td>{criterionText(entry, site, inspection.measurements)}</td>
      <td className="numeric">{before?.raw ? measurementValue(before) : '—'}</td>
      <td className="numeric report-value">{measurementValue(entry)}</td>
      <td><JudgementMark judgement={entry.judgement} />{entry.caution && <small className="text-caution">{entry.caution}</small>}</td>
    </tr>
  })

  return <div className={`page report-page ${readOnly ? 'review-report-readonly' : ''}`} data-testid="report-screen">
    <button className="back-button no-print" onClick={onBack}><ArrowLeft />{backLabel ?? (readOnly ? '報告書チェックへ戻る' : '写真確認へ戻る')}</button>
    <div className="page-heading no-print"><div><h1>点検報告書</h1><p>{readOnly ? 'チェック対象の報告書全体を確認します。' : locked ? '提出した報告書とチェック状況を確認します。承認後に点検を完了できます。' : '宛名・文章・写真の配置を整え、報告書チェックに提出してください。'}</p></div>{!readOnly && <InspectionStatusChip status={inspection.status} />}</div>
    {!readOnly && <ReportWorkflowNotice progress={progress} review={review} completed={completed} onOpen={review ? onSubmitForCheck : undefined} />}

    <div className="report-layout">
      <article className="report-document" data-testid="report-document">
        <section className="report-cover">
          <p className="report-issuer">{brand.companyName}</p>
          <h1>太陽光発電設備 定期点検報告書</h1>
          {editing && !locked ? <div className="report-header-editor"><label className="review-input"><span>報告書の発電所名</span><input value={header.siteName} onChange={event => onChange({ reportHeader: { ...header, siteName: event.target.value } })} /></label><label className="review-input"><span>報告書のオーナー名</span><input value={header.owner} onChange={event => onChange({ reportHeader: { ...header, owner: event.target.value } })} /></label></div> : <><p className="report-site">{header.siteName}</p><p className="report-owner">{header.owner} 様</p></>}
          <dl className="report-facts">
            <div><dt>点検日</dt><dd>{formatDateWithWeekday(inspection.inspectedOn ?? inspection.scheduledOn)}</dd></div>
            <div><dt>所在地</dt><dd>{site.address}</dd></div>
            <div><dt>点検者</dt><dd>{inspection.inspector}</dd></div>
            <div><dt>天候</dt><dd>{inspection.weather ?? '—'}</dd></div>
            <div><dt>発行者</dt><dd>{brand.companyName}</dd></div>
            <div><dt>発行日</dt><dd>{formatDate(new Date())}</dd></div>
          </dl>
        </section>

        <ReportSection title="1. 総合判定">
          <dl className="report-counts">
            <div><dt>点検項目</dt><dd>{counts.total}</dd></div>
            <div><dt>適合</dt><dd>{counts.ok}</dd></div>
            <div className={counts.needsAction ? 'is-fail' : ''}><dt>要対応</dt><dd>{counts.needsAction}</dd></div>
            <div className={counts.caution ? 'is-caution' : ''}><dt>要確認</dt><dd>{counts.caution}</dd></div>
          </dl>
          {editing ? <textarea className="report-textarea" aria-label="総合所見" value={text.summary} onChange={event => onChange({ reportText: { ...text, summary: event.target.value } })} /> : <p className="report-text" data-testid="report-summary">{text.summary}</p>}
          <h3>ご提案事項</h3>
          {text.proposals.length ? <ol className="report-proposals" data-testid="report-proposals">{text.proposals.map((proposal, index) => <li key={index}>{editing ? <textarea className="report-textarea" aria-label={`ご提案 ${index + 1}`} value={proposal} onChange={event => onChange({ reportText: { ...text, proposals: text.proposals.map((item, itemIndex) => itemIndex === index ? event.target.value : item) } })} /> : proposal}</li>)}</ol> : <p className="report-text">今回の点検では、ご対応をお願いする事項はありません。</p>}
        </ReportSection>

        <ReportSection title="2. 目視点検結果">
          {visualCategories.map(category => <table key={category} className="report-table report-visual">
            <caption>{category}</caption>
            <thead><tr><th colSpan={2}>項目</th><th>確認内容</th><th>判定</th><th>コメント</th></tr></thead>
            <tbody>{visualItems.filter(item => item.category === category).map(item => {
              const entry = inspection.visual.find(visual => visual.itemId === item.itemId)
              return <tr key={item.itemId} className={entry?.result === '×' ? 'is-不適合' : ''}><td className="report-icon"><VisualIcon icon={item.icon} size={20} /></td><td>{item.title}</td><td>{item.criterion}</td><td><VisualResultMark result={entry?.result ?? null} /></td><td>{entry?.comment || ''}</td></tr>
            })}</tbody>
          </table>)}
          {zone('visual')}
        </ReportSection>

        <ReportSection title="3. 測定結果">
          {site.pcs.map(pcs => <table key={pcs.pcsId} className="report-table report-measure">
            <caption>{pcs.pcsId}（{pcs.maker} {pcs.model}）</caption>
            <thead><tr><th>項目</th><th>基準値</th><th className="numeric">前回値</th><th className="numeric">今回値</th><th>判定</th></tr></thead>
            {pcs.circuits.map(circuit => <tbody key={circuit.circuitId}><tr className="report-subhead"><th colSpan={5}>{circuitLabel(circuit.circuitId)}</th></tr>{measurementRows(inspection.measurements.filter(entry => entry.circuitId === circuit.circuitId))}</tbody>)}
            <tbody><tr className="report-subhead"><th colSpan={5}>PCS本体・系統</th></tr>{measurementRows(inspection.measurements.filter(entry => entry.pcsId === pcs.pcsId && !entry.circuitId))}</tbody>
          </table>)}
          <table className="report-table">
            <caption>架台</caption>
            <thead><tr><th>項目</th><th>基準値</th><th className="numeric">前回値</th><th className="numeric">今回値</th><th>判定</th></tr></thead>
            <tbody>{measurementRows(inspection.measurements.filter(entry => !entry.pcsId))}</tbody>
          </table>
          <p className="report-note">判定基準：{thresholdSource}</p>
          {zone('measurement')}
        </ReportSection>

        <ReportSection title="4. 異常箇所の詳細">
          {inspection.findings.length ? groupFindings(inspection.findings).map(group => {
            const [first] = group
            const array = site.arrays.find(item => item.arrayId === first.arrayId)
            const circuit = findCircuit(site, first.circuitId)
            return <div key={first.findingId} className="report-finding" data-testid="report-finding">
              <h3>{group.map(finding => findingTitle(finding.refKey)).join('／')}</h3>
              <p className="report-finding-place">{[panelLocation(site, first.arrayId, first.panels), first.circuitId && circuitLabel(first.circuitId)].filter(Boolean).join('・') || '場所の指定なし'}</p>
              {group.filter(finding => finding.comment).map(finding => <p key={finding.findingId} className="report-text">{group.length > 1 && <strong>{findingTitle(finding.refKey)}：</strong>}{finding.comment}</p>)}
              {array && <ArrayDiagram array={array} selected={first.panels} highlightRows={circuit?.arrayId === array.arrayId ? circuit.rows : []} compact />}
            </div>
          }) : <p className="report-text">異常箇所はありません。</p>}
          {zone('findings')}
        </ReportSection>

        <ReportSection title="5. 写真台帳" className={`report-ledger ${layout.some(entry => entry.zone === 'ledger') ? '' : 'is-empty'}`}>{zone('ledger')}</ReportSection>
      </article>

      {!readOnly && <aside className="report-tools no-print">
        <section className="panel">
          <h2>報告書の操作</h2>
          <div className="report-actions">
            <button className="button button-secondary" disabled={locked} onClick={() => setEditing(!editing)} data-testid="edit-report"><Pencil />{editing ? '編集を終える' : '文章・宛名を編集'}</button>
            <button className="button button-ghost" disabled={locked} onClick={() => { if (window.confirm('編集した文章を破棄して、入力データから作り直しますか？')) onRegenerate() }}><RotateCcw />文章を作り直す</button>
            {boltFailed && <label className="report-option"><input type="checkbox" disabled={locked} checked={inspection.reportOptions?.boltTightenedOnSite ?? false} onChange={event => onOptions({ boltTightenedOnSite: event.target.checked })} />架台ボルトは当日増し締め済み</label>}
            <button className="button button-secondary" onClick={() => window.print()} data-testid="print-report"><Printer />印刷／PDF保存</button>
            {onSubmitForCheck && <button className={`button button-${!locked && !canComplete ? 'primary' : 'secondary'}`} onClick={onSubmitForCheck} data-testid="submit-report-check"><FileSearch />{progress === '差し戻し' || progress === '再提出待ち' ? '修正内容を再提出' : review ? '報告書のチェック状況を開く' : '報告書チェックに提出'}</button>}
            <button className={`button button-${canComplete && !completed ? 'primary' : 'secondary'}`} disabled={completed || !canComplete} onClick={onComplete} data-testid="complete-inspection"><CheckCircle2 />{completed ? '点検は完了しています' : '点検を完了する'}</button>
            {!completed && !canComplete && <p className="report-completion-hint">報告書チェックで承認されると、点検を完了できます。</p>}
            {onOpenSchedule && <button className="button button-ghost" onClick={onOpenSchedule} data-testid="report-open-schedule">点検予定で状態を見る</button>}
          </div>
          {completed && <div className="report-next" data-testid="report-next">
            <p>{createdRepairs ? `修繕案件を${createdRepairs}件作成しました。` : '修繕が必要な指摘はありませんでした。'}{nextScheduledOn && `次回点検（${formatDateWithWeekday(nextScheduledOn)}）を予定に追加しました。`}</p>
            {createdRepairs > 0 && <button className="button button-secondary" onClick={onOpenRepairs} data-testid="open-repairs">修繕案件を開く</button>}
            <button className="button button-secondary" onClick={onOpenKarte} data-testid="open-karte">発電所カルテを開く</button>
          </div>}
        </section>
        {!locked && <section className="panel">
          <h2>写真</h2>
          <div className="report-palette"><PhotoPalette photos={placedPhotos} layout={layout} zoneLabels={zoneLabels} /></div>
        </section>}
      </aside>}
    </div>
  </div>
}

function ReportSection({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return <section className={`report-section ${className}`}><h2>{title}</h2>{children}</section>
}
