export type PhotoPlacement<Zone extends string> = { photoId: string; zone: Zone | null }

// beforeIdがあればその写真の前へ、なければ同じゾーンの末尾へ移動する。zone=nullは報告書から外す。
export function movePhoto<Zone extends string>(layout: PhotoPlacement<Zone>[], photoId: string, zone: Zone | null, beforeId?: string): PhotoPlacement<Zone>[] {
  const next = layout.filter(entry => entry.photoId !== photoId)
  const moved = { photoId, zone }
  if (beforeId) {
    const index = next.findIndex(entry => entry.photoId === beforeId)
    if (index >= 0) { next.splice(index, 0, moved); return next }
  }
  if (zone) {
    const lastInZone = next.reduce((last, entry, index) => entry.zone === zone ? index : last, -1)
    next.splice(lastInZone + 1, 0, moved)
  } else next.push(moved)
  return next
}
