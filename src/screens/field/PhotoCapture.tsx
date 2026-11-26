import { Camera, RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import type { InspectionPhoto } from '../../types'

// スマホのカメラを直接起動する撮影ボタン。撮影済みなら縮小表示し、撮り直せる。
export function PhotoCapture({ label, photos, onCapture, testId }: { label: string; photos: InspectionPhoto[]; onCapture: (file: File) => Promise<void>; testId?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const photo = photos[0]
  return <div className="photo-capture">
    {photo?.url && <img src={photo.url} alt={label} />}
    <label className={`button ${photo ? 'button-secondary' : 'button-secondary is-required'} button-field`}>
      {photo ? <RefreshCcw /> : <Camera />}{busy ? '送信中…' : photo ? '撮り直す' : `${label}を撮影`}
      <input className="file-input-accessible" aria-label={`${label}を撮影`} type="file" accept="image/*" capture="environment" disabled={busy} data-testid={testId} onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        setBusy(true)
        setError('')
        void onCapture(file).catch(reason => setError(reason instanceof Error ? reason.message : '写真を保存できませんでした')).finally(() => setBusy(false))
      }} />
    </label>
    {error && <p className="field-warning">{error}</p>}
  </div>
}
