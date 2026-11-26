import { GripVertical, Image, X } from 'lucide-react'
import { formatDateTime } from '../logic/format'
import type { PhotoPlacement } from '../logic/photoLayout'
import type { InspectionPhoto } from '../types'

type Move<Zone extends string> = (photoId: string, zone: Zone | null, beforeId?: string) => void

export function PhotoDropZone<Zone extends string>({ zone, label, layout, photos, onMove }: { zone: Zone; label: string; layout: PhotoPlacement<Zone>[]; photos: InspectionPhoto[]; onMove: Move<Zone> }) {
  const entries = layout.filter(entry => entry.zone === zone)
  return <div className={`report-drop-zone ${entries.length ? 'has-photos' : ''}`} data-testid={`report-drop-${zone}`} onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add('drag-over') }} onDragLeave={event => event.currentTarget.classList.remove('drag-over')} onDrop={event => { event.preventDefault(); event.currentTarget.classList.remove('drag-over'); onMove(event.dataTransfer.getData('text/plain'), zone) }}>
    {!entries.length && <div className="drop-placeholder"><Image /><span>画像ブロックをここにドロップ</span><small>{label}</small></div>}
    {entries.map(entry => {
      const photo = photos.find(item => item.photoId === entry.photoId)
      if (!photo) return null
      return <figure className="report-image-block" key={photo.photoId} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', photo.photoId) }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); onMove(event.dataTransfer.getData('text/plain'), zone, photo.photoId) }} data-testid="report-image-block"><span className="block-handle"><GripVertical />画像</span>{photo.url ? <img src={photo.url} alt={photo.photoType} /> : <div className="image-unavailable"><Image />画像を再取得してください</div>}<figcaption><strong>{photo.photoType}</strong><small>{formatDateTime(photo.takenAt)}</small><button onClick={() => onMove(photo.photoId, null)} aria-label={`${photo.photoType}を報告書から外す`}><X /></button></figcaption></figure>
    })}
  </div>
}

export function PhotoPalette<Zone extends string>({ photos, layout, zoneLabels, onMove, onReorder }: { photos: InspectionPhoto[]; layout: PhotoPlacement<Zone>[]; zoneLabels: Record<Zone, string>; onMove?: Move<Zone>; onReorder?: (ids: string[]) => void }) {
  return <div className="photo-block-palette">{photos.length ? photos.map(photo => {
    const placement = layout.find(entry => entry.photoId === photo.photoId)?.zone
    return <div key={photo.photoId} draggable={!onMove} onDragStart={event => { event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/plain', photo.photoId) }} data-testid="report-photo-source">{photo.url ? <img src={photo.url} alt={photo.photoType} /> : <span className="palette-placeholder"><Image /></span>}<span><strong>{photo.photoType}</strong><small>{onMove ? placement ? '掲載する' : '掲載しない' : placement ? zoneLabels[placement] : '未配置'}</small></span>{!onMove && <GripVertical />}{onMove && <div className="report-photo-controls"><button className="button button-ghost" onClick={() => onMove(photo.photoId, placement ? null : 'ledger' as Zone)}>{placement ? '掲載から外す' : '掲載する'}</button>{onReorder && <><button className="button button-ghost" disabled={layout[0]?.photoId === photo.photoId} onClick={() => { const ids = layout.map(entry => entry.photoId); const index = ids.indexOf(photo.photoId); if (index > 0) { [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; onReorder(ids) } }}>前へ移動</button><button className="button button-ghost" disabled={layout.at(-1)?.photoId === photo.photoId} onClick={() => { const ids = layout.map(entry => entry.photoId); const index = ids.indexOf(photo.photoId); if (index >= 0 && index < ids.length - 1) { [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]; onReorder(ids) } }}>後ろへ移動</button><label>掲載順<select aria-label={`${photo.photoType}の掲載順`} value={layout.findIndex(entry => entry.photoId === photo.photoId)} onChange={event => { const ids = layout.map(entry => entry.photoId).filter(id => id !== photo.photoId); ids.splice(Number(event.target.value), 0, photo.photoId); onReorder(ids) }}>{layout.map((entry, i) => <option key={entry.photoId} value={i}>{i + 1}</option>)}</select></label></>}</div>}</div>
  }) : <div className="palette-empty"><Image />掲載対象の写真がありません</div>}</div>
}
