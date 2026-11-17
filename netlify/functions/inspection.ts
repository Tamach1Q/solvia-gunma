import { getStore } from '@netlify/blobs'

type SharedPhoto = { photoId: string; inspectionItemId: string; equipmentId: string; photoType: string; takenAt: string; contentType: string }
// src/services/sharedInspectionService.ts の SharedInspection と揃える。中身の型（目視・測定・異常箇所）はフロント側で持ち、ここでは素通しで保存する。
type SharedState = {
  token: string
  inspectionId: string
  siteId: string
  status: 'requested' | 'in_progress' | 'submitted'
  weather?: string
  visual: unknown[]
  measurements: unknown[]
  findings: unknown[]
  context: unknown
  photos: SharedPhoto[]
  requestedAt: string
  updatedAt: string
  submittedAt?: string
  plantName?: string
  address?: string
  requestTitle?: string
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
const validToken = (value: string | null) => value && /^[a-zA-Z0-9-]{16,80}$/.test(value) ? value : null
const asRecord = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : null
const array = (value: unknown, fallback: unknown[]) => Array.isArray(value) ? value : fallback
const withPhotoUrls = (state: SharedState, token: string) => ({ ...state, photos: state.photos.map(photo => ({ ...photo, url: `/.netlify/functions/inspection?token=${token}&photo=${photo.photoId}` })) })

export default async (request: Request) => {
  const store = getStore({ name: 'inspection-field-demo', consistency: 'strong' })
  const url = new URL(request.url)
  const token = validToken(url.searchParams.get('token'))
  if (!token) return json({ error: '無効な点検URLです' }, 400)
  const stateKey = `inspection-${token}`

  if (request.method === 'GET') {
    const photoId = url.searchParams.get('photo')
    const state = await store.get(stateKey, { type: 'json', consistency: 'strong' }) as SharedState | null
    if (!state) return json({ error: '点検依頼が見つかりません' }, 404)
    if (photoId) {
      const photo = state.photos.find(entry => entry.photoId === photoId)
      if (!photo) return json({ error: '写真が見つかりません' }, 404)
      const image = await store.get(`photo-${token}-${photoId}`, { type: 'arrayBuffer', consistency: 'strong' })
      if (!image) return json({ error: '写真が見つかりません' }, 404)
      return new Response(image, { headers: { 'content-type': photo.contentType, 'cache-control': 'private, max-age=300' } })
    }
    return json(withPhotoUrls(state, token))
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const body = await request.json() as Record<string, unknown>
  const action = String(body.action || '')
  const now = new Date().toISOString()

  if (action === 'create') {
    const existing = await store.get(stateKey, { type: 'json', consistency: 'strong' }) as SharedState | null
    if (existing) return json(withPhotoUrls(existing, token))
    const state: SharedState = { token, inspectionId: String(body.inspectionId || ''), siteId: String(body.siteId || ''), status: 'requested', visual: array(body.visual, []), measurements: array(body.measurements, []), findings: [], context: body.context ?? null, photos: [], requestedAt: now, updatedAt: now, plantName: String(body.plantName || ''), address: String(body.address || ''), requestTitle: String(body.requestTitle || '') }
    await store.setJSON(stateKey, state)
    return json(state, 201)
  }

  const state = await store.get(stateKey, { type: 'json', consistency: 'strong' }) as SharedState | null
  if (!state) return json({ error: '点検依頼が見つかりません' }, 404)

  if (action === 'reset') {
    await Promise.all(state.photos.map(photo => store.delete(`photo-${token}-${photo.photoId}`)))
    const visual = state.visual.map(item => { const entry = asRecord(item); return entry ? { ...entry, result: null, comment: '', photoIds: [] } : item })
    const measurements = state.measurements.map(item => { const entry = asRecord(item); if (!entry) return item; const { caution: _caution, ...rest } = entry; return { ...rest, raw: '', value: null, judgement: '未入力', reason: '' } })
    const next: SharedState = { ...state, status: 'requested', visual, measurements, findings: [], photos: [], requestedAt: now, updatedAt: now }
    delete next.submittedAt
    delete next.weather
    await store.setJSON(stateKey, next)
    return json(next)
  }

  if (action === 'save' || action === 'submit') {
    const next: SharedState = {
      ...state,
      status: action === 'submit' ? 'submitted' : state.status === 'requested' ? 'in_progress' : state.status,
      visual: array(body.visual, state.visual),
      measurements: array(body.measurements, state.measurements),
      findings: array(body.findings, state.findings),
      ...(typeof body.weather === 'string' ? { weather: body.weather } : {}),
      updatedAt: now,
      ...(action === 'submit' ? { submittedAt: now } : {}),
    }
    await store.setJSON(stateKey, next)
    return json(withPhotoUrls(next, token))
  }

  if (action === 'upload') {
    const dataUrl = String(body.dataUrl || '')
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/)
    if (!match) return json({ error: 'JPEG・PNG・WebP画像のみアップロードできます' }, 400)
    const bytes = Uint8Array.from(Buffer.from(match[2], 'base64'))
    if (bytes.byteLength > 3_500_000) return json({ error: '写真サイズが大きすぎます' }, 413)
    const photoId = crypto.randomUUID()
    const photo: SharedPhoto = { photoId, inspectionItemId: String(body.inspectionItemId || ''), equipmentId: String(body.equipmentId || ''), photoType: String(body.photoType || '点検写真'), takenAt: now, contentType: match[1] }
    await store.set(`photo-${token}-${photoId}`, bytes, { metadata: { contentType: photo.contentType } })
    const next = { ...state, status: 'in_progress' as const, photos: [...state.photos.filter(entry => !(entry.inspectionItemId === photo.inspectionItemId && entry.photoType === photo.photoType)), photo], updatedAt: now }
    await store.setJSON(stateKey, next)
    return json({ ...photo, url: `/.netlify/functions/inspection?token=${token}&photo=${photoId}` }, 201)
  }

  return json({ error: '不明な操作です' }, 400)
}
