import { loadSession } from './session'

// フィードバックはNetlify Formsに送る（index.htmlに同じ名前の隠しフォームがあり、デプロイ時にNetlifyが受け口を作る）。
// Netlify以外（vite dev など）では送信に失敗するので、画面にその旨を出す。送った内容は端末にも控えを残す。
export const feedbackFormName = 'feedback'
export const feedbackLogKey = 'solvia_gunma_feedback'

export type FeedbackKind = 'ご意見' | '報告書の評価'
export type ReportRating = '○' | '△' | '×'
export type FeedbackInput = { kind: FeedbackKind; screen: string; message?: string; rating?: ReportRating; minutes?: string; inspection?: string }

export function feedbackFields(input: FeedbackInput, now = new Date(), session = loadSession(), page = typeof window === 'undefined' ? '' : window.location.href): Record<string, string> {
  return {
    'form-name': feedbackFormName,
    kind: input.kind,
    screen: input.screen,
    message: input.message?.trim() ?? '',
    rating: input.rating ?? '',
    minutes: input.minutes?.trim() ?? '',
    inspection: input.inspection ?? '',
    account: session?.email ?? '',
    name: session?.name ?? '',
    company: session?.company ?? '',
    page,
    sentAt: now.toISOString(),
  }
}

export async function sendFeedback(input: FeedbackInput, send: typeof fetch = fetch) {
  const fields = feedbackFields(input)
  try {
    const log = JSON.parse(window.localStorage.getItem(feedbackLogKey) ?? '[]') as unknown[]
    window.localStorage.setItem(feedbackLogKey, JSON.stringify([...log, fields].slice(-50)))
  } catch { /* 控えが残せなくても送信は続ける */ }
  let response: Response
  try {
    response = await send('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() })
  } catch { throw new Error('送信できませんでした。通信状態を確認して、もう一度送ってください。') }
  if (!response.ok) throw new Error('送信できませんでした。公開サイト（Netlify）で開いているか確認してください。')
}
