import { AlertCircle, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import logo from '../design-system/assets/kauelu-logo.png'
import { signIn, type Session } from '../services/session'

export function LoginScreen({ onSignIn }: { onSignIn: (session: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const session = signIn(email, password)
    if (session) onSignIn(session)
    else setError('メールアドレスかパスワードが違います。')
  }
  return <div className="login-page" data-testid="login-screen">
    <form className="login-card" onSubmit={submit} noValidate>
      <img className="login-logo" src={logo} alt="Kauelu" />
      <h1>SOLVIA 点検・保守管理</h1>
      <p className="login-lead">お渡ししたメールアドレスとパスワードでログインしてください。</p>
      <label className="login-field"><span>メールアドレス</span><input className="ku-input" type="email" autoComplete="username" value={email} onChange={event => { setEmail(event.target.value); setError('') }} required data-testid="login-email" /></label>
      <label className="login-field"><span>パスワード</span><input className="ku-input" type="password" autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setError('') }} required data-testid="login-password" /></label>
      <div aria-live="polite">{error && <div className="alert-fail"><AlertCircle />{error}</div>}</div>
      <button className="button button-primary login-submit" type="submit" disabled={!email || !password} data-testid="login-submit"><LogIn />ログイン</button>
      <p className="login-help">パスワードがわからない場合は、Kaueluの担当者にお問い合わせください。</p>
    </form>
  </div>
}
