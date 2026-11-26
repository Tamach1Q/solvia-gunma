import { libraryInspectionPhoto } from '../../mock/inspectionPhotos'
import { toDateString } from '../../logic/dates'
import { applyScenario, scenarioPhotos } from '../../mock/scenario'
import { resizeImage, type FieldContext, type FieldEntries } from '../../services/sharedInspectionService'
import type { Inspection, InspectionPhoto, Site } from '../../types'
import { FieldApp } from './FieldApp'

const submittedStatuses: Inspection['status'][] = ['提出済み', '報告書作成済み', '完了']

// 同じ端末での現場入力（SDD 5.1）。Functionsに繋がらない会場でも1周見せられるよう、管理画面の中にスマホ枠で出し、DemoStateを直接編集する。
export function LocalField({ site, inspection, context, photos, onUpdate, onAddPhotos, onClose, onReport }: { site: Site; inspection: Inspection; context: FieldContext; photos: InspectionPhoto[]; onUpdate: (patch: Partial<Inspection>) => void; onAddPhotos: (photos: InspectionPhoto[]) => void; onClose: () => void; onReport: () => void }) {
  const entries: FieldEntries = { visual: inspection.visual, measurements: inspection.measurements, findings: inspection.findings, weather: inspection.weather }
  const started = inspection.status === '未依頼' || inspection.status === '依頼済み' ? { status: '点検中' as const } : {}
  return <div className="phone-frame-layer">
    <div className="phone-frame" data-testid="local-field">
      <FieldApp
        context={context} plantName={site.name} address={site.address}
        entries={entries} photos={photos} submitted={submittedStatuses.includes(inspection.status)}
        syncLabel="この端末に保存"
        onChange={next => onUpdate({ ...next, ...started })}
        onUploadPhoto={async (target, file) => {
          // localStorageに入れるので、共有URLモードより小さく縮小する
          const photo: InspectionPhoto = { photoId: `PH-${crypto.randomUUID()}`, inspectionItemId: target.refKey, equipmentId: '', photoType: target.label, takenAt: new Date().toISOString(), url: await resizeImage(file, 1024, .7) }
          onAddPhotos([photo])
          return photo
        }}
        onSelectPhoto={async (target, id) => { const photo = libraryInspectionPhoto(id, inspection.inspectionId, target.refKey, target.label); onAddPhotos([photo]); return photo }}
        onSubmit={async () => onUpdate({ status: '提出済み', inspectedOn: toDateString(new Date()) })}
        onFillRest={() => {
          const filled = applyScenario(inspection, site, { measurements: context.previousMeasurements })
          onAddPhotos(scenarioPhotos(inspection.inspectionId, !!inspection.measurements.length))
          onUpdate({ visual: filled.visual, measurements: filled.measurements, findings: filled.findings, weather: filled.weather, ...started })
        }}
        onClose={onClose}
        onReport={inspection.status === '提出済み' ? onReport : undefined}
      />
    </div>
  </div>
}
