import type { Checkpoint } from '../logic/checkpoints'
import type { Finding, InspectionPhoto, MeasurementEntry, Site, VisualEntry, Weather } from '../types'

export type PhotoTarget = { inspectionItemId: string; equipmentId: string }

// 現場画面に必要な情報。依頼した時点の発電所構成・確認ポイント・前回値を固定して渡す。
export type FieldContext = { site: Site; checkpoints: Checkpoint[]; previousMeasurements: MeasurementEntry[]; scheduledOn: string; inspector: string }
export type FieldEntries = { visual: VisualEntry[]; measurements: MeasurementEntry[]; findings: Finding[]; weather?: Weather }

// netlify/functions/inspection.ts の SharedState と揃える
export type SharedInspection = FieldEntries & {
  token: string
  inspectionId: string
  siteId: string
  status: 'requested' | 'in_progress' | 'submitted'
  context: FieldContext
  photos: InspectionPhoto[]
  requestedAt: string
  updatedAt: string
  submittedAt?: string
  plantName?: string
  address?: string
  requestTitle?: string
}

export type SharedCreate = Pick<SharedInspection, 'inspectionId' | 'siteId' | 'visual' | 'measurements' | 'context' | 'plantName' | 'address' | 'requestTitle'>

// Functionsに届かない（ネットワーク不通・Functionsなしで起動）ときのエラー。管理画面は同じ端末での現場入力に切り替える。
export class ConnectionError extends Error {}
export const isConnectionError = (error: unknown) => error instanceof ConnectionError

const endpoint = '/.netlify/functions/inspection'
async function api<T>(token: string, init?: RequestInit): Promise<T> {
  let response: Response
  let data: { error?: string }
  try {
    response = await fetch(`${endpoint}?token=${encodeURIComponent(token)}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
    data = await response.json()
  } catch { throw new ConnectionError('現場共有サーバーに接続できませんでした') }
  if (!response.ok) throw new Error(data.error || '点検データを同期できませんでした')
  return data as T
}

export const sharedInspectionService = {
  create(token: string, payload: SharedCreate) {
    return api<SharedInspection>(token, { method: 'POST', body: JSON.stringify({ action: 'create', ...payload }) })
  },
  get(token: string) { return api<SharedInspection>(token) },
  save(token: string, entries: FieldEntries) {
    return api<SharedInspection>(token, { method: 'POST', body: JSON.stringify({ action: 'save', ...entries }) })
  },
  submit(token: string, entries: FieldEntries) {
    return api<SharedInspection>(token, { method: 'POST', body: JSON.stringify({ action: 'submit', ...entries }) })
  },
  reset(token: string) {
    return api<SharedInspection>(token, { method: 'POST', body: JSON.stringify({ action: 'reset' }) })
  },
  async uploadPhoto(token: string, target: PhotoTarget, photoType: string, file: File) {
    const dataUrl = await resizeImage(file)
    return api<InspectionPhoto>(token, { method: 'POST', body: JSON.stringify({ action: 'upload', inspectionItemId: target.inspectionItemId, equipmentId: target.equipmentId, photoType, dataUrl }) })
  },
}

// 共有URLモードは長辺1600px・品質0.78。同じ端末のモードはlocalStorageに入れるので小さめにする。
export async function resizeImage(file: File, maxSide = 1600, quality = .78): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選択してください')
  const source = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = source })
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally { URL.revokeObjectURL(source) }
}
