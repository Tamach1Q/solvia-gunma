import type { SharedInspection } from '../services/sharedInspectionService'
import type { InspectionStatus } from '../types'

export type Tone = 'neutral' | 'blue' | 'amber' | 'green' | 'red'

// 管理側が次に手を動かす状態（提出済み・報告書作成済み）は amber
export const inspectionStatusTone: Record<InspectionStatus, Tone> = { 未依頼: 'neutral', 依頼済み: 'blue', 点検中: 'blue', 提出済み: 'amber', 報告書作成済み: 'amber', 完了: 'green' }

export const inspectionStatusLabel = (status: InspectionStatus) => status === '報告書作成済み' ? '報告書の作成・確認' : status === '依頼済み' ? 'リンク発行済み' : status

const statusOrder: InspectionStatus[] = ['未依頼', '依頼済み', '点検中', '提出済み', '報告書作成済み', '完了']

// 現場の共有状態を点検のステータスへ反映する。後戻りはさせない（やり直しは reset で明示的に戻す）。
export function advanceStatus(current: InspectionStatus, shared: SharedInspection['status']): InspectionStatus {
  const next: InspectionStatus = shared === 'submitted' ? '提出済み' : shared === 'in_progress' ? '点検中' : '依頼済み'
  return statusOrder.indexOf(next) > statusOrder.indexOf(current) ? next : current
}

// 修繕案件の状態（repairResult の値）。お客様の回答待ちは管理側が動く状態なので amber。
export const repairTone = (result: string): Tone => ({ お客様確認中: 'amber', 対応決定: 'blue', 作業予定: 'blue', 完了: 'green', 修正済み: 'green', 経過観察: 'neutral' } as Record<string, Tone>)[result] ?? 'neutral'
