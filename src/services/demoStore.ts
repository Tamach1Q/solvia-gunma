import { createSeed, seedVersion, type DemoState } from '../mock/seed'

// 管理側の状態（発電所・点検・修繕案件）はデモPC1台のlocalStorageに保存する。
export const storageKey = 'solvia_gunma_v1'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const browserStorage = (): KeyValueStorage | null => { try { return window.localStorage } catch { return null } }

export function loadState(storage = browserStorage(), now = new Date()): DemoState {
  try {
    const stored = storage?.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as DemoState
      if (parsed.version === 1 && parsed.seedVersion === seedVersion && Array.isArray(parsed.sites) && Array.isArray(parsed.inspections) && Array.isArray(parsed.repairCases) && Array.isArray(parsed.photos) && Array.isArray(parsed.reportReviews)) return parsed
    }
  } catch { /* 壊れた保存データはシードで置き換える */ }
  // 保存がない・壊れている・シードの版が古い場合は作り直す
  const seed = createSeed(now)
  saveState(seed, storage)
  return seed
}

export function saveState(state: DemoState, storage = browserStorage()) {
  try { storage?.setItem(storageKey, JSON.stringify(state)) } catch { /* 容量超過やプライベートモードでは保存せず続行 */ }
}

export function resetState(storage = browserStorage(), now = new Date()): DemoState {
  try { storage?.removeItem(storageKey) } catch { /* 削除できなくてもシードで上書きする */ }
  return loadState(storage, now)
}
