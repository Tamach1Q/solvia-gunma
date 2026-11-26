import type { InspectionPhoto } from '../types'
import { libraryPhotoUrl } from '../mock/inspectionPhotos'

export async function loadLibraryPhoto(id: string): Promise<File> {
  const response = await fetch(libraryPhotoUrl(id))
  if (!response.ok) throw new Error('登録写真を読み込めませんでした。もう一度お試しください')
  return new File([await response.blob()], `${id}.jpg`, { type: 'image/jpeg' })
}

export async function loadInspectionPhoto(photo: InspectionPhoto): Promise<File> {
  const response = await fetch(photo.url!)
  if (!response.ok) throw new Error('写真を読み込めませんでした')
  const blob = await response.blob()
  return new File([blob], 'inspection-photo', { type: blob.type })
}
