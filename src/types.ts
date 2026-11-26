export type Judgement = '適合' | '要確認' | '不適合' | '未入力'
export type VisualResult = '○' | '△' | '×' | '該当なし' | null
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

export type VisualCategory = '敷地・周辺' | '太陽電池アレイ' | '架台・基礎' | '配線' | 'パワコン' | '監視装置・盤'
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
  inspector: string; weather?: Weather
  status: InspectionStatus
  visual: VisualEntry[]; measurements: MeasurementEntry[]; findings: Finding[]
  reportFormat?: 'A' | 'B'
  reportContractor?: string
  reportCaseNo?: string
  reportIssuedOn?: string
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

export type SiteState = '異常停止中' | '経過観察' | '現状維持（オーナー意向）' | '修繕対応中' | '復旧済' | '管理外・解約済' | '正常'
export type MonitoringDetection = { source: '監視アラーム' | '発電データ'; text: string; detectedAt: string; needsReview: boolean }
export interface MonitoringStatus { siteId: string; outputKw: number; state?: SiteState; detection?: MonitoringDetection }

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
