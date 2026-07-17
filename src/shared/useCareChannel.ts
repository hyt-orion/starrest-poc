import { useEffect, useState, useRef, useCallback } from 'react'
import type { AlertLevel } from '../features/care/alertClassifier'
import { useWebSocketSender, useWebSocketReceiver } from './useWebSocketChannel'
import { buildWsUrl } from './roomCode'

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

// ===== localStorage 模式（降级方案，保持向后兼容） =====

function useLocalStorageSender() {
  return useCallback((data: Omit<CareStatus, 'type' | 'timestamp'>) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...data, type: 'status' as const, timestamp: Date.now() }),
      )
    } catch {}
  }, [])
}

function useLocalStorageReceiver(onFrame?: (frame: string) => void, enabled = true) {
  const [index, setIndex] = useState(0)
  const [level, setLevel] = useState<AlertLevel>('calm')
  const [audioScore, setAudioScore] = useState(0)
  const [baselineReady, setBaselineReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [behavior, setBehavior] = useState('行为正常')
  const lastTsRef = useRef(0)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    if (!enabled) return

    function process(raw: string) {
      try {
        const data = JSON.parse(raw) as CareStatus
        if (data.type === 'status' && data.timestamp !== lastTsRef.current) {
          lastTsRef.current = data.timestamp
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
  }, [enabled])

  return { index, level, audioScore, baselineReady, connected, behavior }
}

// ===== 对外入口：根据 roomCode 选择通信模式 =====

/**
 * 看护数据发送端
 * @param roomCode 可选房间码。提供时走 WebSocket；否则走 localStorage（降级）。
 */
export function useCareSender(roomCode?: string) {
  const url = roomCode ? buildWsUrl(roomCode, 'broadcaster') : null
  const ws = useWebSocketSender(url)
  const lsSend = useLocalStorageSender()

  // 用 ref 跟踪当前模式，避免回调失效
  const useWs = !!roomCode
  const useWsRef = useRef(useWs)
  useWsRef.current = useWs

  return useCallback(
    (data: Omit<CareStatus, 'type' | 'timestamp'>) => {
      if (useWsRef.current) {
        ws.send(data)
      } else {
        lsSend(data)
      }
    },
    [ws, lsSend],
  )
}

/**
 * 看护数据接收端
 * @param onFrame 视频帧回调
 * @param roomCode 可选房间码。提供时走 WebSocket；否则走 localStorage（降级）。
 */
export function useCareReceiver(onFrame?: (frame: string) => void, roomCode?: string) {
  const url = roomCode ? buildWsUrl(roomCode, 'subscriber') : null
  const useWs = !!roomCode
  const wsState = useWebSocketReceiver(useWs ? url : null, onFrame)
  const lsState = useLocalStorageReceiver(onFrame, !useWs)

  // 两个 hook 都按规则调用，但只有活跃模式的状态被采用
  return useWs ? wsState : lsState
}
