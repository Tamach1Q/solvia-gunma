// avoid-ai-design-ignore: I3 アイコンはAGENTS.mdの指定でlucide-reactに統一している
import { AlertCircle, ArrowLeft, Check, Image, RefreshCcw, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { formatDateTime } from '../logic/format'
import type { InspectionPhoto } from '../types'

export function PhotoReviewScreen({ photos, includedIds, syncing, error, onIncludedChange, onReplace, onBack, onConfirm, fromReport, readOnly }: { photos: InspectionPhoto[]; includedIds: string[]; syncing: boolean; error: string; onIncludedChange: Dispatch<SetStateAction<string[]>>; onReplace: (photo: InspectionPhoto, file: File) => void; onBack: () => void; onConfirm: () => void; fromReport: boolean; readOnly: boolean }) {
  return <div className="page photo-review-page" data-testid="photo-review-screen">
    <button className="back-button" onClick={onBack} disabled={syncing}><ArrowLeft />{fromReport ? '報告書へ戻る' : '現場結果へ戻る'}</button>
    <div className="page-heading"><div><h1>現場写真の確認・差し替え</h1><p>写真の内容を確認し、報告書に使う写真を選択します。</p></div><div className="review-count"><strong>{includedIds.length}</strong><span>/ {photos.length}枚を掲載</span></div></div>
    {error && <div className="alert-fail"><AlertCircle />{error}</div>}
    <div className="notice"><Image /><div><strong>写真の掲載先</strong><span>選択した写真は、様式Aでは写真台帳、様式Bでは該当する点検項目に自動配置されます。</span></div></div>
    {photos.length === 0 && <div className="panel empty-state"><Image /><strong>現場写真はありません</strong></div>}
    <div className="review-photo-grid">{photos.map(photo => {
      const included = includedIds.includes(photo.photoId)
      return <article key={photo.photoId} className={included ? '' : 'excluded'} data-testid="review-photo-card">
        <div className="review-photo-top"><span className="photo-use-status">{included ? <Check /> : <X />}{included ? '掲載候補' : '掲載しない'}</span></div>
        <div className="review-image">{photo.url ? <img src={photo.url} alt={photo.photoType} /> : <Image />}</div>
        <div className="review-photo-meta"><strong>{photo.photoType}</strong><small>{formatDateTime(photo.takenAt)}</small></div>
        <div className="review-photo-actions"><label className="photo-inclusion"><input type="checkbox" disabled={readOnly || syncing} checked={included} onChange={() => onIncludedChange(current => included ? current.filter(id => id !== photo.photoId) : [...current, photo.photoId])} />報告書に掲載する</label><label className="button button-secondary"><RefreshCcw />写真を差し替え<input className="file-input-accessible" type="file" disabled={readOnly || syncing} accept="image/*" aria-label={`${photo.photoType}の写真を差し替え`} data-testid="replace-photo" onChange={event => { const file = event.target.files?.[0]; if (file) void onReplace(photo, file); event.target.value = '' }} /></label></div>
      </article>
    })}</div>
    <div className="photo-review-footer"><div><strong>掲載候補：{includedIds.length}枚</strong><span>報告書の画面で様式と掲載順を調整できます。</span></div><button className="button button-primary" onClick={onConfirm} disabled={syncing} data-testid="confirm-photo-layout">{syncing ? '写真を更新中…' : fromReport ? '報告書へ戻る' : '報告書を作成'}</button></div>
  </div>
}
