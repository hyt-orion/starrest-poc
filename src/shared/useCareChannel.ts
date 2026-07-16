import { useEffect, useState, useCallback } from 'react'
import type { AlertLevel } from '../features/care/alertClassifier'

export interface CareStatus {
  type: 'status'
  index: number
  level: AlertLevel
  audioScore: number
  frame: string | null
  baselineReady: boolean
  timestamp: number
}

const STORAGE_KEY = 'starrest-care'

/** 星宝端：通过 localStorage 广播状态（跨标签通信，比 BroadcastChannel 更可靠） */
export function useCareSender() {
  return useCallback((data: Omit<CareStatus, 'type' | 'timestamp'>) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...data, type: 'status' as const, timestamp: Date.now() }),
      )
    } catch {
      // quota exceeded, skip
    }
  }, [])
}

/** 家长端：监听 localStorage 变化接收状态（storage 事件在其他标签页触发） */
export function useCareReceiver() {
  const [status, setStatus] = useState<CareStatus | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    function handler(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const data = JSON.parse(e.newValue) as CareStatus
          if (data.type === 'status') {
            setStatus(data)
            setConnected(true)
          }
        } catch {
          // parse error
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return { status, connected }
}
