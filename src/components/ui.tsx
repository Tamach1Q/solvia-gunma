import { inspectionStatusTone, type Tone } from '../logic/status'
import type { InspectionStatus, Judgement, VisualResult } from '../types'
import type { ReportProgress } from '../logic/reportWorkflow'

const judgementClass: Record<Judgement, string> = { 適合: 'ok', 要確認: 'caution', 不適合: 'fail', 未入力: 'none' }

export function StatusChip({ label, tone }: { label: string; tone: Tone }) { return <span className={`status status-${tone}`}><i />{label}</span> }

export function InspectionStatusChip({ status }: { status: InspectionStatus }) { return <StatusChip label={status} tone={inspectionStatusTone[status]} /> }
export function ReportReviewStatusChip({ status }: { status: ReportProgress }) { return <StatusChip label={status} tone={status === '承認済み' ? 'green' : status === '差し戻し' ? 'red' : status === 'チェック待ち' || status === '再提出待ち' ? 'amber' : 'neutral'} /> }

// 判定は紙の記録簿の判定印に相当。作業の状態（StatusChip）と見た目を分ける。
export function JudgementMark({ judgement }: { judgement: Judgement }) { return <span className={`judgement judgement-${judgementClass[judgement]}`}>{judgement}</span> }

const visualClass: Record<string, string> = { '○': 'ok', '×': 'fail', 該当なし: 'none' }
// 目視の結果（○／×／該当なし）も判定印として同じ見た目で出す
export function VisualResultMark({ result }: { result: VisualResult | '×' }) { return <span className={`judgement judgement-${result ? visualClass[result] : 'none'}`}>{result ?? '未判定'}</span> }
