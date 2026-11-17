import { useEffect, useMemo, useState, type SetStateAction } from 'react'
import { AppShell, type AdminView } from './components/AppShell'
import { AssignmentModal } from './components/AssignmentModal'
import { buildCheckpoints } from './logic/checkpoints'
import { toDateString } from './logic/dates'
import { pastInspections } from './logic/history'
import { completeInspection as completeInspectionState } from './logic/lifecycle'
import { resolveLinkedRepairs } from './logic/repairs'
import { buildProposals } from './logic/proposals'
import { buildReportText, defaultReportLayout, inspectionPhotos } from './logic/report'
import { advanceStatus } from './logic/status'
import { approvedInspectionReport, approveInspectionReport, editReportReview, inspectionFromReview, reportProgress, returnInspectionReport, storeReportCheck, submitInspectionReport } from './logic/reportWorkflow'
import { MonitoringScreen } from './screens/MonitoringScreen'
import { PhotoReviewScreen } from './screens/PhotoReviewScreen'
import { PrepScreen } from './screens/PrepScreen'
import { KarteScreen } from './screens/KarteScreen'
import { RepairDetailScreen, RepairListScreen } from './screens/RepairScreens'
import { ReportScreen } from './screens/ReportScreen'
import { ReportCheckDetailScreen, ReportCheckListScreen } from './screens/ReportCheckScreens'
import { ScheduleScreen } from './screens/ScheduleScreen'
import { loadState, resetState, saveState } from './services/demoStore'
import { reportCheckService } from './services/reportCheckService'
import { LocalField } from './screens/field/LocalField'
import { SharedField } from './screens/field/SharedField'
import { isConnectionError, resizeImage, sharedInspectionService, type FieldContext, type SharedInspection } from './services/sharedInspectionService'
import type { Inspection, InspectionPhoto, RepairCase, ReportCheckIssue, ReportReview } from './types'

// offline：Functionsに繋がらない。同じ端末での現場入力を案内する
type ShareState = { open: boolean; shared: SharedInspection | null; loading: boolean; error: string; offline: boolean }
const closedShare: ShareState = { open: false, shared: null, loading: false, error: '', offline: false }
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

function App() {
  const fieldToken = new URLSearchParams(window.location.search).get('field')
  return fieldToken ? <SharedField token={fieldToken} fill={new URLSearchParams(window.location.search).get('fill') === '1'} /> : <Admin />
}

function Admin() {
  const [view, setView] = useState<AdminView>('schedule')
  const [state, setState] = useState(() => loadState())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [share, setShare] = useState<ShareState>(closedShare)
  const [localField, setLocalField] = useState(false)
  const [photoWork, setPhotoWork] = useState({ busy: false, error: '' })
  const [karteSiteId, setKarteSiteId] = useState<string | null>(null)
  const [repairId, setRepairId] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [reviewWork, setReviewWork] = useState({ reviewId: '', busy: false, error: '' })
  useEffect(() => saveState(state), [state])

  const selected = state.inspections.find(inspection => inspection.inspectionId === selectedId)
  const site = selected && state.sites.find(item => item.siteId === selected.siteId)
  const sourceReview = selected && state.reportReviews.find(item => item.inspection.inspectionId === selected.inspectionId)
  const sourceProgress = selected && site ? reportProgress(selected, site, sourceReview) : null
  const canComplete = Boolean(selected && approvedInspectionReport(state, selected.inspectionId))
  const history = useMemo(() => selected ? pastInspections(state.inspections, selected) : [], [state.inspections, selected])
  const checkpoints = useMemo(() => site ? buildCheckpoints(site, history, state.repairCases) : [], [site, history, state.repairCases])
  const fieldContext = useMemo<FieldContext | null>(() => site && selected ? { site, checkpoints, previousMeasurements: history.at(-1)?.measurements ?? [], scheduledOn: selected.scheduledOn, inspector: selected.inspector } : null, [site, selected, checkpoints, history])

  const updateInspection = (inspectionId: string, update: (inspection: Inspection) => Inspection) => setState(current => ({ ...current, inspections: current.inspections.map(inspection => inspection.inspectionId === inspectionId ? update(inspection) : inspection) }))
  const addPhotos = (photos: InspectionPhoto[]) => setState(current => ({ ...current, photos: [...current.photos.filter(photo => !photos.some(item => item.photoId === photo.photoId)), ...photos] }))
  // 現場の入力内容を管理側の点検データへ取り込む（ライブ反映）。提出後に管理側で編集した内容は上書きしない。
  const applyShared = (inspectionId: string, shared: SharedInspection) => {
    setShare(current => ({ ...current, shared }))
    updateInspection(inspectionId, inspection => {
      const status = advanceStatus(inspection.status, shared.status)
      if (inspection.status === '報告書作成済み' || inspection.status === '完了') return { ...inspection, status }
      return { ...inspection, status, visual: shared.visual, measurements: shared.measurements, findings: shared.findings, weather: shared.weather, ...(shared.submittedAt ? { inspectedOn: toDateString(new Date(shared.submittedAt)) } : {}) }
    })
    addPhotos(shared.photos)
  }

  // 依頼モーダルか点検準備を開いている間は、現場の入力状況を5秒ごとに取り込む
  const shareToken = selected?.shareToken
  const watching = !selected?.localField && (share.open || (view === 'prep' && (selected?.status === '依頼済み' || selected?.status === '点検中')))
  useEffect(() => {
    if (!watching || !shareToken || !selectedId) return
    const timer = window.setInterval(() => { void sharedInspectionService.get(shareToken).then(shared => applyShared(selectedId, shared)).catch(() => undefined) }, 5000)
    return () => window.clearInterval(timer)
  }, [watching, shareToken, selectedId])

  const openPrep = (inspectionId: string) => {
    setSelectedId(inspectionId)
    setView('prep')
    window.scrollTo(0, 0)
  }

  const requestField = async () => {
    if (!selected || !site || !fieldContext) return
    // 同じ端末で入力中の点検は、スマホ枠を開き直す
    if (selected.localField) return setLocalField(true)
    setShare({ ...closedShare, open: true, loading: true })
    const token = selected.shareToken ?? crypto.randomUUID().replaceAll('-', '')
    try {
      const shared = await sharedInspectionService.create(token, {
        inspectionId: selected.inspectionId, siteId: site.siteId, visual: selected.visual, measurements: selected.measurements,
        context: fieldContext,
        plantName: site.name, address: site.address, requestTitle: '定期点検',
      })
      updateInspection(selected.inspectionId, inspection => ({ ...inspection, shareToken: token, status: advanceStatus(inspection.status === '未依頼' ? '依頼済み' : inspection.status, shared.status) }))
      setShare({ ...closedShare, open: true, shared })
    } catch (error) { setShare(current => ({ ...current, loading: false, offline: isConnectionError(error), error: errorMessage(error, '点検依頼を作成できませんでした') })) }
  }

  const openLocalField = () => {
    if (!selected) return
    updateInspection(selected.inspectionId, inspection => ({ ...inspection, localField: true, status: inspection.status === '未依頼' ? '依頼済み' : inspection.status }))
    setShare(closedShare)
    setLocalField(true)
  }

  const refreshShared = async () => {
    if (!selected?.shareToken) return
    setShare(current => ({ ...current, loading: true, error: '' }))
    try { applyShared(selected.inspectionId, await sharedInspectionService.get(selected.shareToken)) }
    catch (error) { setShare(current => ({ ...current, error: errorMessage(error, '現場の入力状況を取得できませんでした') })) }
    finally { setShare(current => ({ ...current, loading: false })) }
  }

  const resetShared = async () => {
    if (!selected?.shareToken || !window.confirm('現場で入力した判定・測定値・写真を削除して、点検を最初からやり直しますか？')) return
    setShare(current => ({ ...current, loading: true, error: '' }))
    try {
      const shared = await sharedInspectionService.reset(selected.shareToken)
      setShare(current => ({ ...current, shared }))
      updateInspection(selected.inspectionId, inspection => ({ ...inspection, status: '依頼済み' }))
    } catch (error) { setShare(current => ({ ...current, error: errorMessage(error, '点検をやり直せませんでした') })) }
    finally { setShare(current => ({ ...current, loading: false })) }
  }

  // 結果確認 → 写真確認 → 報告書（SDD 4.4・4.5）
  const openReportFlow = () => {
    if (!selected) return
    setShare(closedShare)
    setLocalField(false)
    if (!selected.reportLayout) updateInspection(selected.inspectionId, inspection => ({ ...inspection, reportLayout: defaultReportLayout(inspection, state.photos) }))
    setView(selected.status === '提出済み' ? 'photos' : 'report')
    window.scrollTo(0, 0)
  }

  const setIncludedPhotos = (value: SetStateAction<string[]>) => {
    if (!selected) return
    updateInspection(selected.inspectionId, inspection => {
      const layout = inspection.reportLayout ?? []
      const ids = typeof value === 'function' ? value(layout.map(entry => entry.photoId)) : value
      return { ...inspection, reportLayout: ids.map(id => layout.find(entry => entry.photoId === id) ?? { photoId: id, zone: 'ledger' }) }
    })
  }

  // 写真の差し替え：共有URLモードはBlobsへ、同じ端末のモードは端末に保存し、点検内の参照を新しい写真に付け替える
  const replacePhoto = async (old: InspectionPhoto, file: File) => {
    if (!selected) return
    setPhotoWork({ busy: true, error: '' })
    try {
      const replacement: InspectionPhoto = selected.shareToken
        ? await sharedInspectionService.uploadPhoto(selected.shareToken, { inspectionItemId: old.inspectionItemId, equipmentId: old.equipmentId }, old.photoType, file)
        : { ...old, photoId: `PH-${crypto.randomUUID()}`, takenAt: new Date().toISOString(), url: await resizeImage(file, 1024, .7) }
      addPhotos([replacement])
      const swap = (ids: string[]) => ids.map(id => id === old.photoId ? replacement.photoId : id)
      updateInspection(selected.inspectionId, inspection => ({
        ...inspection,
        visual: inspection.visual.map(entry => ({ ...entry, photoIds: swap(entry.photoIds) })),
        findings: inspection.findings.map(finding => ({ ...finding, photoIds: swap(finding.photoIds) })),
        reportLayout: inspection.reportLayout?.map(entry => entry.photoId === old.photoId ? { ...entry, photoId: replacement.photoId } : entry),
      }))
      setPhotoWork({ busy: false, error: '' })
    } catch (error) { setPhotoWork({ busy: false, error: errorMessage(error, '写真を差し替えられませんでした') }) }
  }

  const openReport = () => {
    if (!selected || !site) return
    updateInspection(selected.inspectionId, inspection => ({ ...inspection, status: inspection.status === '提出済み' ? '報告書作成済み' : inspection.status, reportText: inspection.reportText ?? buildReportText(inspection, site, history.at(-1), inspection.reportOptions) }))
    setView('report')
    window.scrollTo(0, 0)
  }

  // 点検を完了する：修繕案件の自動作成と1年後の予定まで（SDD 4.6・4.7）
  const completeInspection = () => {
    if (!selected || !approvedInspectionReport(state, selected.inspectionId) || !window.confirm('承認済みの報告書で点検を完了し、修繕案件と1年後の点検予定を作成します。よろしいですか？')) return
    setState(current => completeInspectionState(current, selected.inspectionId, toDateString(new Date())))
  }

  const go = (next: AdminView) => { setView(next); window.scrollTo(0, 0) }
  const openKarte = (siteId: string) => { setKarteSiteId(siteId); go('karte') }
  const openRepair = (caseId: string) => { setRepairId(caseId); go('repair') }
  const openReview = (id: string) => { setReviewId(id); go('reportCheck') }
  const review = state.reportReviews.find(item => item.reviewId === reviewId)
  const reviewSite = review && state.sites.find(item => item.siteId === review.siteId)
  const updateReview = (id: string, update: (review: ReportReview) => ReportReview) => setState(current => ({ ...current, reportReviews: current.reportReviews.map(item => item.reviewId === id ? update(item) : item) }))
  const changeReview = (patch: Partial<ReportReview>) => {
    if (!review || review.status === '承認済み') return
    setState(current => editReportReview(current, review.reviewId, patch))
  }
  const runReportCheck = async () => {
    if (!review || !reviewSite) return
    setReviewWork({ reviewId: review.reviewId, busy: true, error: '' })
    try {
      const check = await reportCheckService.check(review, reviewSite)
      updateReview(review.reviewId, current => storeReportCheck(current, reviewSite, check))
    } catch (error) { setReviewWork({ reviewId: review.reviewId, busy: false, error: errorMessage(error, 'チェックを実行できませんでした。もう一度お試しください。') }); return }
    setReviewWork({ reviewId: review.reviewId, busy: false, error: '' })
  }
  const confirmReviewIssue = (issue: ReportCheckIssue, note: string) => {
    if (!review || review.status === '承認済み' || !note.trim()) return
    updateReview(review.reviewId, current => ({ ...current, confirmations: { ...current.confirmations, [issue.key]: { fingerprint: issue.fingerprint, note: note.trim() } } }))
  }
  const submitForReview = () => {
    if (!selected || !site) return
    setState(current => submitInspectionReport(current, selected.inspectionId))
    openReview(`REVIEW-${selected.inspectionId}`)
  }
  const openReviewSource = () => {
    if (!review) return
    setSelectedId(review.inspection.inspectionId)
    setLocalField(false)
    setShare(closedShare)
    go('report')
  }
  const karteSite = state.sites.find(item => item.siteId === (karteSiteId ?? selected?.siteId)) ?? state.sites.find(item => item.siteId === 'S-03') ?? state.sites[0]
  const repair = state.repairCases.find(item => item.caseId === repairId)
  const repairInspection = repair && state.inspections.find(item => item.inspectionId === repair.inspectionId)
  const repairSite = repair && state.sites.find(item => item.siteId === repair.siteId)
  const updateRepair = (next: RepairCase) => setState(current => {
    const repairCases = current.repairCases.map(item => item.caseId === next.caseId ? next : item)
    const inspection = current.inspections.find(item => item.inspectionId === next.inspectionId)
    const site = current.sites.find(item => item.siteId === next.siteId)
    return { ...current, repairCases: inspection && site ? resolveLinkedRepairs(repairCases, next, inspection, site) : repairCases }
  })
  const uploadRepairPhoto = async (file: File, label: string) => {
    const photo: InspectionPhoto = { photoId: `PH-${crypto.randomUUID()}`, inspectionItemId: repairId ?? '', equipmentId: '', photoType: label, takenAt: new Date().toISOString(), url: await resizeImage(file, 1024, .7) }
    addPhotos([photo])
    return photo
  }

  const resetData = () => {
    if (!window.confirm('点検予定・点検結果・修繕案件・報告書チェックを初期状態に戻します。よろしいですか？')) return
    setState(resetState())
    setSelectedId(null)
    setShare(closedShare)
    setLocalField(false)
    setRepairId(null)
    setKarteSiteId(null)
    setReviewId(null)
    setView('schedule')
  }

  const progress = share.shared && {
    visual: share.shared.visual.filter(entry => entry.result).length,
    abnormal: share.shared.visual.filter(entry => entry.result === '×').length,
    measured: share.shared.measurements.filter(entry => entry.raw).length,
    failed: share.shared.measurements.filter(entry => entry.judgement === '不適合').length,
  }

  return <AppShell view={view} onNavigate={go}>
    {view === 'monitoring' && <MonitoringScreen sites={state.sites} inspections={state.inspections} repairCases={state.repairCases} onOpenKarte={openKarte} />}
    {view === 'schedule' && <ScheduleScreen sites={state.sites} inspections={state.inspections} reviews={state.reportReviews} onOpenReview={openReview} onOpen={openPrep} onReset={resetData} />}
    {view === 'prep' && selected && site && <PrepScreen site={site} inspection={selected} review={sourceReview} progress={sourceProgress} onReview={() => sourceReview && openReview(sourceReview.reviewId)} previous={history.at(-1)} checkpoints={checkpoints} localMode={Boolean(selected.localField)} onBack={() => { setLocalField(false); setView('schedule') }} onRequest={() => void requestField()} onReport={openReportFlow} />}
    {view === 'photos' && selected && <PhotoReviewScreen photos={inspectionPhotos(selected, state.photos)} includedIds={(selected.reportLayout ?? []).map(entry => entry.photoId)} syncing={photoWork.busy} error={photoWork.error} onIncludedChange={setIncludedPhotos} onReplace={(photo, file) => void replacePhoto(photo, file)} onBack={() => setView('prep')} onConfirm={openReport} />}
    {view === 'report' && selected && site && <ReportScreen site={site} inspection={selected} previous={history.at(-1)} photos={state.photos}
      onChange={patch => updateInspection(selected.inspectionId, inspection => ({ ...inspection, ...patch }))}
      onRegenerate={() => updateInspection(selected.inspectionId, inspection => ({ ...inspection, reportText: buildReportText(inspection, site, history.at(-1), inspection.reportOptions) }))}
      onOptions={options => updateInspection(selected.inspectionId, inspection => ({ ...inspection, reportOptions: options, reportText: { summary: inspection.reportText?.summary ?? '', proposals: buildProposals(inspection, site, history.at(-1), options) } }))}
      onBack={() => go(sourceProgress === 'チェック待ち' || sourceProgress === '承認済み' || selected.status === '完了' ? 'prep' : 'photos')}
      backLabel={sourceProgress === 'チェック待ち' || sourceProgress === '承認済み' || selected.status === '完了' ? '点検準備へ戻る' : undefined} onComplete={completeInspection} onSubmitForCheck={submitForReview}
      review={sourceReview} progress={sourceProgress} canComplete={canComplete} onOpenSchedule={() => go('schedule')}
      createdRepairs={state.repairCases.filter(item => item.inspectionId === selected.inspectionId).length}
      nextScheduledOn={selected.status === '完了' ? state.inspections.filter(item => item.siteId === selected.siteId && item.scheduledOn > selected.scheduledOn).sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))[0]?.scheduledOn : undefined}
      onOpenRepairs={() => go('repairs')} onOpenKarte={() => openKarte(selected.siteId)} />}
    {view === 'reportChecks' && <ReportCheckListScreen reviews={state.reportReviews} onOpen={openReview} />}
    {view === 'reportCheck' && review && reviewSite && <ReportCheckDetailScreen key={review.reviewId} review={review} site={reviewSite} sites={state.sites} busy={reviewWork.reviewId === review.reviewId && reviewWork.busy} error={reviewWork.reviewId === review.reviewId ? reviewWork.error : ''}
      onBack={() => go('reportChecks')} onCheck={() => void runReportCheck()} onChange={changeReview} onConfirm={confirmReviewIssue}
      onApprove={(name, confirmed) => setState(current => approveInspectionReport(current, review.reviewId, name, confirmed))}
      onReturn={(name, note) => setState(current => returnInspectionReport(current, review.reviewId, name, note))}
      onResubmit={() => setState(current => submitInspectionReport(current, review.inspection.inspectionId))}
      onOpenSource={openReviewSource} onOpenSchedule={() => go('schedule')} completed={state.inspections.find(item => item.inspectionId === review.inspection.inspectionId)?.status === '完了'}
      onOpenReport={() => go('checkedReport')} />}
    {view === 'checkedReport' && review && reviewSite && <ReportScreen readOnly site={reviewSite} inspection={inspectionFromReview(review)} previous={pastInspections(state.inspections, review.inspection).at(-1)} photos={review.photos}
      onBack={() => go('reportCheck')} onChange={() => undefined} onRegenerate={() => undefined} onOptions={() => undefined} onComplete={() => undefined} createdRepairs={0} onOpenRepairs={() => undefined} onOpenKarte={() => undefined} />}
    {view === 'repairs' && <RepairListScreen sites={state.sites} inspections={state.inspections} repairCases={state.repairCases} onOpen={openRepair} />}
    {view === 'repair' && repair && repairInspection && repairSite && <RepairDetailScreen repair={repair} site={repairSite} inspection={repairInspection} photos={state.photos} onChange={updateRepair} onUploadPhoto={uploadRepairPhoto} onBack={() => go('repairs')} onOpenKarte={() => openKarte(repair.siteId)} />}
    {view === 'karte' && karteSite && <KarteScreen sites={state.sites} site={karteSite} inspections={state.inspections} repairCases={state.repairCases} onSelectSite={setKarteSiteId} onOpenInspection={openPrep} onOpenRepair={openRepair} />}
    {localField && view === 'prep' && selected && site && fieldContext && <LocalField site={site} inspection={selected} context={fieldContext} photos={state.photos} onUpdate={patch => updateInspection(selected.inspectionId, inspection => ({ ...inspection, ...patch }))} onAddPhotos={addPhotos} onClose={() => setLocalField(false)} />}
    {share.open && <AssignmentModal token={selected?.shareToken ?? ''} shared={share.shared} loading={share.loading} error={share.error} fallback={share.offline && <div className="offline-fallback"><p>この会場では現場のスマホとつながりません。この端末の画面で現場入力を続けられます。</p><button className="button button-primary" onClick={openLocalField} data-testid="open-local-field">この端末で現場入力を開く</button></div>} onClose={() => setShare(closedShare)} onRefresh={() => void refreshShared()} onReset={() => void resetShared()} onReport={openReportFlow}>
      {share.shared && <section className="offline-fallback local-option"><p>オンライン会議で画面共有するときは、この画面の中で現場入力を見せられます（共有URL側の入力はこの点検に取り込まなくなります）。</p><button className="button button-secondary" onClick={openLocalField} data-testid="open-local-field-here">この画面で現場入力を開く</button></section>}
      {share.shared && progress && <section className="summary-strip submission-progress" aria-label="現場の入力状況">
        <div><span>天候</span><strong>{share.shared.weather ?? '—'}</strong></div>
        <div><span>目視点検</span><strong>{progress.visual}<small> / {share.shared.visual.length}</small></strong></div>
        <div className={progress.abnormal ? 'is-alert' : ''}><span>目視の指摘（×）</span><strong>{progress.abnormal}</strong></div>
        <div><span>測定</span><strong>{progress.measured}<small> / {share.shared.measurements.length}</small></strong></div>
        <div className={progress.failed ? 'is-alert' : ''}><span>不適合</span><strong>{progress.failed}</strong></div>
      </section>}
    </AssignmentModal>}
  </AppShell>
}

export default App
