import { AlertCircle, CheckCircle2, MessageSquare, Send, X } from 'lucide-react'
import { useState } from 'react'
import { sendFeedback, type ReportRating } from '../services/feedbackService'

type SendState = { busy: boolean; error: string; sent: boolean }
const idle: SendState = { busy: false, error: '', sent: false }

// ヘッダーに置く「ご意見を送る」。どの画面から送ったかを一緒に送る。画面下の操作ボタンに重ならないよう、浮かせて置かない。
export function FeedbackButton({ screen }: { screen: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<SendState>(idle)
  const close = () => { setOpen(false); setMessage(''); setState(idle) }
  const submit = async () => {
    setState({ ...idle, busy: true })
    try { await sendFeedback({ kind: 'ご意見', screen, message }); setState({ ...idle, sent: true }) }
    catch (error) { setState({ ...idle, error: error instanceof Error ? error.message : '送信できませんでした。' }) }
  }
  return <>
    <button className="button button-secondary feedback-open no-print" onClick={() => setOpen(true)} data-testid="feedback-open"><MessageSquare />ご意見を送る</button>
    {open && <div className="modal-backdrop no-print"><div className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title" data-testid="feedback-modal">
      <header><h2 id="feedback-title">ご意見を送る</h2><button onClick={close} aria-label="閉じる"><X /></button></header>
      {state.sent ? <div className="feedback-done"><CheckCircle2 /><p>送りました。いただいた内容は開発チームで確認します。</p></div> : <div className="feedback-body">
        <p>使いにくかった点や、あると便利な機能を書いてください。「{screen}」の画面から送ったことも一緒に届きます。</p>
        <textarea className="ku-input" rows={5} value={message} onChange={event => setMessage(event.target.value)} aria-label="ご意見" data-testid="feedback-message" />
        {state.error && <div className="alert-fail"><AlertCircle />{state.error}</div>}
      </div>}
      <footer>{state.sent ? <button className="button button-secondary" onClick={close}>閉じる</button> : <><button className="button button-secondary" onClick={close}>キャンセル</button><button className="button button-primary" onClick={submit} disabled={state.busy || !message.trim()} data-testid="feedback-send"><Send />{state.busy ? '送信中' : '送る'}</button></>}</footer>
    </div></div>}
  </>
}

const ratings: { value: ReportRating; label: string }[] = [{ value: '○', label: '○ そのまま使える' }, { value: '△', label: '△ 少し直せば使える' }, { value: '×', label: '× 使えない' }]

// 報告書の画面に出す2つの質問。報告書がそのまま使えるかと、手作業なら何分かかるか。
export function ReportRatingPanel({ inspectionId }: { inspectionId: string }) {
  const [rating, setRating] = useState<ReportRating | null>(null)
  const [minutes, setMinutes] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<SendState>(idle)
  const submit = async () => {
    if (!rating) return
    setState({ ...idle, busy: true })
    try { await sendFeedback({ kind: '報告書の評価', screen: '点検報告書', rating, minutes, message, inspection: inspectionId }); setState({ ...idle, sent: true }) }
    catch (error) { setState({ ...idle, error: error instanceof Error ? error.message : '送信できませんでした。' }) }
  }
  return <section className="panel report-rating" data-testid="report-rating">
    <h2>この報告書の使い心地</h2>
    {state.sent ? <div className="feedback-done"><CheckCircle2 /><p>回答を送りました。ありがとうございます。</p></div> : <div className="report-rating-body">
      <fieldset><legend>このまま提出に使えますか</legend><div className="report-rating-choices">{ratings.map(item => <button key={item.value} type="button" className={`button button-secondary ${rating === item.value ? 'is-selected' : ''}`} aria-pressed={rating === item.value} onClick={() => setRating(item.value)} data-testid={`rating-${item.value}`}>{item.label}</button>)}</div></fieldset>
      <label className="report-rating-minutes"><span>手作業で作ると何分かかりますか</span><span className="report-rating-unit"><input className="ku-input" inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value.replace(/[^0-9]/g, ''))} data-testid="rating-minutes" />分</span></label>
      <label className="report-rating-note"><span>直したい点（任意）</span><textarea className="ku-input" rows={3} value={message} onChange={event => setMessage(event.target.value)} /></label>
      {state.error && <div className="alert-fail"><AlertCircle />{state.error}</div>}
      <button className="button button-secondary" onClick={submit} disabled={!rating || state.busy} data-testid="rating-send"><Send />{state.busy ? '送信中' : '回答を送る'}</button>
    </div>}
  </section>
}
