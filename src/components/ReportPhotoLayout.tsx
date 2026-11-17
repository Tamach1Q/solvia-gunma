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

export function PhotoPalette<Zone extends string>({ photos, layout, zoneLabels }: { photos: InspectionPhoto[]; layout: PhotoPlacement<Zone>[]; zoneLabels: Record<Zone, string> }) {
  return <div className="photo-block-palette">{photos.length ? photos.map(photo => {
    const placement = layout.find(entry => entry.photoId === photo.photoId)?.zone
    return <div key={photo.photoId} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/plain', photo.photoId) }} data-testid="report-photo-source">{photo.url ? <img src={photo.url} alt={photo.photoType} /> : <span className="palette-placeholder"><Image /></span>}<span><strong>{photo.photoType}</strong><small>{placement ? zoneLabels[placement] : '未配置'}</small></span><GripVertical /></div>
  }) : <div className="palette-empty"><Image />掲載対象の写真がありません</div>}</div>
}
