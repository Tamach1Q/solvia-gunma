import { adminLocationHash, readAdminLocation } from './logic/navigation'
import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'
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
import { WorkReportScreen } from './screens/WorkReportScreen'
import { ReportScreen } from './screens/ReportScreen'
import { ReportCheckDetailScreen, ReportCheckListScreen } from './screens/ReportCheckScreens'
import { ScheduleScreen } from './screens/ScheduleScreen'
import { loadState, resetState, saveState } from './services/demoStore'
import { reportCheckService } from './services/reportCheckService'
import { LocalField } from './screens/field/LocalField'
import { LoginScreen } from './screens/LoginScreen'
import { loadSession, signOut, type Session } from './services/session'
import { SharedField } from './screens/field/SharedField'
import { isConnectionError, resizeImage, sharedInspectionService, type FieldContext, type SharedInspection } from './services/sharedInspectionService'
import type { Inspection, InspectionPhoto, RepairCase, ReportCheckIssue, ReportReview } from './types'

// offline：Functionsに繋がらない。同じ端末での現場入力を案内する
type ShareState = { open: boolean; shared: SharedInspection | null; loading: boolean; error: string; offline: boolean }
const closedShare: ShareState = { open: false, shared: null, loading: false, error: '', offline: false }
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

function App() {
  const fieldToken = new URLSearchParams(window.location.search).get('field')
  // 現場用URL（?field=）はアカウントを持たない作業員も開くので、ログインなしで現場画面だけを出す
  return fieldToken ? <SharedField token={fieldToken} fill={new URLSearchParams(window.location.search).get('fill') === '1'} /> : <SignedIn />
}

function SignedIn() {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  if (!session) return <LoginScreen onSignIn={setSession} />
  return <Admin session={session} onSignOut={() => { signOut(); setSession(null) }} />
}

function Admin({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [initialLocation] = useState(() => readAdminLocation(window.location.hash))
  const restoringLocation = useRef(false)
  const [view, setView] = useState<AdminView>(initialLocation.view)
  const [state, setState] = useState(() => loadState())
  const [selectedId, setSelectedId] = useState<string | null>(initialLocation.inspectionId)
  const activeShare = useRef<string | null>(null)
  const [share, setShare] = useState<ShareState>(closedShare)
  const [localField, setLocalField] = useState(false)
  const [photoWork, setPhotoWork] = useState({ busy: false, error: '' })
  const [karteSiteId, setKarteSiteId] = useState<string | null>(initialLocation.siteId)
  const [repairId, setRepairId] = useState<string | null>(initialLocation.repairId)
  const [reviewId, setReviewId] = useState<string | null>(initialLocation.reviewId)
  const [reviewWork, setReviewWork] = useState({ reviewId: '', busy: false, error: '' })
  useEffect(() => saveState(state), [state])

  const closeShare = () => {
    activeShare.current = null
    setShare(closedShare)
  }

  useEffect(() => {
    const restore = () => {
      restoringLocation.current = true
      const route = readAdminLocation(window.location.hash)
      setView(route.view); setSelectedId(route.inspectionId); setKarteSiteId(route.siteId); setRepairId(route.repairId); setReviewId(route.reviewId)
      setLocalField(false); closeShare(); window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  useEffect(() => {
    if (restoringLocation.current) { restoringLocation.current = false; return }
    const hash = adminLocationHash({ view, inspectionId: selectedId, siteId: karteSiteId, repairId, reviewId })
    if (window.location.hash === hash) return
    if (!window.location.hash) window.history.replaceState(null, '', hash)
    else window.history.pushState(null, '', hash)
  }, [view, selectedId, karteSiteId, repairId, reviewId])
  useEffect(() => {
    const missingInspection = ['prep', 'photos', 'report'].includes(view) && !state.inspections.some(item => item.inspectionId === selectedId)
    const missingReview = ['reportCheck', 'checkedReport'].includes(view) && !state.reportReviews.some(item => item.reviewId === reviewId)
    if (missingInspection || missingReview || (view === 'repair' && !state.repairCases.some(item => item.caseId === repairId))) { window.history.replaceState(null, '', '#view=monitoring'); setView('monitoring') }
  }, [view, selectedId, reviewId, repairId, state.inspections, state.reportReviews, state.repairCases])

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
    if (activeShare.current === inspectionId) setShare(current => ({ ...current, shared }))
    setState(current => {
      const inspection = current.inspections.find(item => item.inspectionId === inspectionId)
      if (!inspection || inspection.localField || inspection.shareToken !== shared.token) return current
      if (inspection.status === '報告書作成済み' || inspection.status === '完了') return current
      if (inspection.status === '提出済み' && shared.status !== 'submitted') return current
      const next = { ...inspection, status: advanceStatus(inspection.status, shared.status), visual: shared.visual, measurements: shared.measurements, findings: shared.findings, weather: shared.weather, ...(shared.submittedAt ? { inspectedOn: toDateString(new Date(shared.submittedAt)) } : {}) }
      return { ...current, inspections: current.inspections.map(item => item === inspection ? next : item), photos: [...current.photos.filter(photo => !shared.photos.some(item => item.photoId === photo.photoId)), ...shared.photos] }
    })
  }

  // 依頼モーダルか点検準備を開いている間は、現場の入力状況を5秒ごとに取り込む
  const shareToken = selected?.shareToken
  const watching = !selected?.localField && (share.open || (view === 'prep' && (selected?.status === '依頼済み' || selected?.status === '点検中')))
  useEffect(() => {
    if (!watching || !shareToken || !selectedId) return
    const timer = window.setInterval(() => { void sharedInspectionService.get(shareToken).then(shared => applyShared(selectedId, shared)).catch(() => undefined) }, 5000)
    return () => window.clearInterval(timer)
  }, [watching, shareToken, selectedId])

  useEffect(() => {
    if (view !== 'schedule' || share.open) return
    const ongoing = state.inspections.filter(item => !item.localField && (item.status === '依頼済み' || item.status === '点検中'))
    if (!ongoing.some(item => item.shareToken)) return
    const timer = window.setInterval(() => {
      for (const item of ongoing) {
        if (!item.shareToken) continue
        void sharedInspectionService.get(item.shareToken).then(shared => {
          if (advanceStatus(item.status, shared.status) !== item.status) applyShared(item.inspectionId, shared)
        }).catch(() => undefined)
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [view, share.open, state.inspections])

  const openPrep = (inspectionId: string) => {
    setSelectedId(inspectionId)
    setView('prep')
    window.scrollTo(0, 0)
  }

  const requestField = async (inspection: Inspection) => {
    const targetSite = state.sites.find(item => item.siteId === inspection.siteId)
    if (!targetSite || inspection.localField || activeShare.current === inspection.inspectionId) return
    setSelectedId(inspection.inspectionId)
    activeShare.current = inspection.inspectionId
    setShare({ ...closedShare, open: true, loading: true })
    const token = inspection.shareToken ?? crypto.randomUUID().replaceAll('-', '')
    try {
      const previous = pastInspections(state.inspections, inspection)
      const context: FieldContext = { site: targetSite, checkpoints: buildCheckpoints(targetSite, previous, state.repairCases), previousMeasurements: previous.at(-1)?.measurements ?? [], scheduledOn: inspection.scheduledOn, inspector: inspection.inspector }
      const shared = inspection.shareToken ? await sharedInspectionService.get(token) : await sharedInspectionService.create(token, {
        inspectionId: inspection.inspectionId, siteId: targetSite.siteId, visual: inspection.visual, measurements: inspection.measurements,
        context, plantName: targetSite.name, address: targetSite.address, requestTitle: '定期点検',
      })
      updateInspection(inspection.inspectionId, current => ({ ...current, shareToken: token }))
      applyShared(inspection.inspectionId, shared)
      if (activeShare.current === inspection.inspectionId) setShare({ ...closedShare, open: true, shared })
    } catch (error) {
      if (activeShare.current === inspection.inspectionId) setShare(current => ({ ...current, loading: false, offline: !inspection.shareToken && isConnectionError(error), error: errorMessage(error, '現場用リンクを取得できませんでした') }))
    }
  }

  const openLocalField = async (inspection: Inspection) => {
    if (inspection.shareToken && !inspection.localField) {
      setShare(current => ({ ...current, loading: true, error: '' }))
      try { applyShared(inspection.inspectionId, await sharedInspectionService.get(inspection.shareToken)) }
      catch (reason) {
        if (activeShare.current === inspection.inspectionId) setShare(current => ({ ...current, loading: false, error: errorMessage(reason, '切り替え前の入力を取得できませんでした') }))
        return
      }
      if (activeShare.current !== inspection.inspectionId) return
    }
    updateInspection(inspection.inspectionId, current => ({ ...current, localField: true, status: current.status === '未依頼' ? '点検中' : current.status }))
    closeShare()
    openPrep(inspection.inspectionId)
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
      const replacement: InspectionPhoto = selected.shareToken && !selected.localField
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

  const openReport = (inspection: Inspection) => {
    const targetSite = state.sites.find(item => item.siteId === inspection.siteId)
    if (!targetSite) return
    const previous = pastInspections(state.inspections, inspection).at(-1)
    updateInspection(inspection.inspectionId, current => ({
      ...current,
      status: current.status === '提出済み' ? '報告書作成済み' : current.status,
      reportLayout: current.reportLayout ?? defaultReportLayout(current, state.photos),
      reportIssuedOn: current.reportIssuedOn ?? toDateString(new Date()),
      reportText: current.reportText ?? buildReportText(current, targetSite, previous, current.reportOptions),
    }))
    setSelectedId(inspection.inspectionId)
    go('report')
  }

  // 点検を完了する：修繕案件の自動作成と1年後の予定まで（SDD 4.6・4.7）
  const completeInspection = (inspection: Inspection) => {
    if (!approvedInspectionReport(state, inspection.inspectionId) || !window.confirm('承認済みの報告書で点検を完了し、修繕案件と1年後の点検予定を作成します。よろしいですか？')) return
    setState(current => completeInspectionState(current, inspection.inspectionId, toDateString(new Date())))
  }

  const go = (next: AdminView) => { setLocalField(false); closeShare(); setView(next); window.scrollTo(0, 0) }
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
    closeShare()
    setLocalField(false)
    setRepairId(null)
    setKarteSiteId(null)
    setReviewId(null)
    setView('schedule')
  }

  return <AppShell view={view} onNavigate={go} session={session} onSignOut={onSignOut}>
    {view === 'monitoring' && <MonitoringScreen sites={state.sites} inspections={state.inspections} repairCases={state.repairCases} onOpenKarte={openKarte} onOpenInspection={openPrep} onOpenRepair={openRepair} onOpenReports={() => go('reportChecks')} />}
    {view === 'schedule' && <ScheduleScreen sites={state.sites} inspections={state.inspections} reviews={state.reportReviews} onOpenReview={openReview} onOpen={openPrep} onLocal={inspection => void openLocalField(inspection)} onShare={inspection => void requestField(inspection)} onReport={openReport} onComplete={completeInspection} onReset={resetData} />}
    {view === 'prep' && selected && site && <PrepScreen site={site} inspection={selected} review={sourceReview} progress={sourceProgress} onReview={() => sourceReview && openReview(sourceReview.reviewId)} previous={history.at(-1)} checkpoints={checkpoints} onBack={() => { setLocalField(false); setView('schedule') }} onLocal={() => void openLocalField(selected)} onRequest={() => void requestField(selected)} onReport={() => openReport(selected)} />}
    {view === 'photos' && selected && <PhotoReviewScreen photos={inspectionPhotos(selected, state.photos)} includedIds={(selected.reportLayout ?? []).map(entry => entry.photoId)} syncing={photoWork.busy} error={photoWork.error} onIncludedChange={setIncludedPhotos} onReplace={(photo, file) => void replacePhoto(photo, file)} onBack={() => selected.status === '提出済み' ? go('prep') : go('report')} onConfirm={() => openReport(selected)} fromReport={selected.status !== '提出済み'} readOnly={selected.status === '完了' || sourceProgress === 'チェック待ち' || sourceProgress === '承認済み'} />}
    {view === 'report' && selected && site && <ReportScreen site={site} inspection={selected} previous={history.at(-1)} photos={state.photos}
      onChange={patch => updateInspection(selected.inspectionId, inspection => ({ ...inspection, ...patch }))}
      onRegenerate={() => updateInspection(selected.inspectionId, inspection => ({ ...inspection, reportText: buildReportText(inspection, site, history.at(-1), inspection.reportOptions) }))}
      onOptions={options => updateInspection(selected.inspectionId, inspection => ({ ...inspection, reportOptions: options, reportText: { summary: inspection.reportText?.summary ?? '', proposals: buildProposals(inspection, site, history.at(-1), options) } }))}
      onBack={() => go('prep')} backLabel="点検結果へ戻る" onPhotos={() => go('photos')} onComplete={() => completeInspection(selected)} onSubmitForCheck={submitForReview}
      review={sourceReview} progress={sourceProgress} canComplete={canComplete} onOpenSchedule={() => go('schedule')}
      createdRepairs={state.repairCases.filter(item => item.inspectionId === selected.inspectionId).length}
      nextScheduledOn={selected.status === '完了' ? state.inspections.filter(item => item.siteId === selected.siteId && item.scheduledOn > selected.scheduledOn).sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))[0]?.scheduledOn : undefined}
      onOpenRepairs={() => go('repairs')} onOpenKarte={() => openKarte(selected.siteId)} />}
    {view === 'workReport' && <WorkReportScreen sites={state.sites} />}
    {view === 'reportChecks' && <ReportCheckListScreen reviews={state.reportReviews} onOpen={openReview} onPreview={id => { setReviewId(id); go('checkedReport') }} />}
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
    {localField && view === 'prep' && selected && site && fieldContext && <LocalField site={site} inspection={selected} context={fieldContext} photos={state.photos} onUpdate={patch => updateInspection(selected.inspectionId, inspection => ({ ...inspection, ...patch }))} onAddPhotos={addPhotos} onClose={() => setLocalField(false)} onReport={() => openReport(selected)} />}
    {share.open && selected && site && <AssignmentModal token={selected.shareToken ?? ''} plantName={site.name} scheduledOn={selected.scheduledOn} shared={share.shared} loading={share.loading} error={share.error}
      fallback={share.offline && <div className="offline-fallback"><p>現場用リンクを取得できませんでした。この端末で点検できます。</p><button className="button button-primary" onClick={() => void openLocalField(selected)} data-testid="open-local-field">この端末で現場入力を開く</button></div>}
      onClose={closeShare} onRefresh={() => void refreshShared()} onReset={() => void resetShared()} onReport={() => openReport(selected)}>
      {share.shared && share.shared.status !== 'submitted' && <section className="local-option"><p>現場画面が「保存済み」になってから切り替えてください。切り替え後の入力はこの端末に保存されます。</p><button className="button button-secondary" onClick={() => void openLocalField(selected)} disabled={share.loading} data-testid="open-local-field-here">入力元をこの端末に切り替える</button></section>}
    </AssignmentModal>}
  </AppShell>
}

export default App
