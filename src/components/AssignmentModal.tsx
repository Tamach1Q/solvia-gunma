import { AlertCircle, Copy, ExternalLink, FileText, RefreshCcw, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatDateTime, formatDateWithWeekday } from '../logic/format'
import type { SharedInspection } from '../services/sharedInspectionService'
import type { InspectionStatus } from '../types'
import { InspectionStatusChip } from './ui'

const statusLabels: Record<SharedInspection['status'], InspectionStatus> = { requested: '依頼済み', in_progress: '点検中', submitted: '提出済み' }

type AssignmentProps = {
  token: string; plantName: string; scheduledOn: string; shared: SharedInspection | null; loading: boolean; error: string
  onClose: () => void; onRefresh: () => void; onReset: () => void; onReport: () => void; fallback?: ReactNode; children?: ReactNode
}

export function AssignmentModal({ token, plantName, scheduledOn, shared, loading, error, onClose, onRefresh, onReset, onReport, fallback, children }: AssignmentProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  const [copyNotice, setCopyNotice] = useState('')
  const [manualCopy, setManualCopy] = useState('')
  const fieldUrl = token ? `${window.location.origin}/?field=${token}` : ''
  const date = formatDateWithWeekday(scheduledOn)
  const message = `${plantName}の定期点検をお願いします。\n点検予定日：${date}\n当日は下のリンクから点検結果と写真を入力してください。\n${fieldUrl}`
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setManualCopy('')
      setCopyNotice(`${label}をコピーしました。`)
    } catch {
      setManualCopy(value)
      setCopyNotice('下の欄からコピーしてください。')
    }
  }
  const visualDone = shared?.visual.filter(entry => entry.result).length ?? 0

  return <dialog ref={dialogRef} className="assignment-modal no-print" aria-labelledby="assignment-title" data-testid="assignment-modal" onCancel={event => { event.preventDefault(); onClose() }}>
    <header><div><h2 id="assignment-title">現場に点検を共有</h2><p>{plantName}・{date}</p></div><button onClick={onClose} aria-label="閉じる"><X /></button></header>
    {error && <div className="alert-fail"><AlertCircle />{error}</div>}
    {!shared && fallback}
    {loading && !shared && <div className="assignment-loading"><RefreshCcw />現場用リンクを準備しています…</div>}
    {shared && fieldUrl && <>
      {shared.status !== 'submitted' && <section className="share-box">
        <p>依頼文をコピーして、普段お使いのメールやチャットで現場の担当者に送ってください。</p>
        <div className="assignment-actions">
          <button className="button button-primary" onClick={() => void copy(message, '依頼文とリンク')}><Copy />依頼文とリンクをコピー</button>
          <a className="button button-secondary" href={fieldUrl} target="_blank" rel="noreferrer"><ExternalLink />現場画面を開く</a>
        </div>
      </section>}
      <section className="submission-head">
        <div><InspectionStatusChip status={statusLabels[shared.status]} /><h3>目視点検 {visualDone} / {shared.visual.length}項目</h3><p>最終同期 {formatDateTime(shared.updatedAt)}</p></div>
        {shared.status === 'submitted' && <button className="button button-primary" onClick={onReport} data-testid="make-report-from-field"><FileText />報告書を作成</button>}
      </section>
      <details className="assignment-options">
        <summary>その他の操作</summary>
        <div className="assignment-actions">
          <button className="button button-secondary" onClick={onRefresh} disabled={loading}><RefreshCcw />{loading ? '更新中' : '最新状態に更新'}</button>
          <button className="button button-secondary" onClick={() => void copy(fieldUrl, '現場用リンク')}>リンクのみコピー</button>
          <button className="button button-secondary" onClick={() => void copy(`${fieldUrl}&fill=1`, '一括入力つきリンク')} data-testid="copy-fill-url">一括入力つきリンクをコピー</button>
          {shared.status === 'submitted' && <button className="button button-secondary" onClick={onReset} disabled={loading} data-testid="reset-inspection">点検をやり直す</button>}
        </div>
        {children}
      </details>
      <div className="assignment-copy-feedback">
        {copyNotice && <p role="status">{copyNotice}</p>}
        {manualCopy && <textarea aria-label="共有する内容" readOnly rows={4} value={manualCopy} onFocus={event => event.target.select()} />}
      </div>
      {shared.photos.length > 0 && <details className="assignment-options">
        <summary>現場写真（{shared.photos.length}枚）</summary>
        <div className="admin-photo-grid">{shared.photos.map(photo => <figure key={photo.photoId}><img src={photo.url} alt={photo.photoType} /><figcaption><strong>{photo.photoType}</strong><small>{formatDateTime(photo.takenAt)}</small></figcaption></figure>)}</div>
      </details>}
    </>}
  </dialog>
}
