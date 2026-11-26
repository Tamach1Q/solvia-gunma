import type { ReactNode } from 'react'
import { visualCategories, visualItems } from '../config/visualItems'
import { brand } from '../config/brand'
import { formatDate, formatNumber } from '../logic/format'
import { overallCounts } from '../logic/report'
import type { Inspection, InspectionPhoto, Site, VisualResult } from '../types'
import { VisualResultMark } from './ui'

const resultWords: Record<Exclude<VisualResult, null>, string> = { '○': '良', '△': '要観察', '×': '要対応', 該当なし: '対象外' }
type Props = { site: Site; inspection: Inspection; previous?: Inspection; photos: InspectionPhoto[]; editing: boolean; onChange: (patch: Partial<Inspection>) => void; measurement?: ReactNode }
export function GunmaReportDocument({ site, inspection, previous, photos, editing, onChange, measurement }: Props) {
  const format = inspection.reportFormat ?? 'A'
  const header = inspection.reportHeader ?? { siteName: site.name, owner: site.owner }
  const text = inspection.reportText ?? { summary: '', proposals: [] }
  const counts = overallCounts(inspection)
  const layout = inspection.reportLayout ?? []
  const included = layout.filter(entry => entry.zone !== null).map(entry => photos.find(photo => photo.photoId === entry.photoId)).filter((photo): photo is InspectionPhoto => !!photo)
  const photosFor = (itemId: string) => included.filter(photo => photo.inspectionItemId === itemId)
  const number = (photoId: string) => String(included.findIndex(photo => photo.photoId === photoId) + 1).padStart(2, '0')
  const entryFor = (photo: InspectionPhoto) => inspection.visual.find(entry => entry.itemId === photo.inspectionItemId)
  const mark = (result: VisualResult) => format === 'B' ? <span className={`judgement judgement-${result === '×' ? 'fail' : result === '△' ? 'caution' : result === '○' ? 'ok' : 'none'}`}>{result ? resultWords[result] : '未判定'}</span> : result === '該当なし' ? '－' : <VisualResultMark result={result} />
  const reportText = <section className="gunma-report-text">
    <h2>総合所見</h2>{editing ? <textarea className="report-textarea" aria-label="総合所見" value={text.summary} onChange={event => onChange({ reportText: { ...text, summary: event.target.value } })} /> : <p className="report-text" data-testid="report-summary">{text.summary}</p>}
    <h2>{format === 'A' ? '要対応事項' : '是正提案'}</h2>
    {text.proposals.length ? <ol className="report-proposals" data-testid="report-proposals">{text.proposals.map((proposal, index) => <li key={index}>{editing ? <textarea className="report-textarea" aria-label={`ご提案 ${index + 1}`} value={proposal} onChange={event => onChange({ reportText: { ...text, proposals: text.proposals.map((item, i) => i === index ? event.target.value : item) } })} /> : proposal}</li>)}</ol> : <p>今回の点検では、ご対応をお願いする事項はありません。</p>}
  </section>
  const resultTable = (category?: string) => <div className="gunma-table-scroll"><table className="report-table gunma-results">
    <thead><tr><th>No</th>{format === 'A' && <th>区分</th>}<th>点検項目</th><th>判定</th><th>{format === 'A' ? '備考（△・×の項目）' : '所見'}</th>{format === 'B' && <th>写真</th>}</tr></thead>
    <tbody>{visualItems.filter(item => !category || item.category === category).map(item => {
      const entry = inspection.visual.find(entry => entry.itemId === item.itemId)
      const result = entry?.result ?? null
      return <tr key={item.itemId} className={result === '×' ? 'is-不適合' : result === '△' ? 'is-observation' : ''}>
        <td data-label="No">{item.itemId}</td>{format === 'A' && <td data-label="区分">{item.category}</td>}<td data-label="点検項目"><strong>{item.title}</strong>{format === 'B' && <small>{item.criterion}</small>}</td><td data-label="判定">{mark(result)}</td>
        <td data-label={format === 'A' ? '備考' : '所見'}>{format === 'A' ? result === '△' || result === '×' ? entry?.comment : '' : entry?.comment || (result === '○' ? '異常なし' : result === '該当なし' ? '対象設備なし' : '')}</td>
        {format === 'B' && <td data-label="写真" className="gunma-inline-photo">{photosFor(item.itemId).length ? photosFor(item.itemId).map(photo => <figure key={photo.photoId} data-testid="report-image-block"><img src={photo.url} alt={photo.photoType} /><figcaption>写真{number(photo.photoId)}</figcaption></figure>) : '写真なし'}</td>}
      </tr>
    })}</tbody>
  </table></div>
  return <>
    <section className="report-cover gunma-cover">
      <p className="report-issuer">{brand.companyName}</p><h1>{format === 'A' ? '太陽光発電設備 定期点検報告書' : '点検報告書'}</h1>
      {format === 'B' && <p>太陽光発電設備 定期点検（目視）</p>}
      {inspection.reportContractor && <p className="report-owner">{inspection.reportContractor} 御中</p>}
      {editing ? <div className="report-header-editor"><label className="review-input"><span>報告書の発電所名</span><input value={header.siteName} onChange={event => onChange({ reportHeader: { ...header, siteName: event.target.value } })} /></label><label className="review-input"><span>報告書のオーナー名</span><input value={header.owner} onChange={event => onChange({ reportHeader: { ...header, owner: event.target.value } })} /></label></div> : <><p className="report-site">{header.siteName}</p>{format === 'A' && <p className="report-owner">{header.owner} 様</p>}</>}
      <dl className="report-facts">
        {format === 'B' && <div><dt>案件番号</dt><dd>{inspection.reportCaseNo || '—'}</dd></div>}
        <div><dt>所在地</dt><dd>{site.address}</dd></div><div><dt>設備容量</dt><dd>{formatNumber(site.capacityKw)}kW</dd></div>
        <div><dt>点検日</dt><dd>{formatDate(inspection.inspectedOn ?? inspection.scheduledOn)}</dd></div><div><dt>{format === 'A' ? '点検者' : '点検責任者'}</dt><dd>{inspection.inspector}</dd></div>
        <div><dt>天候</dt><dd>{inspection.weather ?? '—'}</dd></div><div><dt>発行日</dt><dd>{formatDate(inspection.reportIssuedOn ?? inspection.inspectedOn ?? inspection.scheduledOn)}</dd></div>
        {format === 'B' && <><div><dt>発電事業者</dt><dd>{header.owner}</dd></div><div><dt>前回点検日</dt><dd>{previous ? formatDate(previous.inspectedOn ?? previous.scheduledOn) : '—'}</dd></div></>}
      </dl>
      <p className="gunma-legend">{format === 'A' ? '判定：○ 異常なし　△ 要観察　× 要対応　－ 対象外' : '判定：良／要観察／要対応／対象外'}</p>
      <dl className="report-counts"><div><dt>点検項目</dt><dd>{counts.total}</dd></div><div><dt>{format === 'A' ? '○ 異常なし' : '良'}</dt><dd>{counts.ok}</dd></div><div className={counts.caution ? 'is-caution' : ''}><dt>要観察</dt><dd>{counts.caution}</dd></div><div className={counts.needsAction ? 'is-fail' : ''}><dt>要対応</dt><dd>{counts.needsAction}</dd></div></dl>
      {format === 'B' && <><p className="gunma-overall">総合評価：{counts.needsAction ? '要対応' : counts.caution ? '要観察' : '良'}</p>{reportText}</>}
    </section>
    {format === 'A' ? <><section className="report-section"><h2>点検結果</h2>{resultTable()}{reportText}</section><section className="report-section gunma-ledger"><h2>写真台帳</h2><div className="gunma-photo-grid">{included.map(photo => { const entry = entryFor(photo); return <figure key={photo.photoId} data-testid="report-image-block"><img src={photo.url} alt={photo.photoType} /><figcaption><strong>写真{number(photo.photoId)}　{photo.inspectionItemId} {visualItems.find(item => item.itemId === photo.inspectionItemId)?.title ?? photo.photoType}</strong><span>判定：{entry?.result === '該当なし' ? '－' : entry?.result ?? '—'}　{entry?.comment || '異常なし'}</span></figcaption></figure> })}</div>{!included.length && <p>掲載写真はありません。</p>}</section></> : <section className="report-section gunma-detail"><h2>点検結果</h2>{visualCategories.map(category => <section className="gunma-category" key={category}><h3>{category}</h3>{resultTable(category)}</section>)}</section>}
    {measurement}
  </>
}
