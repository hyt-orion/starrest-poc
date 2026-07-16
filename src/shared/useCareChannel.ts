import { useEffect, useState, useRef, useCallback } from 'react'
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

export function useCareSender() {
  return useCallback((data: Omit<CareStatus, 'type' | 'timestamp'>) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...data, type: 'status' as const, timestamp: Date.now() }),
      )
    } catch {
      // quota exceeded
    }
  }, [])
}

export function useCareReceiver() {
  const [status, setStatus] = useState<CareStatus | null>(null)
  const [connected, setConnected] = useState(false)
  const lastTsRef = useRef(0)

  useEffect(() => {
    function process(raw: string) {
      try {
        const data = JSON.parse(raw) as CareStatus
        if (data.type === 'status' && data.timestamp !== lastTsRef.current) {
          lastTsRef.current = data.timestamp
          setStatus(data)
          setConnected(true)
        }
      } catch {
        // parse error
      }
    }

    // 方式1：storage 事件（跨标签触发）
    function handler(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) process(e.newValue)
    }
    window.addEventListener('storage', handler)

    // 方式2：轮询兜底（200ms 直接读 localStorage，不依赖事件）
    const interval = setInterval(() => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) process(raw)
    }, 200)

    return () => {
      window.removeEventListener('storage', handler)
      clearInterval(interval)
    }
  }, [])

  return { status, connected }
}
