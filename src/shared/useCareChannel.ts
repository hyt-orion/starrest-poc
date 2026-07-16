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
    } catch {}
  }, [])
}

/** frame 通过 onFrame callback 直接传出，不经过 React state（避免大字符串 re-render） */
export function useCareReceiver(onFrame?: (frame: string) => void) {
  const [index, setIndex] = useState(0)
  const [level, setLevel] = useState<AlertLevel>('calm')
  const [audioScore, setAudioScore] = useState(0)
  const [baselineReady, setBaselineReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const lastTsRef = useRef(0)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    function process(raw: string) {
      try {
        const data = JSON.parse(raw) as CareStatus
        if (data.type === 'status' && data.timestamp !== lastTsRef.current) {
          lastTsRef.current = data.timestamp
          setIndex(data.index)
          setLevel(data.level)
          setAudioScore(data.audioScore)
          setBaselineReady(data.baselineReady)
          setConnected(true)
          if (data.frame) onFrameRef.current?.(data.frame)
        }
      } catch {}
    }

    function handler(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) process(e.newValue)
    }
    window.addEventListener('storage', handler)

    const interval = setInterval(() => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) process(raw)
    }, 200)

    return () => {
      window.removeEventListener('storage', handler)
      clearInterval(interval)
    }
  }, [])

  return { index, level, audioScore, baselineReady, connected }
}
