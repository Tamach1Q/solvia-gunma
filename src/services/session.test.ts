import { describe, expect, it } from 'vitest'
import type { DemoAccount } from '../config/demoAccounts'
import { feedbackFields } from './feedbackService'
import { loadSession, sessionKey, signIn, signOut } from './session'

const memoryStorage = () => {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) }, data }
}
const accounts: DemoAccount[] = [{ email: 'admin@example.demo', password: 'pass', name: '田中', company: '株式会社テスト', role: '管理者' }]
const now = new Date(2026, 10, 25, 15, 0)

describe('ログイン（照合のみ）', () => {
  it('メールアドレス（大文字小文字・前後の空白は無視）とパスワードが合えばログインし、保存する', () => {
    const storage = memoryStorage()
    const session = signIn('  Admin@Example.demo ', 'pass', accounts, storage, now)
    expect(session).toMatchObject({ email: 'admin@example.demo', name: '田中', company: '株式会社テスト', role: '管理者' })
    expect(loadSession(storage)).toEqual(session)
  })
  it('パスワードが違えばログインしない', () => {
    const storage = memoryStorage()
    expect(signIn('admin@example.demo', 'wrong', accounts, storage, now)).toBeNull()
    expect(storage.data.has(sessionKey)).toBe(false)
  })
  it('ログアウトすると保存を消す。壊れた保存はログインしていない扱い', () => {
    const storage = memoryStorage()
    signIn('admin@example.demo', 'pass', accounts, storage, now)
    signOut(storage)
    expect(loadSession(storage)).toBeNull()
    storage.setItem(sessionKey, '{壊れた')
    expect(loadSession(storage)).toBeNull()
  })
})

describe('フィードバックの送信内容', () => {
  it('Netlify Formsのフォーム名と、誰が・どの画面で・何を送ったかを入れる', () => {
    const session = { email: 'admin@example.demo', name: '田中', company: '株式会社テスト', role: '管理者' as const, signedInAt: now.toISOString() }
    const fields = feedbackFields({ kind: '報告書の評価', screen: '点検報告書', rating: '△', minutes: ' 20 ', message: '写真の順番を変えたい', inspection: 'INS-S-03' }, now, session, 'https://example.netlify.app/')
    expect(fields).toEqual({
      'form-name': 'feedback', kind: '報告書の評価', screen: '点検報告書', message: '写真の順番を変えたい', rating: '△', minutes: '20', inspection: 'INS-S-03',
      account: 'admin@example.demo', name: '田中', company: '株式会社テスト', page: 'https://example.netlify.app/', sentAt: now.toISOString(),
    })
  })
})
