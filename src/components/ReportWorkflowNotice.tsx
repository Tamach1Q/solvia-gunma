import { formatDateTime } from '../logic/format'
import type { ReportProgress } from '../logic/reportWorkflow'
import type { ReportReview } from '../types'
import { ReportReviewStatusChip } from './ui'

export function ReportWorkflowNotice({ progress, review, completed, onOpen }: { progress: ReportProgress | null; review?: ReportReview; completed: boolean; onOpen?: () => void }) {
  if (!progress) return null
  return <section className="panel report-workflow-notice no-print" data-testid="report-workflow-status" aria-label="報告書チェックの進行状況">
    <div><strong>報告書チェック</strong><ReportReviewStatusChip status={progress} /></div>
    {progress === '差し戻し' ? <p className="text-fail">修正依頼：{review?.returnNote}</p> : progress === '承認済み' ? <p>{review?.reviewedBy} が {review?.reviewedAt && formatDateTime(review.reviewedAt)} に承認しました。{completed ? '点検は完了しています。' : '承認した内容で点検を完了できます。'}</p> : progress === 'チェック待ち' ? <p>確認担当者のチェックを待っています。承認後に点検を完了できます。</p> : progress === '再提出待ち' ? <p>提出後に報告書の内容が変わっています。最新の内容を再提出してください。</p> : <p>報告書を作成し、チェックに提出してください。担当者の承認後に点検を完了します。</p>}
    {review && onOpen && <button className="button button-secondary" onClick={onOpen}>チェック状況を開く</button>}
  </section>
}
