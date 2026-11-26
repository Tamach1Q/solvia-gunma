// avoid-ai-design-ignore: I3 アイコンはAGENTS.mdの指定でlucide-reactに統一している
import { ArrowLeft, CheckCircle2, FileSearch, Pencil, Printer, RotateCcw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { GunmaReportDocument } from '../components/GunmaReportDocument'
import { ReportRatingPanel } from '../components/Feedback'
import { PhotoPalette } from '../components/ReportPhotoLayout'
import { ReportWorkflowNotice } from '../components/ReportWorkflowNotice'
import { InspectionStatusChip, JudgementMark } from '../components/ui'
import { thresholdSource } from '../config/thresholds'
import { visualItemIds } from '../config/visualItems'
import { criterionText } from '../logic/criteria'
import { formatDateWithWeekday } from '../logic/format'
import { circuitLabel, measurementTitle, measurementValue } from '../logic/labels'
import { movePhoto } from '../logic/photoLayout'
import type { ReportProgress } from '../logic/reportWorkflow'
import type { Inspection, InspectionPhoto, MeasurementEntry, ReportReview, ReportZone, Site } from '../types'

const zoneLabels: Record<ReportZone, string> = { visual: '目視点検結果の下', measurement: '測定結果の下', findings: '異常箇所の詳細の下', ledger: '写真台帳' }

type ReportProps = {
  site: Site; inspection: Inspection; previous?: Inspection; photos: InspectionPhoto[]
  onChange: (patch: Partial<Inspection>) => void; onRegenerate: () => void; onOptions: (options: { boltTightenedOnSite: boolean }) => void
  onBack: () => void; onPhotos?: () => void; onComplete: () => void; createdRepairs: number; nextScheduledOn?: string; onOpenRepairs: () => void; onOpenKarte: () => void
  onSubmitForCheck?: () => void; review?: ReportReview; progress?: ReportProgress | null; canComplete?: boolean; onOpenSchedule?: () => void; readOnly?: boolean; backLabel?: string
}

export function ReportScreen({ site, inspection, previous, photos, onChange, onRegenerate, onOptions, onBack, onPhotos, onComplete, createdRepairs, nextScheduledOn, onOpenRepairs, onOpenKarte, onSubmitForCheck, review, progress = null, canComplete = false, onOpenSchedule, readOnly = false, backLabel }: ReportProps) {
  const [editing, setEditing] = useState(false)
  const text = inspection.reportText ?? { summary: '', proposals: [] }
  const header = inspection.reportHeader ?? { siteName: site.name, owner: site.owner }
  useEffect(() => { if (editing) { const editor = document.querySelector<HTMLElement>('[data-testid=report-editor]'); editor?.scrollIntoView({ block: 'start' }); editor?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }) } }, [editing])
  const layout = inspection.reportLayout ?? []
  const placedPhotos = layout.map(entry => photos.find(photo => photo.photoId === entry.photoId)).filter((photo): photo is InspectionPhoto => Boolean(photo))
  const completed = inspection.status === '完了'
  const locked = readOnly || ((completed || review?.status === 'チェック待ち' || review?.status === '承認済み') && progress !== '差し戻し' && progress !== '再提出待ち')
  const boltFailed = inspection.visual.some(entry => entry.itemId === visualItemIds.boltLoose && entry.result === '×')
  const move = (photoId: string, zone: ReportZone | null, beforeId?: string) => onChange({ reportLayout: movePhoto(layout, photoId, zone, beforeId) })
  const previousOf = (entry: MeasurementEntry) => previous?.measurements.find(item => item.key === entry.key)

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
    {!locked && onPhotos && <button className="button button-secondary no-print report-photo-review-link" onClick={onPhotos} data-testid="edit-report-photos">写真を確認・差し替え</button>}

    {!readOnly && <div className="report-command-area no-print">        <section className="panel report-command-panel">
          <h2>報告書の操作</h2>
          <div className="report-commandbar">
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
        <section className="panel report-format-panel">
          <h2>報告書の様式</h2>
          <div className="report-format-controls"><label>出力する様式<select aria-label="報告書の様式" disabled={locked} value={inspection.reportFormat ?? 'A'} onChange={event => onChange({ reportFormat: event.target.value as 'A' | 'B' })} data-testid="report-format"><option value="A">様式A：報告書＋写真台帳</option><option value="B">様式B：表紙＋写真付き点検結果</option></select></label>
          <label>提出先（元請）<input disabled={locked} value={inspection.reportContractor ?? ''} placeholder="会社名" onChange={event => onChange({ reportContractor: event.target.value })} /></label>
          <label>案件番号<input disabled={locked} value={inspection.reportCaseNo ?? ''} placeholder="案件番号" onChange={event => onChange({ reportCaseNo: event.target.value })} /></label>
          <p className="text-muted">同じ点検結果から写真を自動配置します。提出後は様式と内容が固定されます。</p></div>
        </section>

      {editing && !locked && <section className="panel report-editor" data-testid="report-editor"><h2>文章・宛名の編集</h2><div className="report-editor-fields">
        <label className="review-input"><span>報告書の発電所名</span><input value={header.siteName} onChange={event => onChange({ reportHeader: { ...header, siteName: event.target.value } })} /></label>
        <label className="review-input"><span>報告書のオーナー名</span><input value={header.owner} onChange={event => onChange({ reportHeader: { ...header, owner: event.target.value } })} /></label>
        <label className="review-input"><span>総合所見</span><textarea value={text.summary} onChange={event => onChange({ reportText: { ...text, summary: event.target.value } })} /></label>
        {text.proposals.map((proposal, index) => <label className="review-input" key={index}><span>ご提案 {index + 1}</span><textarea value={proposal} onChange={event => onChange({ reportText: { ...text, proposals: text.proposals.map((value, i) => i === index ? event.target.value : value) } })} /></label>)}
        <button className="button button-primary" onClick={() => setEditing(false)}>編集を終えてプレビューを見る</button>
      </div></section>}
    </div>}
    {readOnly && <button className="button button-secondary no-print" onClick={() => window.print()}><Printer />印刷／PDF保存</button>}

    <div className="report-layout">
      <article className="report-document" data-testid="report-document">
        <GunmaReportDocument site={site} inspection={inspection} previous={previous} photos={photos} editing={false} onChange={onChange} measurement={inspection.measurements.length ? <>
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
        </ReportSection>

        </> : undefined} />
      </article>

      {!readOnly && <aside className="report-tools no-print">
        {!locked && <section className="panel">
          <details className="report-photo-editor"><summary>写真の掲載と順番（{placedPhotos.length}枚）</summary>
          <div className="report-palette"><PhotoPalette photos={placedPhotos} layout={layout} zoneLabels={zoneLabels} onMove={move} onReorder={ids => onChange({ reportLayout: ids.map(id => layout.find(entry => entry.photoId === id)!) })} /></div></details>
        </section>}
      </aside>}
    </div>
    {!readOnly && locked && <div className="no-print"><ReportRatingPanel inspectionId={inspection.inspectionId} /></div>}
  </div>
}

function ReportSection({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return <section className={`report-section ${className}`}><h2>{title}</h2>{children}</section>
}
