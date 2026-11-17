import { AlertCircle, Camera, Copy, ExternalLink, Image, Link2, ListChecks, RefreshCcw, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDateTime } from '../logic/format'
import type { SharedInspection } from '../services/sharedInspectionService'
import type { InspectionStatus } from '../types'
import { InspectionStatusChip } from './ui'

const statusLabels: Record<SharedInspection['status'], InspectionStatus> = { requested: '依頼済み', in_progress: '点検中', submitted: '提出済み' }

export function AssignmentModal({ token, shared, loading, error, onClose, onRefresh, onReset, onReport, fallback, children }: { token: string; shared: SharedInspection | null; loading: boolean; error: string; onClose: () => void; onRefresh: () => void; onReset: () => void; onReport?: () => void; fallback?: ReactNode; children?: ReactNode }) {
  const fieldUrl = token ? `${window.location.origin}/?field=${token}` : ''
  const status = shared ? statusLabels[shared.status] : null
  return <div className="modal-backdrop"><div className="assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-title" data-testid="assignment-modal"><header><div><h2 id="assignment-title">現場への点検依頼</h2>{shared?.plantName && <p>{shared.plantName}　{shared.requestTitle}</p>}</div><button onClick={onClose} aria-label="閉じる"><X /></button></header>
    {error && <div className="alert-fail"><AlertCircle />{error}</div>}
    {!shared && fallback}
    {loading && !shared ? <div className="assignment-loading"><RefreshCcw />依頼を作成しています…</div> : shared && status && <><section className="share-box"><div><Link2 /><span><strong>現場用URL</strong><small>このURLをスマホへ送ると、現場画面だけが開きます。</small></span></div><code>{fieldUrl}</code><div><button className="button button-secondary" onClick={() => { void navigator.clipboard.writeText(fieldUrl) }}><Copy />URLをコピー</button><button className="button button-secondary" onClick={() => { void navigator.clipboard.writeText(`${fieldUrl}&fill=1`) }} data-testid="copy-fill-url"><ListChecks />一括入力つきURLをコピー</button><a className="button button-primary" href={fieldUrl} target="_blank" rel="noreferrer"><ExternalLink />現場画面を開く</a></div><p className="share-note">一括入力つきURLは、開いた人が「残りを一括入力」で残りをまとめて埋められます。</p></section>
      <section className="submission-head"><div><InspectionStatusChip status={status} /><h3>現場の入力状況</h3><p>最終同期 {formatDateTime(shared.updatedAt)}</p></div><button className="button button-secondary" onClick={onRefresh} disabled={loading}><RefreshCcw />{loading ? '更新中' : '最新状態に更新'}</button></section>
      {children}
      <section className="admin-photo-section"><div><h3>現場写真</h3><span>撮影箇所にひも付けて保存</span></div>{shared.photos.length ? <div className="admin-photo-grid">{shared.photos.map(photo => <figure key={photo.photoId}><img src={photo.url} alt={photo.photoType} /><figcaption><strong>{photo.photoType}</strong><small>{formatDateTime(photo.takenAt)}</small></figcaption></figure>)}</div> : <div className="photo-empty"><Camera />現場から写真が届くとここに表示されます</div>}</section>
      <footer><span>{shared.status === 'submitted' ? '現場から点検結果が提出されました。' : '現場での入力内容は自動同期されます。'}</span><div>{shared.status === 'submitted' && <button className="button button-secondary" onClick={onReset} disabled={loading} data-testid="reset-inspection"><RefreshCcw />点検をやり直す</button>}{shared.status === 'submitted' && onReport && <button className="button button-primary" onClick={onReport} data-testid="make-report-from-field"><Image />写真を確認して報告書へ</button>}</div></footer></>}
  </div></div>
}
