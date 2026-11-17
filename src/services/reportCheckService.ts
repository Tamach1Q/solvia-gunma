import { checkReport, reportFingerprint } from '../logic/reportCheck'
import type { ReportReview, Site } from '../types'

// MOCK: AIチェックの応答を台帳と写真の登録情報の照合で再現する。画像認識・外部AIへの送信は行わない。
export const reportCheckService = {
  async check(review: ReportReview, site: Site): Promise<NonNullable<ReportReview['check']>> {
    return { fingerprint: reportFingerprint(review, site), checkedAt: new Date().toISOString(), issues: checkReport(review, site) }
  },
}
