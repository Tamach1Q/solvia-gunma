import { loadLibraryPhoto, loadInspectionPhoto } from '../../services/photoLibraryService'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { applyScenario, scenarioPhotos } from '../../mock/scenario'
import { sharedInspectionService, type FieldEntries, type SharedInspection } from '../../services/sharedInspectionService'
import type { InspectionPhoto } from '../../types'
import { FieldApp } from './FieldApp'

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback
const entriesOf = (shared: SharedInspection): FieldEntries => ({ visual: shared.visual, measurements: shared.measurements, findings: shared.findings, weather: shared.weather })

// 共有URL（?field=token）で開いた現場画面。入力は0.7秒ためてから自動保存し、写真はその場でアップロードする。
// &fill=1 が付いたURLだけ「残りを一括入力」を出す（発表者や、試してもらう先方に送る用）。
export function SharedField({ token, fill }: { token: string; fill: boolean }) {
  const [shared, setShared] = useState<SharedInspection | null>(null)
  const [entries, setEntries] = useState<FieldEntries | null>(null)
  const [photos, setPhotos] = useState<InspectionPhoto[]>([])
  const [loadError, setLoadError] = useState('')
  const [sync, setSync] = useState<'saved' | 'saving' | 'error'>('saved')
  const [error, setError] = useState('')
  const dirty = useRef(false)

  useEffect(() => {
    sharedInspectionService.get(token).then(loaded => { setShared(loaded); setEntries(entriesOf(loaded)); setPhotos(loaded.photos) }).catch(reason => setLoadError(errorMessage(reason, '点検依頼を読み込めませんでした')))
  }, [token])

  useEffect(() => {
    if (!entries || !dirty.current || shared?.status === 'submitted') return
    setSync('saving')
    const timer = window.setTimeout(() => {
      // 保存の応答で入力中の値を上書きしない（状態だけ受け取る）
      sharedInspectionService.save(token, entries).then(saved => { setShared(saved); setSync('saved'); setError('') }).catch(reason => { setSync('error'); setError(errorMessage(reason, '入力内容を保存できませんでした。電波の良い場所で開き直してください')) })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [token, entries, shared?.status])

  if (loadError) return <div className="field-app"><main className="field-main"><section className="field-section"><p className="field-error" role="alert"><AlertTriangle />{loadError}</p></section></main></div>
  if (!shared || !entries) return <div className="field-app"><main className="field-main"><section className="field-section"><p className="field-hint">点検依頼を読み込んでいます…</p></section></main></div>

  return <FieldApp
    context={shared.context} plantName={shared.plantName ?? shared.context.site.name} address={shared.address ?? shared.context.site.address}
    entries={entries} photos={photos} submitted={shared.status === 'submitted'}
    syncLabel={{ saved: '保存済み', saving: '保存中…', error: '未保存' }[sync]} error={error}
    onChange={next => { dirty.current = true; setEntries(next) }}
    onUploadPhoto={async (target, file) => {
      const photo = await sharedInspectionService.uploadPhoto(token, { inspectionItemId: target.refKey, equipmentId: '' }, target.label, file)
      setPhotos(current => [...current.filter(item => item.photoId !== photo.photoId), photo])
      return photo
    }}
    onSelectPhoto={async (target, id) => {
      const photo = await sharedInspectionService.uploadPhoto(token, { inspectionItemId: target.refKey, equipmentId: '' }, target.label, await loadLibraryPhoto(id))
      setPhotos(current => [...current.filter(item => item.photoId !== photo.photoId), photo])
      return photo
    }}
    onFillRest={fill ? async () => { try {
      const filled = applyScenario({ ...entries, inspectionId: shared.inspectionId, siteId: shared.siteId, scheduledOn: shared.context.scheduledOn, inspector: shared.context.inspector, status: '点検中' }, shared.context.site, { measurements: shared.context.previousMeasurements })
      const replacements = new Map<string, string>()
      const uploaded: InspectionPhoto[] = []
      for (const source of scenarioPhotos(shared.inspectionId, !!entries.measurements.length).filter(photo => filled.visual.some(entry => entry.photoIds.includes(photo.photoId)))) {
        const photo = await sharedInspectionService.uploadPhoto(token, { inspectionItemId: source.inspectionItemId, equipmentId: '' }, source.photoType, await loadInspectionPhoto(source))
        replacements.set(source.photoId, photo.photoId)
        uploaded.push(photo)
      }
      setPhotos(current => [...current, ...uploaded])
      const swap = (ids: string[]) => ids.map(id => replacements.get(id) ?? id)
      dirty.current = true
      setEntries({ visual: filled.visual.map(entry => ({ ...entry, photoIds: swap(entry.photoIds) })), measurements: filled.measurements, findings: filled.findings.map(finding => ({ ...finding, photoIds: swap(finding.photoIds) })), weather: filled.weather })
    } catch (reason) { setError(errorMessage(reason, '一括入力できませんでした')) } } : undefined}
    onSubmit={async () => {
      try { setShared(await sharedInspectionService.submit(token, entries)); setError('') }
      catch (reason) { setError(errorMessage(reason, '提出できませんでした。電波の良い場所でもう一度お試しください')) }
    }}
  />
}
