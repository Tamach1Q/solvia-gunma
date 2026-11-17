// avoid-ai-design-ignore: I3 アイコンはAGENTS.mdの指定でlucide-reactに統一している
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronRight, Image, RefreshCcw, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { formatDateTime } from '../logic/format'
import type { InspectionPhoto } from '../types'

export function PhotoReviewScreen({ photos, includedIds, syncing, error, onIncludedChange, onReplace, onBack, onConfirm }: { photos: InspectionPhoto[]; includedIds: string[]; syncing: boolean; error: string; onIncludedChange: Dispatch<SetStateAction<string[]>>; onReplace: (photo: InspectionPhoto, file: File) => void; onBack: () => void; onConfirm: () => void }) {
  return <div className="page photo-review-page" data-testid="photo-review-screen">
    <button className="back-button" onClick={onBack}><ArrowLeft />現場結果へ戻る</button>
    <div className="page-heading"><div><h1>現場写真の確認・差し替え</h1><p>写真の内容を確認し、報告書に使う写真を選択します。</p></div><div className="review-count"><strong>{includedIds.length}</strong><span>/ {photos.length}枚を掲載</span></div></div>
    <div className="step-flow"><span className="done">現場結果</span><ChevronRight /><span className="active">写真確認・差し替え</span><ChevronRight /><span>報告書編集</span></div>
    {error && <div className="alert-fail"><AlertCircle />{error}</div>}
    <div className="notice"><Image /><div><strong>まず写真の内容を確認</strong><span>画像の配置は、次の報告書編集画面で本文へ直接ドラッグして決められます。</span></div></div>
    <div className="review-photo-grid">{photos.map(photo => {
      const included = includedIds.includes(photo.photoId)
      return <article key={photo.photoId} className={included ? '' : 'excluded'} data-testid="review-photo-card">
        <div className="review-photo-top"><span className="photo-use-status">{included ? <Check /> : <X />}{included ? '掲載候補' : '掲載しない'}</span></div>
        <div className="review-image">{photo.url ? <img src={photo.url} alt={photo.photoType} /> : <Image />}</div>
        <div className="review-photo-meta"><strong>{photo.photoType}</strong><small>{formatDateTime(photo.takenAt)}</small></div>
        <div className="review-photo-actions"><button className={`button button-secondary ${included ? 'is-selected' : ''}`} onClick={() => onIncludedChange(current => included ? current.filter(id => id !== photo.photoId) : [...current, photo.photoId])}>{included ? <CheckCircle2 /> : <AlertCircle />}{included ? '報告書に掲載' : '掲載しない'}</button><label className="button button-secondary"><RefreshCcw />写真を差し替え<input type="file" accept="image/*" data-testid="replace-photo" onChange={event => { const file = event.target.files?.[0]; if (file) void onReplace(photo, file); event.target.value = '' }} /></label></div>
      </article>
    })}</div>
    <div className="photo-review-footer"><div><strong>掲載候補：{includedIds.length}枚</strong><span>次の画面で、写真を報告書本文へドラッグして配置します。</span></div><button className="button button-primary" onClick={onConfirm} disabled={!includedIds.length || syncing} data-testid="confirm-photo-layout">{syncing ? '写真を更新中…' : '報告書の配置編集へ'}</button></div>
  </div>
}
