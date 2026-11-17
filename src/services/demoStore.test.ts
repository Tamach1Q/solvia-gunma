import { describe, expect, it } from 'vitest'
import { seedVersion } from '../mock/seed'
import { loadState, resetState, saveState, storageKey } from './demoStore'

const memoryStorage = () => {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) }, data }
}
const now = new Date(2026, 9, 28)

describe('demoStore', () => {
  it('保存がなければシードを作って保存する', () => {
    const storage = memoryStorage()
    const state = loadState(storage, now)
    expect(state.sites).toHaveLength(8)
    expect(JSON.parse(storage.data.get(storageKey)!)).toEqual(state)
  })
  it('保存した状態を読み戻す', () => {
    const storage = memoryStorage()
    const state = loadState(storage, now)
    saveState({ ...state, repairCases: [] }, storage)
    expect(loadState(storage, now).repairCases).toEqual([])
  })
  it('壊れたデータや旧バージョンはシードに置き換える', () => {
    const storage = memoryStorage()
    storage.setItem(storageKey, '{broken')
    expect(loadState(storage, now).sites).toHaveLength(8)
    storage.setItem(storageKey, JSON.stringify({ version: 0 }))
    expect(loadState(storage, now).version).toBe(1)
  })
  it('シードの版が違う保存データは作り直す', () => {
    const storage = memoryStorage()
    const state = loadState(storage, now)
    storage.setItem(storageKey, JSON.stringify({ ...state, seedVersion: seedVersion - 1, repairCases: [] }))
    const reloaded = loadState(storage, now)
    expect(reloaded.seedVersion).toBe(seedVersion)
    expect(reloaded.repairCases).toEqual(state.repairCases)
  })
  it('seedVersionのない旧データ（M1時点の保存形式）も作り直す', () => {
    const storage = memoryStorage()
    const { seedVersion: _omitted, ...legacy } = loadState(storage, now)
    storage.setItem(storageKey, JSON.stringify({ ...legacy, repairCases: [] }))
    expect(loadState(storage, now).repairCases).not.toEqual([])
  })
  it('初期化でシードに戻る', () => {
    const storage = memoryStorage()
    const state = loadState(storage, now)
    saveState({ ...state, repairCases: [] }, storage)
    expect(resetState(storage, now)).toEqual(state)
  })
  it('localStorageが使えなくても動く', () => {
    expect(loadState(null, now).sites).toHaveLength(8)
  })
  it('報告書の承認状態と確認記録を保存して読み戻す', () => {
    const storage = memoryStorage()
    const state = loadState(storage, now)
    state.reportReviews[0] = { ...state.reportReviews[0], status: '承認済み', reviewedBy: '確認担当', reviewedAt: now.toISOString(), confirmations: { owner: { fingerprint: 'test', note: '氏名の変更を確認' } } }
    saveState(state, storage)
    expect(loadState(storage, now).reportReviews).toEqual(state.reportReviews)
  })
})
