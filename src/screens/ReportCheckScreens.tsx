import { ArrowLeft, CheckCircle2, FileSearch, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatusChip } from '../components/ui'
import { formatDateTime, formatDateWithWeekday, formatNumber } from '../logic/format'
import { hasCurrentCheck, reviewItemTitle, unresolvedIssues } from '../logic/reportCheck'
import type { ReportCheckIssue, ReportReview, ReportReviewStatus, Site } from '../types'

const tone = (status: ReportReviewStatus) => status === '承認済み' ? 'green' : status === '差し戻し' ? 'red' : 'amber'
const counts = (count: number) => `${formatNumber(count)}件`

export function ReportCheckListScreen({ reviews, onOpen, onPreview }: { reviews: ReportReview[]; onOpen: (reviewId: string) => void; onPreview: (reviewId: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ReportReviewStatus | 'すべて'>('すべて')
  const pending = reviews.filter(review => review.status === 'チェック待ち').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  const search = query.trim().normalize('NFKC').toLowerCase()
  const visible = reviews.filter(review => (filter === 'すべて' || review.status === filter) && `${review.siteName} 定期点検報告書 ${review.inspection.inspector} ${review.owner}`.normalize('NFKC').toLowerCase().includes(search)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  return <div className="page report-check-page" data-testid="report-check-list">
    <div className="page-heading"><div><h1>報告書チェック</h1><p>報告書の閲覧・内容確認・承認を行います。</p></div><button className="button button-secondary" onClick={() => { setFilter('承認済み'); document.getElementById('all-reports-title')?.scrollIntoView({ block: 'start' }) }}>完成済みの報告書を見る</button></div>
    <section aria-labelledby="pending-reports-title">
      <div className="review-section-heading"><h2 id="pending-reports-title">チェック待ち <span>{counts(pending.length)}</span></h2><span>提出日時が古い順</span></div>
      {pending.length ? <div className="review-pending-grid">{pending.map(review => <article className="panel review-pending-card" key={review.reviewId} data-testid="review-pending">
        <StatusChip label="チェック待ち" tone="amber" />
        <h3>{review.siteName}</h3>
        <p>定期点検報告書 · {formatDateWithWeekday(review.inspection.inspectedOn ?? review.inspection.scheduledOn)}</p>
        <p>提出者 {review.inspection.inspector} <span>提出 {formatDateTime(review.submittedAt)}</span></p>
        <button className="button button-primary" onClick={() => onOpen(review.reviewId)}>チェックする</button>
      </article>)}</div> : <div className="panel empty-state"><CheckCircle2 /><strong>チェック待ちの報告書はありません</strong><span>報告書画面からチェックに提出すると、ここに表示されます。</span></div>}
    </section>

    <section className="review-all" aria-labelledby="all-reports-title">
      <div className="review-section-heading"><h2 id="all-reports-title">すべての報告書 <span>{counts(reviews.length)}</span></h2></div>
      <div className="review-toolbar">
        <label className="review-search"><span>報告書を検索</span><div><Search size={16} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="発電所名・オーナー名・担当者名" /></div></label>
        <div className="review-filters" role="group" aria-label="報告書の状態で絞り込む">{(['すべて', 'チェック待ち', '差し戻し', '承認済み'] as const).map(status => <button key={status} className="button button-secondary" aria-pressed={filter === status} onClick={() => setFilter(status)}>{status} <span>{formatNumber(status === 'すべて' ? reviews.length : reviews.filter(review => review.status === status).length)}</span></button>)}</div>
      </div>
      <p className="review-search-count" role="status">{counts(visible.length)}を表示</p>
      {visible.length ? <div className="panel review-list">{visible.map(review => <article className="review-list-row" key={review.reviewId} data-testid="review-row">
        <div><h3>{review.siteName}</h3><p>定期点検 · 点検日 {formatDateWithWeekday(review.inspection.inspectedOn ?? review.inspection.scheduledOn)} · {review.inspection.inspector}</p></div>
        <StatusChip label={review.status} tone={tone(review.status)} />
        <div className="review-decision-meta">{review.reviewedAt ? <><span>{review.status === '承認済み' ? '承認' : '差し戻し'} {formatDateTime(review.reviewedAt)}</span><span>{review.reviewedBy}</span></> : <span>承認待ち</span>}</div>
        <button className="button button-secondary" onClick={() => onOpen(review.reviewId)} aria-label={`${review.siteName}の報告書を開く`}>チェック状況</button><button className="button button-secondary" onClick={() => onPreview(review.reviewId)} aria-label={`${review.siteName}の報告書を表示`}>報告書を表示</button>
      </article>)}</div> : <div className="panel empty-state"><strong>条件に合う報告書がありません</strong><span>検索語や状態の絞り込みを変更してください。</span><button className="button button-secondary" onClick={() => { setQuery(''); setFilter('すべて') }}>検索条件をクリア</button></div>}
    </section>
  </div>
}

type DetailProps = {
  review: ReportReview; site: Site; sites: Site[]; busy: boolean; error: string
  onBack: () => void; onCheck: () => void; onChange: (patch: Partial<ReportReview>) => void
  onConfirm: (issue: ReportCheckIssue, note: string) => void
  onApprove: (name: string, confirmed: boolean) => void; onReturn: (name: string, note: string) => void
  onResubmit: () => void; onOpenReport: () => void; onOpenSource: () => void; onOpenSchedule: () => void; completed: boolean
}

export function ReportCheckDetailScreen({ review, site, sites, busy, error, onBack, onCheck, onChange, onConfirm, onApprove, onReturn, onResubmit, onOpenReport, onOpenSource, onOpenSchedule, completed }: DetailProps) {
  const [photosOpen, setPhotosOpen] = useState(false)
  const [reviewer, setReviewer] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [returnNote, setReturnNote] = useState('')
  const checked = hasCurrentCheck(review, site)
  const issues = checked ? review.check!.issues : []
  const unresolved = checked ? unresolvedIssues(review, site) : []
  const readOnly = review.status === '承認済み'
  useEffect(() => { if (review.check?.issues.some(issue => issue.category === '写真')) setPhotosOpen(true) }, [review.check?.fingerprint])
  useEffect(() => setConfirmed(false), [review.check?.fingerprint])

  const replacePhoto = (attachmentId: string, photoId: string) => onChange({ attachments: review.attachments.map(item => item.attachmentId === attachmentId ? { ...item, photoId } : item) })

  return <div className="page report-check-page" data-testid="report-check-detail">
    <button className="back-button" onClick={onBack}><ArrowLeft />報告書チェックの一覧へ戻る</button>
    <div className="page-heading"><div><h1>{review.siteName}</h1><p>定期点検報告書 · 提出 {formatDateTime(review.submittedAt)} · {review.inspection.inspector}</p></div><StatusChip label={review.status} tone={tone(review.status)} /></div>
    {review.status === '差し戻し' && <div className="alert-fail review-feedback" role="status"><div><strong>差し戻し理由</strong><p>{review.returnNote}</p><small>{review.reviewedBy} · {review.reviewedAt && formatDateTime(review.reviewedAt)}</small></div><button className="button button-secondary" onClick={onResubmit}>修正内容を再提出</button></div>}
    {readOnly && <div className="notice review-feedback" role="status"><CheckCircle2 /><div><strong>承認済みの報告書です</strong><span>{review.reviewedBy} · {review.reviewedAt && formatDateTime(review.reviewedAt)} · {completed ? '点検完了' : '点検完了待ち'}</span></div></div>}
    <div className="review-case-links"><button className={`button button-${readOnly && !completed ? 'primary' : 'secondary'}`} onClick={onOpenSource} data-testid="review-open-source">{review.status === '差し戻し' ? '元の報告書を修正' : readOnly ? '承認した報告書を開く' : '元の点検報告書を開く'}</button><button className="button button-secondary" onClick={onOpenSchedule} data-testid="review-open-schedule">点検予定で状態を見る</button><button className="button button-secondary" onClick={onOpenReport}>報告書全体を開く</button><span>報告書の修正内容は、同じ点検案件にも保存されます。</span></div>
    <div className="review-detail-layout">
      <div className="review-document-column">
        <section className="panel review-document">
          <div className="panel-header"><h2>報告書の記載内容</h2></div>
          <div className="review-document-body">
            <label className="review-input"><span>発電所名</span><input value={review.siteName} disabled={readOnly} onChange={event => onChange({ siteName: event.target.value })} /></label>
            <label className="review-input"><span>オーナー名</span><input value={review.owner} disabled={readOnly} onChange={event => onChange({ owner: event.target.value })} data-testid="review-owner" /></label>
            <dl className="review-facts"><div><dt>点検日</dt><dd>{formatDateWithWeekday(review.inspection.inspectedOn ?? review.inspection.scheduledOn)}</dd></div><div><dt>所在地</dt><dd>{site.address}</dd></div></dl>
            <label className="review-input"><span>点検者</span><input value={review.inspection.inspector} disabled={readOnly} onChange={event => onChange({ inspection: { ...review.inspection, inspector: event.target.value } })} /></label>
            <label className="review-input"><span>総合所見</span><textarea value={review.inspection.reportText?.summary ?? ''} disabled={readOnly} onChange={event => onChange({ inspection: { ...review.inspection, reportText: { summary: event.target.value, proposals: review.inspection.reportText?.proposals ?? [] } } })} /></label>
            <details className="review-photos-details" open={photosOpen} onToggle={event => setPhotosOpen(event.currentTarget.open)}><summary>掲載写真を確認・差し替え（{counts(review.attachments.length)}）</summary>
            {review.attachments.length ? review.attachments.map(attachment => {
              const photo = review.photos.find(item => item.photoId === attachment.photoId)
              const source = sites.find(item => item.siteId === photo?.siteId)
              const candidates = review.photos.filter(item => item.siteId === site.siteId && item.inspectionItemId === attachment.itemId)
              return <figure className="review-photo" key={attachment.attachmentId}>
                {photo?.url ? <img src={photo.url} alt={photo.photoType} /> : <div className="empty-state">写真がありません</div>}
                <figcaption><strong>{reviewItemTitle(attachment.itemId)}</strong><span>登録元：{source?.name ?? '登録情報なし'}</span><span>{photo?.photoType}</span></figcaption>
                {!readOnly && candidates.length > 0 && <label className="review-input"><span>掲載する写真</span><select aria-label={`${reviewItemTitle(attachment.itemId)}の掲載写真`} value={attachment.photoId} onChange={event => replacePhoto(attachment.attachmentId, event.target.value)}>{!candidates.some(item => item.photoId === attachment.photoId) && <option value={attachment.photoId}>現在の写真（{source?.name ?? '登録情報なし'}）</option>}{candidates.map(item => <option key={item.photoId} value={item.photoId}>{item.photoType}</option>)}</select></label>}
              </figure>
            }) : <p className="text-muted">掲載写真はありません。</p>}</details>
          </div>
        </section>
      </div>

      <div className="review-check-column">
        <section className="panel">
          <div className="panel-header"><h2>AIチェック</h2>{checked && <span className="panel-count">{formatDateTime(review.check!.checkedAt)} 実行</span>}</div>
          <div className="review-check-body">
            <p className="text-muted">発電所台帳と写真の登録情報を照合し、確認する箇所を絞り込みます。</p>
            {!readOnly && <button className={`button button-${checked ? 'secondary' : 'primary'} review-check-button`} onClick={onCheck} disabled={busy} data-testid="run-report-check"><FileSearch />{busy ? 'チェックしています…' : checked ? 'AIチェックを再実行' : 'AIチェックを実行'}</button>}
            {error && <p className="text-fail" role="alert">{error}</p>}
            <div aria-live="polite">{checked ? <>
              <p className="review-check-result"><strong>{issues.length ? `${counts(issues.length)}の確認ポイント` : '記載の不一致は見つかりませんでした'}</strong><span>{readOnly ? 'チェック結果と担当者の確認記録を保存しています。' : unresolved.length ? `残り${counts(unresolved.length)}を確認してください。` : '最後に報告書全体を確認して承認してください。'}</span></p>
              <ul className="review-check-summary">{(['基本情報', '写真', '記入漏れ'] as const).map(category => {
                const count = unresolved.filter(issue => issue.category === category).length
                return <li key={category}><span>{category}</span><StatusChip label={count ? `${counts(count)}の要確認` : issues.some(issue => issue.category === category) ? '確認記録あり' : '不一致なし'} tone={count ? 'amber' : 'green'} /></li>
              })}</ul>
            </> : <p className="review-check-hint">チェックを実行すると、記載の不一致と確認の根拠を表示します。</p>}</div>
          </div>
          {issues.map(issue => <ReviewIssue key={`${issue.key}-${issue.fingerprint}`} issue={issue} review={review} readOnly={readOnly} onConfirm={note => onConfirm(issue, note)} onFix={issue.key === 'owner' ? () => onChange({ owner: site.owner }) : issue.key === 'siteName' ? () => onChange({ siteName: site.name }) : undefined} />)}
        </section>

        {!readOnly && <section className="panel">
          <h2>担当者による最終確認</h2>
          <div className="review-check-body">
            <p className="text-muted">写真の内容や文章も含め、提出する報告書全体を確認してください。</p>
            <label className="review-input"><span>確認する担当者名</span><input value={reviewer} onChange={event => setReviewer(event.target.value)} placeholder="氏名を入力" autoComplete="name" /></label>
            <label className="review-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={!checked || unresolved.length > 0 || review.status !== 'チェック待ち'} />指摘への対応と報告書全体を確認しました</label>
            <button className={`button button-${checked ? 'primary' : 'secondary'}`} disabled={busy || !checked || unresolved.length > 0 || !confirmed || !reviewer.trim() || review.status !== 'チェック待ち'} onClick={() => onApprove(reviewer, confirmed)} data-testid="approve-report">確認して承認する</button>
            {review.status === 'チェック待ち' && <details className="review-return"><summary>作成者に差し戻す</summary><label className="review-input"><span>差し戻し理由</span><textarea value={returnNote} onChange={event => setReturnNote(event.target.value)} placeholder="修正が必要な箇所と理由を入力" /></label><button className="button button-secondary" disabled={!reviewer.trim() || !returnNote.trim()} onClick={() => onReturn(reviewer, returnNote)}>理由を添えて差し戻す</button></details>}
          </div>
        </section>}
      </div>
    </div>
  </div>
}

function ReviewIssue({ issue, review, readOnly, onFix, onConfirm }: { issue: ReportCheckIssue; review: ReportReview; readOnly: boolean; onFix?: () => void; onConfirm: (note: string) => void }) {
  const confirmation = review.confirmations[issue.key]
  const resolved = confirmation?.fingerprint === issue.fingerprint && Boolean(confirmation.note.trim())
  const [note, setNote] = useState(resolved ? confirmation.note : '')
  return <article className="review-issue" data-testid="review-check-issue">
    <div className="review-issue-heading"><StatusChip label={resolved ? '担当者が確認済み' : '要確認'} tone={resolved ? 'green' : 'amber'} /><span>{issue.category}</span></div>
    <h3>{issue.title}</h3>
    <dl className="review-comparison"><div><dt>報告書の記載</dt><dd>{issue.actual}</dd></div><div><dt>照合先の情報</dt><dd>{issue.expected}</dd></div></dl>
    {!readOnly && !resolved && <>
      {onFix && <button className="button button-secondary" onClick={onFix}>台帳の内容に修正</button>}
      {issue.category === '写真' && <p className="review-issue-help">掲載写真の登録元を確認し、「掲載する写真」から差し替えてください。</p>}
      <details className="review-exception"><summary>記載を変えずに確認済みにする</summary><label className="review-input"><span>確認した根拠・変更しない理由</span><textarea value={note} onChange={event => setNote(event.target.value)} /></label><button className="button button-secondary" disabled={!note.trim()} onClick={() => onConfirm(note)}>理由を記録して確認済みにする</button></details>
    </>}
    {resolved && <p className="review-issue-help">確認記録：{confirmation.note}</p>}
  </article>
}
