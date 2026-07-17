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

function buildWsUrl(code: string, role: 'broadcaster' | 'subscriber'): string {
  return `${WORKER_URL.replace(/^http/, 'ws')}/api/room/${code}/ws?role=${role}`
}

/**
 * 看护数据发送端
 * roomCode 存在时走 WebSocket（跨设备），否则走 localStorage（同浏览器降级）
 * 返回的 send 回调永远稳定（useCallback([])），不会触发下游 useEffect 重跑
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

    // WebSocket 模式
    const wsUrl = buildWsUrl(roomCode, 'broadcaster')
    let ws: WebSocket | null = null
    let cancelled = false

    function connect() {
      if (cancelled) return
      ws = new WebSocket(wsUrl)
      ws.onclose = () => {
        if (!cancelled) setTimeout(connect, 2000)
      }
      ws.onerror = () => {
        try { ws?.close() } catch {}
      }
    }
    connect()

    sendRef.current = (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ...data, type: 'status' as const, timestamp: Date.now() }))
      }
    }

    return () => {
      cancelled = true
      try { ws?.close() } catch {}
    }
  }, [roomCode])

  // 稳定回调：永远不变
  return useCallback((data: Omit<CareStatus, 'type' | 'timestamp'>) => {
    sendRef.current(data)
  }, [])
}

/**
 * 看护数据接收端
 * roomCode 存在时走 WebSocket（跨设备），否则走 localStorage（同浏览器降级）
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
      let lastTs = 0
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

    // WebSocket 模式
    const wsUrl = buildWsUrl(roomCode, 'subscriber')
    let ws: WebSocket | null = null
    let cancelled = false
    let lastTs = 0
    let pingInterval: number | undefined

    function connect() {
      if (cancelled) return
      ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        setConnected(true)
        // 心跳保活：每 5 秒发 ping，防止 Cloudflare 关闭空闲连接
        pingInterval = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try { ws.send('ping') } catch {}
          }
        }, 5000)
      }
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as CareStatus
          if (data.type === 'status' && data.timestamp !== lastTs) {
            lastTs = data.timestamp
            setIndex(data.index)
            setLevel(data.level)
            setAudioScore(data.audioScore)
            setBaselineReady(data.baselineReady)
            setBehavior(data.behavior ?? '行为正常')
            if (data.frame) onFrameRef.current?.(data.frame)
          }
        } catch {}
      }
      ws.onclose = () => {
        setConnected(false)
        if (pingInterval) clearInterval(pingInterval)
        if (!cancelled) setTimeout(connect, 2000)
      }
      ws.onerror = () => {
        try { ws?.close() } catch {}
      }
    }
    connect()

    return () => {
      cancelled = true
      if (pingInterval) clearInterval(pingInterval)
      try { ws?.close() } catch {}
    }
  }, [roomCode])

  return { index, level, audioScore, baselineReady, connected, behavior }
}
