import { Printer } from 'lucide-react'
import { useState } from 'react'
import { toDateString } from '../logic/dates'
import { formatDate } from '../logic/format'
import { resizeImage } from '../services/sharedInspectionService'
import type { Site } from '../types'

const workTypes = ['除草', 'パネル洗浄'] as const
type WorkType = typeof workTypes[number]
const stages = ['作業前', '作業後'] as const
type Stage = typeof stages[number]
type PhotoInput = { url?: string; name?: string; loading?: boolean; error?: string }

export function WorkReportScreen({ sites }: { sites: Site[] }) {
  const [siteId, setSiteId] = useState('')
  const [work, setWork] = useState<WorkType>('除草')
  const [workDate, setWorkDate] = useState(() => toDateString(new Date()))
  const [photos, setPhotos] = useState<Record<Stage, PhotoInput>>({ 作業前: {}, 作業後: {} })
  const site = sites.find(item => item.siteId === siteId)
  const updatePhoto = (stage: Stage, edit: Partial<PhotoInput>) => setPhotos(current => ({ ...current, [stage]: { ...current[stage], ...edit } }))

  const attach = async (stage: Stage, file: File) => {
    updatePhoto(stage, { loading: true, error: undefined })
    try {
      updatePhoto(stage, { url: await resizeImage(file), name: file.name, loading: false })
    } catch {
      updatePhoto(stage, { loading: false, error: '画像を読み込めませんでした。JPEGやPNGの写真を選んでください。' })
    }
  }

  const ready = !!site && !!workDate && stages.every(stage => photos[stage].url && !photos[stage].loading)

  return <div className="page work-report-page">
    <div className="page-heading no-print"><div><h1>作業報告書</h1><p>作業前後の写真を並べて、除草・パネル洗浄の報告書を作ります。</p></div>
      <button className="button button-primary" disabled={!ready} type="button" onClick={() => window.print()}><Printer />印刷／PDF保存</button>
    </div>
    <section className="panel no-print" aria-labelledby="work-details-title">
      <header className="panel-header"><h2 id="work-details-title">作業情報</h2></header>
      <div className="work-report-fields">
        <div><label htmlFor="work-report-site">発電所</label><select id="work-report-site" value={siteId} onChange={event => setSiteId(event.target.value)} required><option value="">発電所を選択</option>{sites.map(item => <option key={item.siteId} value={item.siteId}>{item.name}</option>)}</select></div>
        <div><label htmlFor="work-report-type">作業種別</label><select id="work-report-type" value={work} onChange={event => setWork(event.target.value as WorkType)}>{workTypes.map(item => <option key={item}>{item}</option>)}</select></div>
        <div><label htmlFor="work-report-date">作業日</label><input id="work-report-date" type="date" value={workDate} onChange={event => setWorkDate(event.target.value)} required /></div>
      </div>
      <div className="work-report-fields work-report-uploads">{stages.map(stage => {
        const photo = photos[stage]
        return <div key={stage}>
          <label>{stage}の写真<input type="file" accept="image/*" disabled={photo.loading} onChange={event => {
            const input = event.currentTarget
            const file = input.files?.[0]
            if (file) void attach(stage, file)
            input.value = ''
          }} /></label>
          {photo.loading && <small role="status">写真を読み込み中です。</small>}
          {photo.url && <div className="work-report-file"><small>{photo.name}</small><button type="button" className="button button-ghost" disabled={photo.loading} onClick={() => updatePhoto(stage, { url: undefined, name: undefined, error: undefined })}>{stage}の写真を外す</button></div>}
          {photo.error && <small className="text-fail" role="alert">{photo.error}</small>}
        </div>
      })}</div>
    </section>
    <section className="panel work-report-preview" aria-label="報告書プレビュー">
      <header className="panel-header no-print"><h2>プレビュー</h2></header>
      <article className={`work-report-sheet${ready ? '' : ' no-print'}`}>
        <h2>{work}作業報告書</h2>
        <dl className="report-facts">
          <div><dt>発電所</dt><dd>{site?.name ?? '—'}</dd></div>
          <div><dt>作業日</dt><dd>{workDate ? formatDate(workDate) : '—'}</dd></div>
        </dl>
        <div className="work-report-pair">{stages.map(stage => <figure key={stage}>
          <figcaption>{stage}</figcaption>
          {photos[stage].url ? <img src={photos[stage].url} alt={`${stage}の写真`} /> : <div className="work-report-placeholder">写真なし</div>}
        </figure>)}</div>
      </article>
    </section>
  </div>
}
