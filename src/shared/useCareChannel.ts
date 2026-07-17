import { useEffect, useState, useRef, useCallback } from 'react'
import type { AlertLevel } from '../features/care/alertClassifier'

export interface CareStatus {
  type: 'status'
  index: number
  level: AlertLevel
  audioScore: number
  frame: string | null
  baselineReady: boolean
  behavior: string
  timestamp: number
}

const STORAGE_KEY = 'starrest-care'
const WORKER_URL = 'https://starrest-api.starrest.workers.dev'

/**
 * 看护数据发送端
 * roomCode 存在时走 HTTP POST（跨设备），否则走 localStorage（同浏览器降级）
 * 返回的 send 回调永远稳定（useCallback([])）
 */
export function useCareSender(roomCode?: string) {
  const sendRef = useRef<(data: Omit<CareStatus, 'type' | 'timestamp'>) => void>((data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, type: 'status' as const, timestamp: Date.now() }))
    } catch {}
  })

  useEffect(() => {
    if (!roomCode) {
      // localStorage 模式
      sendRef.current = (data) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, type: 'status' as const, timestamp: Date.now() }))
        } catch {}
      }
      return
    }

    // HTTP POST 模式：fire-and-forget + 3秒超时
    const url = `${WORKER_URL}/api/room/${roomCode}/frame`
    sendRef.current = (data) => {
      const body = JSON.stringify({ ...data, type: 'status' as const, timestamp: Date.now() })
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      }).catch(() => {}).finally(() => clearTimeout(timer))
    }
  }, [roomCode])

  return useCallback((data: Omit<CareStatus, 'type' | 'timestamp'>) => {
    sendRef.current(data)
  }, [])
}

/**
 * 看护数据接收端
 * roomCode 存在时走 HTTP 轮询（跨设备），否则走 localStorage（同浏览器降级）
 */
export function useCareReceiver(onFrame?: (frame: string) => void, roomCode?: string) {
  const [index, setIndex] = useState(0)
  const [level, setLevel] = useState<AlertLevel>('calm')
  const [audioScore, setAudioScore] = useState(0)
  const [baselineReady, setBaselineReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [behavior, setBehavior] = useState('行为正常')
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    if (!roomCode) {
      // localStorage 模式
      let lastTs = 0
      function process(raw: string) {
        try {
          const data = JSON.parse(raw) as CareStatus
          if (data.type === 'status' && data.timestamp !== lastTs) {
            lastTs = data.timestamp
            setIndex(data.index)
            setLevel(data.level)
            setAudioScore(data.audioScore)
            setBaselineReady(data.baselineReady)
            setBehavior(data.behavior ?? '行为正常')
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
    }

    // HTTP 轮询模式：每 250ms 拉取最新帧
    const url = `${WORKER_URL}/api/room/${roomCode}/frame`
    let cancelled = false
    let lastTs = 0

    async function poll() {
      if (cancelled) return
      try {
        const res = await fetch(url)
        if (cancelled) return
        if (!res.ok) {
          setConnected(false)
          return
        }
        const data = await res.json() as CareStatus
        if (data.timestamp !== lastTs) {
          lastTs = data.timestamp
          setIndex(data.index)
          setLevel(data.level)
          setAudioScore(data.audioScore)
          setBaselineReady(data.baselineReady)
          setBehavior(data.behavior ?? '行为正常')
          setConnected(true)
          if (data.frame) onFrameRef.current?.(data.frame)
        }
      } catch {
        setConnected(false)
      }
    }

    const interval = setInterval(poll, 250)
    poll() // 立即拉一次

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [roomCode])

  return { index, level, audioScore, baselineReady, connected, behavior }
}
