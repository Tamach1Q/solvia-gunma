// avoid-ai-design-ignore: I3 アイコンはAGENTS.mdの指定でlucide-reactに統一している
import { AlertTriangle, ArrowLeft, CheckCircle2, Cloud, CloudDrizzle, CloudRain, ListChecks, MapPin, Sun, X } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { JudgementMark, StatusChip } from '../../components/ui'
import { VisualIcon } from '../../components/VisualIcon'
import { measurementUnits, rainCaution } from '../../config/thresholds'
import { visualCategories, visualItems } from '../../config/visualItems'
import type { Checkpoint } from '../../logic/checkpoints'
import { criterionText } from '../../logic/criteria'
import { missingItems, type FieldStep } from '../../logic/fieldCheck'
import { formatDateWithWeekday } from '../../logic/format'
import { buildMeasurementEntries, judgeMeasurements } from '../../logic/judge'
import { arrayRowsLabel, circuitLabel, measurementTitle, measurementValue, panelLocation } from '../../logic/labels'
import { siteCircuits } from '../../logic/site'
import type { FieldContext, FieldEntries } from '../../services/sharedInspectionService'
import type { Finding, InspectionPhoto, MeasurementEntry, VisualResult, Weather } from '../../types'
import { FindingSheet, type FindingTarget } from './FindingSheet'
import { ItemPhotos } from './ItemPhotos'

const weathers: { value: Weather; icon: typeof Sun }[] = [{ value: '晴れ', icon: Sun }, { value: '曇り', icon: Cloud }, { value: '雨', icon: CloudRain }, { value: '雨上がり', icon: CloudDrizzle }]
const results: Exclude<VisualResult, null>[] = ['○', '△', '×', '該当なし']
const steps: { step: FieldStep; label: string }[] = [{ step: 'start', label: '開始' }, { step: 'visual', label: '目視' }, { step: 'measure', label: '測定' }, { step: 'check', label: '確認' }]
// 絶縁抵抗は「∞」ボタンで上限超えを入れられる（数字キーボードでは∞・>が打てないため）
const overRangeKinds = new Set(['DC絶縁抵抗', 'AC絶縁抵抗'])

export type FieldAppProps = {
  context: FieldContext; plantName: string; address: string
  entries: FieldEntries; photos: InspectionPhoto[]; submitted: boolean
  syncLabel: string; error?: string
  onChange: (entries: FieldEntries) => void
  onUploadPhoto: (target: { refKey: string; label: string }, file: File) => Promise<InspectionPhoto>
  onSelectPhoto: (target: { refKey: string; label: string }, id: string) => Promise<InspectionPhoto>
  onSubmit: () => Promise<void>
  onFillRest?: () => void | Promise<void>
  onClose?: () => void
  onReport?: () => void
}

export function FieldApp(props: FieldAppProps) {
  const { context, entries, photos } = props
  const { site } = context
  const currentEntries = useRef(entries)
  currentEntries.current = entries
  const [step, setStep] = useState<FieldStep>(entries.weather ? 'visual' : 'start')
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [findingTarget, setFindingTarget] = useState<FindingTarget | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const missing = useMemo(() => missingItems(entries), [entries])
  const checkpointFor = (refKey: string) => context.checkpoints.filter(point => point.refKey === refKey)
  const findingFor = (refKey: string) => entries.findings.find(finding => finding.refKey === refKey)

  // 測定値は天候・他の欄・前回値に依存するので、変更のたびに全体を判定し直す
  const change = (next: Partial<FieldEntries>) => {
    const merged = { ...currentEntries.current, ...next }
    props.onChange({ ...merged, measurements: judgeMeasurements(merged.measurements, site, merged.weather, context.previousMeasurements) })
  }
  // anchorがあればその入力欄へ、なければ先頭へ。スマホ枠表示では .field-app 自体がスクロールする。
  const go = (next: FieldStep, anchor?: string) => {
    if (next === 'visual' && anchor) {
      const item = visualItems.find(item => anchor.endsWith(`:${item.itemId}`))
      if (item) setCategoryIndex(visualCategories.indexOf(item.category))
    }
    setStep(next)
    window.setTimeout(() => {
      const target = anchor ? document.getElementById(anchor) : null
      if (target) return target.scrollIntoView({ block: 'center' })
      window.scrollTo(0, 0)
      document.querySelector('.field-app')?.scrollTo(0, 0)
    }, 0)
  }
  const category = visualCategories[categoryIndex]
  const nextCategory = () => { setCategoryIndex(index => index + 1); go('visual') }
  const upload = (refKey: string, label: string) => (file: File) => props.onUploadPhoto({ refKey, label }, file)
  const saveFinding = (finding: Finding) => { change({ findings: [...entries.findings.filter(item => item.refKey !== finding.refKey), finding] }); setFindingTarget(null) }

  if (props.submitted) return <FieldShell {...props} step={null} onStep={go}><CompleteView entries={entries} plantName={props.plantName} onClose={props.onClose} onReport={props.onReport} /></FieldShell>

  return <FieldShell {...props} step={step} onStep={go} visualDone={entries.visual.filter(entry => entry.result).length} measured={entries.measurements.filter(entry => entry.judgement !== '未入力').length} missingCount={missing.length} footer={step === 'visual' ? <div className="field-category-footer"><button className="button button-secondary" disabled={categoryIndex === 0} onClick={() => { setCategoryIndex(index => index - 1); go('visual') }}>前の区分</button><button className="button button-primary" onClick={() => categoryIndex < visualCategories.length - 1 ? nextCategory() : go(entries.measurements.length ? 'measure' : 'check')} data-testid="next-category">{categoryIndex < visualCategories.length - 1 ? '次の区分へ' : '入力内容を確認'}</button><button className="button button-ghost" onClick={() => { const first = missing[0]; go(first?.step ?? 'check', first?.key.replace(/^(comment|photo):/, 'visual:')) }}>未完了の項目へ</button></div> : undefined}>
    {step === 'start' && <section className="field-section" data-testid="field-start">
      <h1 className="field-title">{props.plantName}</h1>
      <p className="field-meta"><MapPin size={16} />{props.address}</p>
      <p className="field-meta">{formatDateWithWeekday(context.scheduledOn)}・{context.inspector}</p>
      <h2 className="field-heading">今回の確認ポイント</h2>
      {context.checkpoints.length ? <ul className="field-checkpoints">{context.checkpoints.map(point => <CheckpointItem key={point.key} point={point} />)}</ul> : <p className="field-hint">前回の指摘はありません。通常の項目で点検します。</p>}
      <div className="notice"><ListChecks /><div><strong>目視点検・21項目</strong><span>写真を選んで判定・所見を入力します。正常な項目にも写真を登録できます。</span></div></div>
      <label className="report-option"><input type="checkbox" checked={!!entries.measurements.length} onChange={event => change({ measurements: event.target.checked ? buildMeasurementEntries(site) : [], findings: entries.findings.filter(finding => finding.source !== 'measurement') })} />電気測定も実施する（任意）</label>
      <h2 className="field-heading">天候</h2>
      <div className="weather-grid">{weathers.map(({ value, icon: Icon }) => <button key={value} className={`choice ${entries.weather === value ? 'is-active' : ''}`} aria-pressed={entries.weather === value} onClick={() => change({ weather: value })}><Icon />{value}</button>)}</div>
      {entries.weather === '雨上がり' && <p className="field-warning" role="alert"><AlertTriangle />接地抵抗は雨の後に測定しないでください。</p>}
      <div className="field-actions"><button className="button button-primary button-field" disabled={!entries.weather} onClick={() => go('visual')} data-testid="start-inspection">点検を開始する</button></div>
      {props.onFillRest && <FillRestButton onClick={props.onFillRest} />}
    </section>}

    {step === 'visual' && <section className="field-section" data-testid="field-visual">
      <p className="field-hint">○ 異常なし　△ 要観察　× 要対応　該当なし：対象設備なし</p>
      <div className="field-category-picker"><label>点検区分<select aria-label="点検区分" value={categoryIndex} onChange={event => { setCategoryIndex(Number(event.target.value)); go('visual') }}>{visualCategories.map((name, index) => <option key={name} value={index}>{index + 1}/{visualCategories.length} {name}</option>)}</select></label><span>判定済み {entries.visual.filter(entry => entry.result).length}/{entries.visual.length}項目</span></div>
      {[category].map(category => <div key={category} className="field-group">
        <h2 className="field-heading">{category}</h2>
        {visualItems.filter(item => item.category === category).map(item => {
          const entry = entries.visual.find(visual => visual.itemId === item.itemId)!
          const finding = findingFor(item.itemId)
          const attach = (photo: InspectionPhoto) => change({ visual: currentEntries.current.visual.map(visual => visual.itemId === item.itemId ? { ...visual, photoIds: [...new Set([...visual.photoIds, photo.photoId])] } : visual) })
          const update = (patch: Partial<typeof entry>) => change({ visual: entries.visual.map(visual => visual.itemId === item.itemId ? { ...visual, ...patch } : visual) })
          return <article key={item.itemId} id={`visual:${item.itemId}`} className={`visual-item ${entry.result === '×' ? 'is-fail' : entry.result === '△' ? 'is-caution' : ''}`} data-testid={`visual-${item.itemId}`}>
            <div className="visual-item-head"><VisualIcon icon={item.icon} /><div><h3><span className="text-muted">{item.itemId}　</span>{item.title}</h3><p>{item.criterion}</p>{checkpointFor(item.itemId).map(point => <StatusChip key={point.key} label="前回指摘あり" tone="amber" />)}</div></div>
            <div className="result-buttons" role="radiogroup" aria-label={`${item.title}の判定`}>{results.map(result => <button key={result} role="radio" aria-checked={entry.result === result} className={`choice ${entry.result === result ? `is-active ${result === '×' ? 'is-fail' : result === '△' ? 'is-caution' : ''}` : ''}`} aria-label={result} onClick={() => update({ result })}>{result}<small>{result === '○' ? '異常なし' : result === '△' ? '要観察' : result === '×' ? '要対応' : '対象外'}</small></button>)}</div>
            <VisualDetails required={entry.result === '×' || entry.result === '△'} hasContent={!!entry.comment || !!entry.photoIds.length} photoCount={entry.photoIds.length}>
              <label className="field-label" htmlFor={`comment-${item.itemId}`}>{entry.result === '×' || entry.result === '△' ? '所見（必須）' : '所見（任意）'}</label>
              <textarea id={`comment-${item.itemId}`} className="field-textarea" value={entry.comment} placeholder="場所・状態・必要な対応を記入" onChange={event => update({ comment: event.target.value })} />
              <p className="field-photo-label">写真{entry.result === '×' || entry.result === '△' ? '（必須）：指摘の状態が分かる写真を追加してください' : '（任意）'}</p>
              <ItemPhotos itemId={item.itemId} photos={photos.filter(photo => entry.photoIds.includes(photo.photoId))}
                onUpload={async file => attach(await upload(item.itemId, item.title)(file))}
                onSelect={async id => attach(await props.onSelectPhoto({ refKey: item.itemId, label: item.title }, id))}
                onRemove={id => change({ visual: currentEntries.current.visual.map(visual => visual.itemId === item.itemId ? { ...visual, photoIds: visual.photoIds.filter(photoId => photoId !== id) } : visual), findings: currentEntries.current.findings.map(finding => finding.refKey === item.itemId ? { ...finding, photoIds: finding.photoIds.filter(photoId => photoId !== id) } : finding) })} />
              {(entry.result === '×' || entry.result === '△') && ['太陽電池アレイ', '架台・基礎', '配線'].includes(item.category) && <FindingButton site={site} finding={finding} onOpen={() => setFindingTarget({ refKey: item.itemId, source: 'visual', title: item.title })} />}
            </VisualDetails>
          </article>
        })}
      </div>)}

    </section>}

    {step === 'measure' && <section className="field-section" data-testid="field-measure">
      {entries.weather === '雨上がり' && <p className="field-warning"><AlertTriangle />{rainCaution}</p>}
      {site.pcs.map(pcs => <div key={pcs.pcsId} className="field-group">
        <div className="field-heading"><h2>{pcs.pcsId}</h2><span>{pcs.maker} {pcs.model}</span></div>
        {siteCircuits(site).filter(circuit => pcs.circuits.includes(circuit)).map(circuit => <div key={circuit.circuitId} className="measure-card">
          <div className="measure-card-head"><h3>{circuitLabel(circuit.circuitId).replace(`${pcs.pcsId} `, '')}</h3><span>{arrayRowsLabel(site, circuit.arrayId, circuit.rows)}・{circuit.seriesCount}直列</span></div>
          {entries.measurements.filter(entry => entry.circuitId === circuit.circuitId).map(entry => <MeasureField key={entry.key} entry={entry} {...measureProps(entry)} />)}
        </div>)}
        <div className="measure-card">
          <div className="measure-card-head"><h3>PCS本体・系統</h3></div>
          {entries.measurements.filter(entry => entry.pcsId === pcs.pcsId && !entry.circuitId).map(entry => <MeasureField key={entry.key} entry={entry} {...measureProps(entry)} />)}
        </div>
      </div>)}
      <div className="field-group">
        <h2 className="field-heading">発電所全体</h2>
        <div className="measure-card"><div className="measure-card-head"><h3>架台</h3></div>{entries.measurements.filter(entry => !entry.pcsId).map(entry => <MeasureField key={entry.key} entry={entry} {...measureProps(entry)} />)}</div>
      </div>
      <div className="field-actions"><button className="button button-primary button-field" onClick={() => go('check')} data-testid="to-check">入力漏れを確認する</button></div>
    </section>}

    {step === 'check' && <section className="field-section" data-testid="field-check">
      <h1 className="field-title">{missing.length ? `入力漏れが${missing.length}件あります` : '必要な入力が揃いました'}</h1>
      {missing.length ? <>
        <p className="field-hint">項目をタップすると、その入力欄へ移動します。</p>
        <ul className="missing-list">{missing.map(item => <li key={item.key}><button onClick={() => go(item.step, item.key.startsWith('weather') ? undefined : item.key.replace(/^(comment|photo):/, 'visual:'))}><strong>{item.title}</strong><span>{item.reason}</span></button></li>)}</ul>
        {props.onFillRest && <FillRestButton onClick={props.onFillRest} />}
      </> : <>
        <SummaryList entries={entries} />
        <ul className="field-review-items">{entries.visual.filter(entry => entry.result === '△' || entry.result === '×').map(entry => <li key={entry.itemId}><button onClick={() => go('visual', `visual:${entry.itemId}`)}><strong>{entry.result} {visualItems.find(item => item.itemId === entry.itemId)?.title}</strong><span>{entry.comment}</span><small>写真{entry.photoIds.length}枚・タップして修正</small></button></li>)}</ul>
        <div className="field-actions"><button className="button button-primary button-field" disabled={submitting} onClick={() => { setSubmitting(true); void props.onSubmit().finally(() => setSubmitting(false)) }} data-testid="submit-inspection">{submitting ? '送信中…' : '点検結果を提出する'}</button></div>
      </>}
    </section>}

    {findingTarget && <FindingSheet site={site} target={findingTarget} finding={findingFor(findingTarget.refKey)} photos={photos} onUploadPhoto={upload(findingTarget.refKey, `異常箇所 ${findingTarget.title}`)} onSave={saveFinding} onRemove={() => { change({ findings: entries.findings.filter(item => item.refKey !== findingTarget.refKey) }); setFindingTarget(null) }} onClose={() => setFindingTarget(null)} />}
  </FieldShell>

  function measureProps(entry: MeasurementEntry) {
    const previous = context.previousMeasurements.find(item => item.key === entry.key)
    return {
      criterion: criterionText(entry, site, entries.measurements),
      previous: previous?.raw ? measurementValue(previous) : undefined,
      checkpoints: checkpointFor(entry.key),
      finding: findingFor(entry.key),
      site,
      onRaw: (raw: string) => change({ measurements: entries.measurements.map(item => item.key === entry.key ? { ...item, raw } : item) }),
      onFinding: entry.circuitId ? () => setFindingTarget({ refKey: entry.key, source: 'measurement', title: measurementTitle(entry), circuitId: entry.circuitId }) : undefined,
    }
  }
}

function VisualDetails({ required, hasContent, photoCount, children }: { required: boolean; hasContent: boolean; photoCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(hasContent)
  return <div className="visual-details">{!required && <button className="button button-ghost optional-details" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '所見・写真を閉じる' : `所見・写真を追加（任意）${photoCount ? `・${photoCount}枚` : ''}`}</button>}{(required || open) && <div className="visual-observation">{children}</div>}</div>
}

function FieldShell({ children, step, onStep, plantName, syncLabel, error, onClose, visualDone, measured, missingCount, entries, footer }: FieldAppProps & { children: ReactNode; step: FieldStep | null; onStep: (step: FieldStep) => void; visualDone?: number; measured?: number; missingCount?: number; footer?: ReactNode }) {
  const counts: Partial<Record<FieldStep, string>> = { visual: `${visualDone}/${entries.visual.length}`, measure: `${measured}/${entries.measurements.length}`, check: missingCount ? `不足${missingCount}か所` : '入力済み' }
  return <div className="field-app">
    <header className="field-top">
      <div className="field-top-row"><strong>{plantName}</strong><span className="field-sync" data-testid="field-sync">{syncLabel}</span>{onClose && <button className="icon-button" onClick={onClose} aria-label="現場入力を閉じる"><X /></button>}</div>
      {step && <nav className="field-steps" aria-label="入力の手順">{steps.filter(item => item.step !== 'measure' || entries.measurements.length).map(item => <button key={item.step} className={step === item.step ? 'is-active' : ''} aria-current={step === item.step ? 'step' : undefined} onClick={() => onStep(item.step)} data-testid={`step-${item.step}`}>{item.label}{counts[item.step] && <span>{counts[item.step]}</span>}</button>)}</nav>}
    </header>
    {error && <p className="field-error" role="alert"><AlertTriangle />{error}</p>}
    <main className="field-main">{children}</main>
    {step && step !== 'start' && <footer className="field-bottom">{footer ?? <><button className="button button-ghost" onClick={() => { const available = steps.filter(item => item.step !== 'measure' || entries.measurements.length); onStep(available[Math.max(0, available.findIndex(item => item.step === step) - 1)].step) }}><ArrowLeft />戻る</button></>}</footer>}
  </div>
}

function CheckpointItem({ point }: { point: Checkpoint }) {
  return <li><strong>{point.target}</strong><StatusChip label={point.label} tone={point.kind === 'openRepair' ? 'blue' : 'amber'} /><p>{point.reason}</p></li>
}

function FillRestButton({ onClick }: { onClick: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return <button className="button button-ghost fill-rest" disabled={busy} onClick={() => { setBusy(true); void Promise.resolve(onClick()).finally(() => setBusy(false)) }} data-testid="fill-rest"><ListChecks />{busy ? '入力中…' : '残りを一括入力'}</button>
}

function FindingButton({ site, finding, onOpen }: { site: FieldContext['site']; finding?: Finding; onOpen: () => void }) {
  return <button className={`finding-button ${finding ? 'is-set' : ''}`} onClick={onOpen} data-testid="open-finding">
    <MapPin size={18} /><span><strong>{finding ? '異常箇所' : '異常箇所を指定'}</strong>{finding && <small>{[panelLocation(site, finding.arrayId, finding.panels), finding.circuitId && circuitLabel(finding.circuitId)].filter(Boolean).join('・') || finding.comment}</small>}</span>
  </button>
}

function MeasureField({ entry, criterion, previous, checkpoints, finding, site, onRaw, onFinding }: { entry: MeasurementEntry; criterion: string; previous?: string; checkpoints: Checkpoint[]; finding?: Finding; site: FieldContext['site']; onRaw: (raw: string) => void; onFinding?: () => void }) {
  const label = measurementTitle(entry).replace(/^(PCS-\d+ 回路\d+|PCS-\d+|発電所) /, '')
  const flagged = entry.judgement === '不適合' || entry.judgement === '要確認'
  return <div id={`measure:${entry.key}`} className={`measure-field ${checkpoints.length ? 'is-checkpoint' : ''}`} data-testid={`measure-${entry.key}`}>
    <div className="measure-row">
      <label htmlFor={`input-${entry.key}`}>{label}</label>
      <div className="measure-input">
        <input id={`input-${entry.key}`} type="text" inputMode="decimal" autoComplete="off" value={entry.raw} onChange={event => onRaw(event.target.value)} aria-describedby={`hint-${entry.key}`} />
        <span>{measurementUnits[entry.kind]}</span>
        {overRangeKinds.has(entry.kind) && <button className="infinity-button" onClick={() => onRaw('∞')} aria-label={`${label}を測定上限超え（∞）にする`}>∞</button>}
      </div>
      <JudgementMark judgement={entry.judgement} />
    </div>
    <p className="measure-hint" id={`hint-${entry.key}`}>基準 {criterion}{previous && `／前回 ${previous}`}</p>
    {checkpoints.map(point => <p key={point.key} className="measure-checkpoint">{point.label}：{point.reason}</p>)}
    {flagged && <p className={`measure-reason is-${entry.judgement === '不適合' ? 'fail' : 'caution'}`}>{entry.reason}</p>}
    {entry.caution && <p className="measure-reason is-caution">{entry.caution}</p>}
    {flagged && onFinding && <FindingButton site={site} finding={finding} onOpen={onFinding} />}
  </div>
}

function SummaryList({ entries }: { entries: FieldEntries }) {
  const visualOk = entries.visual.filter(entry => entry.result === '○').length
  const visualCaution = entries.visual.filter(entry => entry.result === '△').length
  const visualNone = entries.visual.filter(entry => entry.result === '該当なし').length
  const visualFail = entries.visual.filter(entry => entry.result === '×').length
  const failed = entries.measurements.filter(entry => entry.judgement === '不適合').length
  const caution = entries.measurements.filter(entry => entry.judgement === '要確認').length
  const photoCount = new Set([...entries.visual.flatMap(entry => entry.photoIds), ...entries.findings.flatMap(finding => finding.photoIds)]).size
  return <dl className="field-summary">
    <div><dt>天候</dt><dd>{entries.weather}</dd></div>
    <div><dt>異常なし（○）</dt><dd>{visualOk}件</dd></div>
    <div><dt>要観察（△）</dt><dd className={visualCaution ? 'text-caution' : ''}>{visualCaution}件</dd></div>
    <div><dt>対象外</dt><dd>{visualNone}件</dd></div>
    <div><dt>要対応（×）</dt><dd className={visualFail ? 'text-fail' : ''}>{visualFail}件</dd></div>
    {!!entries.measurements.length && <><div><dt>測定の不適合</dt><dd className={failed ? 'text-fail' : ''}>{failed}件</dd></div>
    <div><dt>測定の要確認</dt><dd className={caution ? 'text-caution' : ''}>{caution}件</dd></div></>}
    <div><dt>異常箇所</dt><dd>{entries.findings.length}件</dd></div>
    <div><dt>写真</dt><dd>{photoCount}枚</dd></div>
  </dl>
}

function CompleteView({ entries, plantName, onClose, onReport }: { entries: FieldEntries; plantName: string; onClose?: () => void; onReport?: () => void }) {
  return <section className="field-section field-complete" data-testid="field-complete">
    <CheckCircle2 className="complete-mark" size={40} />
    <h1 className="field-title">管理側へ提出しました</h1>
    <p className="field-hint">{plantName}の点検結果を送信しました。報告書は事務所で作成します。</p>
    <SummaryList entries={entries} />
    {onReport && <div className="field-actions"><button className="button button-primary button-field" onClick={onReport} data-testid="make-report-from-local">報告書を作成</button></div>}
    {onClose && <div className="field-actions"><button className="button button-secondary button-field" onClick={onClose}>現場入力を閉じる</button></div>}
  </section>
}
