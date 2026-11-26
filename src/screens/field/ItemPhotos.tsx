import { Camera, Images, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { libraryPhotoUrl, photoLibrary } from '../../mock/inspectionPhotos'
import type { InspectionPhoto } from '../../types'

type Props = { itemId: string; photos: InspectionPhoto[]; onUpload: (file: File) => Promise<void>; onSelect: (id: string) => Promise<void>; onRemove: (id: string) => void }
export function ItemPhotos({ itemId, photos, onUpload, onSelect, onRemove }: Props) {
  const uploadInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await work(); setOpen(false) } catch (reason) { setError(reason instanceof Error ? reason.message : '写真を追加できませんでした') } finally { setBusy(false) }
  }
  const input = (camera: boolean) => <><button className="button button-secondary" disabled={busy} onClick={() => (camera ? cameraInput : uploadInput).current?.click()}>{camera ? <Camera /> : <Upload />}{camera ? '撮影する' : '端末から追加'}</button><input ref={camera ? cameraInput : uploadInput} type="file" hidden accept="image/*" capture={camera ? 'environment' : undefined} disabled={busy} data-testid={camera ? `camera-${itemId}` : `photo-${itemId}`} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(() => onUpload(file)) }} /></>
  const recommended = photoLibrary.filter(photo => photo.itemId === itemId)
  return <div className="item-photos" aria-busy={busy}>
    <p className="field-hint">様式A：写真台帳／様式B：この点検項目の写真欄に掲載</p>
    {!!photos.length && <div className="item-photo-list">{photos.map(photo => <figure key={photo.photoId}><img src={photo.url} alt={photo.photoType} loading="lazy" /><figcaption>{photo.photoType}</figcaption><button className="icon-button" disabled={busy} onClick={() => onRemove(photo.photoId)} aria-label={`${photo.photoType}を外す`}><X /></button></figure>)}</div>}
    <div className="item-photo-actions"><button className="button button-secondary" disabled={busy} aria-expanded={open} onClick={() => setOpen(!open)} data-testid={`select-photo-${itemId}`}><Images />{busy ? '写真を保存中…' : '登録写真から選ぶ'}</button>{input(false)}{input(true)}</div>
    {open && <section className="photo-library" aria-label="登録写真">
      <div className="photo-library-heading"><strong>追加する写真を選択</strong><button className="button button-ghost" onClick={() => setOpen(false)}>閉じる</button></div>
      <p className="text-muted">写真を選ぶと、この点検項目に追加されます。</p>
      <div className="photo-library-grid">{(all || !recommended.length ? photoLibrary : recommended).map(photo => <button key={photo.id} disabled={busy} onClick={() => void run(() => onSelect(photo.id))} data-testid={`library-${photo.id}`}><img src={libraryPhotoUrl(photo.id)} alt={photo.title} loading="lazy" /><span>{photo.title}</span></button>)}</div>
      {!all && !!recommended.length && <button className="button button-ghost" onClick={() => setAll(true)}>すべての写真を見る（12枚）</button>}
    </section>}
    {error && <p className="field-warning" role="alert">{error}</p>}
  </div>
}
