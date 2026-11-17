import { demoAccounts, type AccountRole, type DemoAccount } from '../config/demoAccounts'

// ログイン中のアカウント。管理側の状態とは別のキーに置き、データの初期化ではログアウトしない。
export const sessionKey = 'solvia_gunma_session'
export type Session = { email: string; name: string; company: string; role: AccountRole; signedInAt: string }

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const browserStorage = (): KeyValueStorage | null => { try { return window.localStorage } catch { return null } }

export function signIn(email: string, password: string, accounts: DemoAccount[] = demoAccounts, storage = browserStorage(), now = new Date()): Session | null {
  const account = accounts.find(item => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password)
  if (!account) return null
  const session: Session = { email: account.email, name: account.name, company: account.company, role: account.role, signedInAt: now.toISOString() }
  try { storage?.setItem(sessionKey, JSON.stringify(session)) } catch { /* 保存できなくても、この画面を開いている間はログインしたままにする */ }
  return session
}

export function loadSession(storage = browserStorage()): Session | null {
  try {
    const stored = storage?.getItem(sessionKey)
    const parsed = stored ? JSON.parse(stored) as Partial<Session> : null
    return parsed?.email && parsed.name && parsed.company && parsed.role ? parsed as Session : null
  } catch { return null }
}

export function signOut(storage = browserStorage()) {
  try { storage?.removeItem(sessionKey) } catch { /* 削除できなくても画面はログインに戻す */ }
}
