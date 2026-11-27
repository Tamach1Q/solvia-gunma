export type Judgement = '適合' | '要確認' | '不適合' | '未入力'
export type VisualResult = '○' | '×' | '該当なし' | null
export type Weather = '晴れ' | '曇り' | '雨' | '雨上がり'

export interface Site {
  siteId: string; name: string; area: Area; address: string
  capacityKw: number; gridConnectedOn: string; owner: string
  monitoringSystem: string
  module: { model: string; vocPerModule: number; pmaxW: number; count: number }
  pcs: Pcs[]
  arrays: ArrayLayout[]
  groundingClass: 'D' | 'C'; groundingRelaxed: boolean
}
export type Area = '前橋市' | '渋川市' | '高崎市' | '伊勢崎市' | '沼田市'
export interface Pcs { pcsId: string; maker: string; model: string; ratedKw: number; circuits: Circuit[]; gridType: '単相3線' | '三相3線' }
// 1回路はアレイの連続した段（rows、1始まり）を担当する。seriesCount＝段数×列数。
export interface Circuit { circuitId: string; seriesCount: number; arrayId: string; rows: number[] }
export interface ArrayLayout { arrayId: string; label: string; rows: number; cols: number }

export type VisualCategory = 'アレイ・架台' | '接続箱' | 'PCS' | 'その他'
export interface VisualItemDef { itemId: string; category: VisualCategory; title: string; criterion: string; icon: string }
export interface VisualEntry { itemId: string; result: VisualResult; comment: string; photoIds: string[] }

export type MeasurementKind = 'DC開放電圧' | 'DC絶縁抵抗' | 'AC絶縁抵抗' | '系統電圧UO' | '系統電圧WO' | '接地抵抗_架台' | '接地抵抗_PCS'
export interface MeasurementEntry {
  key: string; kind: MeasurementKind; pcsId?: string; circuitId?: string
  raw: string; value: number | null; judgement: Judgement; reason: string
  caution?: string
}

export interface Finding {
  findingId: string; source: 'visual' | 'measurement'; refKey: string
  arrayId?: string; panels?: { row: number; col: number }[]; circuitId?: string
  comment: string; photoIds: string[]
}

export type InspectionStatus = '未依頼' | '依頼済み' | '点検中' | '提出済み' | '報告書作成済み' | '完了'
export interface Inspection {
  inspectionId: string; siteId: string; scheduledOn: string; inspectedOn?: string
  kind?: '定期点検' | '駆けつけ点検'; incidentId?: string; investigationNote?: string
  inspector: string; weather?: Weather
  status: InspectionStatus
  visual: VisualEntry[]; measurements: MeasurementEntry[]; findings: Finding[]
  reportText?: { summary: string; proposals: string[] }
  reportHeader?: { siteName: string; owner: string }
  // 報告書：掲載する写真と配置（zone=null は掲載しない）、ご提案文の選択肢
  reportLayout?: { photoId: string; zone: ReportZone | null }[]
  reportOptions?: { boltTightenedOnSite: boolean }
  shareToken?: string
  // 同じ端末（管理画面のスマホ枠）で現場入力している。共有URL側の入力では上書きしない
  localField?: boolean
}
export type ReportZone = 'visual' | 'measurement' | 'findings' | 'ledger'

// その他（作業実施）：除草・清掃など、交換・修理にあたらない作業
export type RepairDecision = '交換' | '修理' | '経過観察' | 'その他（作業実施）'
export type RepairStatus = 'お客様確認中' | '対応決定' | '作業予定' | '完了'
export interface RepairCase {
  caseId: string; siteId: string; inspectionId: string; findingId: string; title: string
  status: RepairStatus
  customerDecision?: RepairDecision; decidedOn?: string
  workNote?: string; afterPhotoIds: string[]; remeasure?: MeasurementEntry
}

export type MonitoringLevel = '要対応' | '要確認' | '正常'
export interface MonitoringStatus { siteId: string; outputKw: number; level: MonitoringLevel; alert: string | null; alertAt: string | null }

export interface InspectionPhoto {
  photoId: string
  siteId?: string
  inspectionItemId: string
  equipmentId: string
  photoType: string
  takenAt: string
  url?: string
}

export type ReportReviewStatus = 'チェック待ち' | '差し戻し' | '承認済み'
export interface ReviewPhoto extends InspectionPhoto { siteId: string }
export interface ReportAttachment { attachmentId: string; itemId: string; photoId: string; zone?: ReportZone }
export interface ReportCheckIssue {
  key: string; category: '基本情報' | '写真' | '記入漏れ'
  title: string; actual: string; expected: string; fingerprint: string
}
export interface ReportReview {
  reviewId: string; siteId: string; siteName: string; owner: string
  inspection: Inspection; photos: ReviewPhoto[]; attachments: ReportAttachment[]
  submittedAt: string; status: ReportReviewStatus
  check?: { fingerprint: string; checkedAt: string; issues: ReportCheckIssue[] }
  confirmations: Record<string, { fingerprint: string; note: string }>
  reviewedBy?: string; reviewedAt?: string; returnNote?: string
}

export type IncidentSource = '遠隔監視' | '定期点検' | 'オーナー連絡' | 'その他'
export type IncidentDecision = '未判断' | '経過観察' | '駆けつけ' | '遠隔対応' | '現状維持' | '対応不要'
export type IncidentLogKind = '登録' | '判断' | '電話' | 'メール' | '作業' | '復旧' | '完了' | '再開' | 'メモ'
export interface IncidentLog { id: string; kind: IncidentLogKind; at: string; by: string; text: string }
export interface Incident {
  id: string; siteId: string; title: string; source: IncidentSource; occurredAt: string
  assignee: string; dueOn: string; decision: IncidentDecision; reason: string
  recoveredAt?: string; closedAt?: string; costYen?: number; alarmKey?: string
  logs: IncidentLog[]
}
