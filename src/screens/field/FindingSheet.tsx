import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ArrayDiagram } from '../../components/ArrayDiagram'
import { circuitLabel } from '../../logic/labels'
import { circuitForPanel, findCircuit } from '../../logic/site'
import type { Finding, InspectionPhoto, Site } from '../../types'
import { PhotoCapture } from './PhotoCapture'

export type FindingTarget = { refKey: string; source: Finding['source']; title: string; circuitId?: string }
type Panel = { row: number; col: number }

// 異常箇所の指定（SDD 4.3-4）。アレイ図でパネルを選ぶと担当回路を引き、測定の指摘なら測定した回路を固定で紐付ける。
export function FindingSheet({ site, target, finding, photos, onUploadPhoto, onSave, onRemove, onClose }: { site: Site; target: FindingTarget; finding?: Finding; photos: InspectionPhoto[]; onUploadPhoto: (file: File) => Promise<InspectionPhoto>; onSave: (finding: Finding) => void; onRemove: () => void; onClose: () => void }) {
  const fixedCircuit = findCircuit(site, target.circuitId)
  const [arrayId, setArrayId] = useState(finding?.arrayId ?? fixedCircuit?.arrayId ?? site.arrays[0].arrayId)
  const [panels, setPanels] = useState<Panel[]>(finding?.arrayId === arrayId ? finding.panels ?? [] : [])
  const [comment, setComment] = useState(finding?.comment ?? '')
  const [photoIds, setPhotoIds] = useState(finding?.photoIds ?? [])
  const array = site.arrays.find(item => item.arrayId === arrayId)!
  const circuitId = target.circuitId ?? (panels[0] ? circuitForPanel(site, arrayId, panels[0].row)?.circuitId : undefined)
  const highlightRows = fixedCircuit && fixedCircuit.arrayId === arrayId ? fixedCircuit.rows : []
  const toggle = (panel: Panel) => setPanels(current => current.some(item => item.row === panel.row && item.col === panel.col) ? current.filter(item => !(item.row === panel.row && item.col === panel.col)) : [...current, panel])
  const outsideCircuit = fixedCircuit && panels.some(panel => fixedCircuit.arrayId !== arrayId || !fixedCircuit.rows.includes(panel.row))

  return <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="finding-title" data-testid="finding-sheet">
    <div className="sheet">
      <header className="sheet-header"><div><h2 id="finding-title">異常箇所を指定</h2><p>{target.title}</p></div><button className="icon-button" onClick={onClose} aria-label="閉じる"><X /></button></header>
      <div className="sheet-body">
        {site.arrays.length > 1 && <div className="segmented" role="tablist">{site.arrays.map(item => <button key={item.arrayId} role="tab" aria-selected={item.arrayId === arrayId} className={item.arrayId === arrayId ? 'is-active' : ''} onClick={() => { setArrayId(item.arrayId); setPanels([]) }}>{item.label}</button>)}</div>}
        <p className="field-hint">該当するパネルをタップしてください（複数選べます）。{fixedCircuit && `色の付いた段が${circuitLabel(fixedCircuit.circuitId)}の担当です。`}</p>
        <div className="array-scroll"><ArrayDiagram array={array} selected={panels} highlightRows={highlightRows} onToggle={toggle} /></div>
        <dl className="finding-summary">
          <div><dt>選んだパネル</dt><dd>{panels.length ? panels.map(panel => `${panel.row}段目${panel.col}列目`).join('・') : 'なし'}</dd></div>
          <div><dt>回路</dt><dd data-testid="finding-circuit">{circuitId ? circuitLabel(circuitId) : '—'}</dd></div>
        </dl>
        {outsideCircuit && <p className="field-warning">選んだパネルは、測定した回路の担当外です。</p>}
        <label className="field-label" htmlFor="finding-comment">内容</label>
        <textarea id="finding-comment" className="field-textarea" value={comment} onChange={event => setComment(event.target.value)} placeholder="例：表面ガラスに割れ、雨水が入りやすい状態" />
        <PhotoCapture label="異常箇所の写真" photos={photos.filter(photo => photoIds.includes(photo.photoId))} onCapture={async file => { const photo = await onUploadPhoto(file); setPhotoIds([photo.photoId]) }} />
      </div>
      <footer className="sheet-footer">
        {finding && <button className="button button-ghost" onClick={onRemove}><Trash2 />指定を外す</button>}
        <button className="button button-primary button-field" disabled={!panels.length && !comment.trim()} onClick={() => onSave({ findingId: finding?.findingId ?? `F-${crypto.randomUUID()}`, source: target.source, refKey: target.refKey, arrayId: panels.length ? arrayId : undefined, panels: panels.length ? panels : undefined, circuitId, comment: comment.trim(), photoIds })} data-testid="save-finding">この内容で記録</button>
      </footer>
    </div>
  </div>
}
