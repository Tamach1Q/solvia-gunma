// MOCK: 提供された12枚の写真と、群馬用の記入例に沿った点検結果。
import type { Inspection, InspectionPhoto, VisualResult } from '../types'

export const photoLibrary = [
  { id: '01_overview', title: '発電所全景', itemId: '1-1' },
  { id: '02_entrance_gate', title: '門扉・標識', itemId: '1-3' },
  { id: '03_panel_surface_normal', title: 'パネル表面', itemId: '2-2' },
  { id: '04_support_base_normal', title: '架台・固定部', itemId: '3-2' },
  { id: '05_wiring_normal', title: 'ケーブルの固定', itemId: '4-1' },
  { id: '06_inverters_normal', title: 'パワコン外観', itemId: '5-1' },
  { id: '07_ground_normal', title: '排水・地盤', itemId: '1-5' },
  { id: '08_bird_droppings_abnormal', title: 'パネル表面の汚れ', itemId: '2-1' },
  { id: '09_weeds_shading_abnormal', title: '雑草による影', itemId: '1-4' },
  { id: '10_inverter_red_indicator_abnormal', title: 'パワコン停止表示', itemId: '5-2' },
  { id: '11_light_rust_abnormal', title: '架台の軽微な錆', itemId: '3-1' },
  { id: '12_fence_gap_abnormal', title: 'フェンスの隙間', itemId: '1-2' },
]
export type LibraryPhoto = (typeof photoLibrary)[number]
export const libraryPhotoUrl = (id: string) => `/inspection-photos/${id}.jpg`
export const libraryInspectionPhoto = (id: string, inspectionId: string, itemId: string, title: string, takenAt = new Date().toISOString()): InspectionPhoto => ({ photoId: `PH-${inspectionId}-${itemId}-${id}`, inspectionItemId: itemId, equipmentId: '', photoType: title, takenAt, url: libraryPhotoUrl(id) })
export const gunmaPhotos = (inspectionId: string, takenAt?: string) => photoLibrary.map(photo => libraryInspectionPhoto(photo.id, inspectionId, photo.itemId, photo.title, takenAt))

const observations: Record<string, { result: VisualResult; comment: string }> = {
  '1-2': { result: '△', comment: '東側フェンスの下端に約15cmの隙間あり。小動物が入るおそれがあるため経過を確認' },
  '1-4': { result: '△', comment: '南側最下段に雑草がかかり、パネル下端に影。次回の除草で刈払い' },
  '2-1': { result: '△', comment: '下段パネルに鳥の糞と土汚れ。発電量への影響を経過観察' },
  '3-1': { result: '△', comment: '架台脚の根元に軽微な錆。次回点検で腐食の進行を確認' },
  '5-2': { result: '×', comment: 'パワコン2号機の赤ランプが点灯し停止中。メーカー点検の手配が必要' },
}
export function applyGunmaVisual(inspection: Inspection): Inspection {
  const photos = gunmaPhotos(inspection.inspectionId)
  return { ...inspection, weather: inspection.weather ?? '晴れ', visual: inspection.visual.map(entry => entry.result ? entry : {
    ...entry, result: observations[entry.itemId]?.result ?? '○', comment: entry.comment.trim() ? entry.comment : observations[entry.itemId]?.comment ?? '',
    photoIds: entry.photoIds.length ? entry.photoIds : photos.filter(photo => photo.inspectionItemId === entry.itemId).map(photo => photo.photoId),
  }) }
}
