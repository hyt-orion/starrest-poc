/**
 * 活跃指数历史持久化（IndexedDB）
 * 用于 7 天个性化基线计算
 */

const DB_NAME = 'starrest-db'
const STORE = 'indices'

interface IndexRecord {
  timestamp: number
  value: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'timestamp' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveIndex(value: number): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ timestamp: Date.now(), value } as IndexRecord)
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch { /* IndexedDB 不可用时静默降级 */ }
}

export async function getRecentIndices(days = 7): Promise<IndexRecord[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readonly')
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    const range = IDBKeyRange.lowerBound(since)
    return await new Promise<IndexRecord[]>((resolve) => {
      const req = tx.objectStore(STORE).getAll(range)
      req.onsuccess = () => { db.close(); resolve(req.result ?? []) }
      req.onerror = () => { db.close(); resolve([]) }
    })
  } catch {
    return []
  }
}

export async function clearBaselineData(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch { /* noop */ }
}
