/**
 * WebSocket 通信频道
 *
 * 用于看护场景的实时通信：
 *  - broadcaster（星宝端）：调用 useWebSocketSender，发送视频帧 + 状态数据
 *  - subscriber（家长端）：调用 useWebSocketReceiver，接收 broadcaster 转发的数据
 *
 * 心跳机制：
 *  - 每 5 秒发送一次 ping
 *  - 15 秒未收到任何消息判定为断线（subscriber 端显示"星宝端已断开"）
 *  - 断线后自动重连
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import type { AlertLevel } from '../features/care/alertClassifier'
import type { CareStatus } from './useCareChannel'

const HEARTBEAT_INTERVAL = 5000 // 5 秒心跳
const DISCONNECT_TIMEOUT = 15000 // 15 秒无消息判定断线
const RECONNECT_DELAY = 2000 // 断线后重连延迟
const DISCONNECT_CHECK_INTERVAL = 2000 // 断线检测周期

// ===== broadcaster 端（星宝端发送） =====

export function useWebSocketSender(url: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!url) {
      setConnected(false)
      wsRef.current = null
      return
    }
    const wsUrl = url

    let ws: WebSocket | null = null
    let closed = false
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null

    function connect() {
      try {
        ws = new WebSocket(wsUrl)
      } catch {
        scheduleReconnect()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        if (closed) return
        setConnected(true)
        // 每 5 秒发心跳
        heartbeatTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping', t: Date.now() }))
            } catch {}
          }
        }, HEARTBEAT_INTERVAL)
      }

      ws.onmessage = () => {
        // broadcaster 端忽略收到的消息（如 ping/pong），但连接活跃
      }

      ws.onclose = () => {
        if (closed) return
        setConnected(false)
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        scheduleReconnect()
      }

      ws.onerror = () => {
        try { ws?.close() } catch {}
      }
    }

    function scheduleReconnect() {
      if (closed) return
      setTimeout(() => {
        if (!closed) connect()
      }, RECONNECT_DELAY)
    }

    connect()

    return () => {
      closed = true
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      try { ws?.close() } catch {}
      wsRef.current = null
    }
  }, [url])

  const send = useCallback((data: Omit<CareStatus, 'type' | 'timestamp'>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const payload: CareStatus = { ...data, type: 'status', timestamp: Date.now() }
    try {
      ws.send(JSON.stringify(payload))
    } catch {}
  }, [])

  return { send, connected }
}

// ===== subscriber 端（家长端接收） =====

export function useWebSocketReceiver(url: string | null, onFrame?: (frame: string) => void) {
  const [index, setIndex] = useState(0)
  const [level, setLevel] = useState<AlertLevel>('calm')
  const [audioScore, setAudioScore] = useState(0)
  const [baselineReady, setBaselineReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [behavior, setBehavior] = useState('行为正常')

  const wsRef = useRef<WebSocket | null>(null)
  const lastMsgRef = useRef(0)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    if (!url) {
      setConnected(false)
      wsRef.current = null
      return
    }
    const wsUrl = url

    let ws: WebSocket | null = null
    let closed = false
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let disconnectTimer: ReturnType<typeof setInterval> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      try {
        ws = new WebSocket(wsUrl)
      } catch {
        scheduleReconnect()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        if (closed) return
        // 连上 DO 不代表 broadcaster 在线，先初始化 lastMsg
        lastMsgRef.current = Date.now()

        // 每 5 秒发心跳
        heartbeatTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping', t: Date.now() }))
            } catch {}
          }
        }, HEARTBEAT_INTERVAL)

        // 周期性检测断线
        disconnectTimer = setInterval(() => {
          if (Date.now() - lastMsgRef.current > DISCONNECT_TIMEOUT) {
            // 超过 15 秒未收到消息 → 星宝端已断开
            setConnected(false)
            setBehavior('星宝端已断开')
            try { ws?.close() } catch {}
          }
        }, DISCONNECT_CHECK_INTERVAL)
      }

      ws.onmessage = (e) => {
        // 任何消息（包括 ping）都刷新 lastMsg
        lastMsgRef.current = Date.now()
        try {
          const data = JSON.parse(e.data) as Partial<CareStatus> & { type: string }
          if (data.type === 'status') {
            if (typeof data.index === 'number') setIndex(data.index)
            if (data.level) setLevel(data.level)
            if (typeof data.audioScore === 'number') setAudioScore(data.audioScore)
            if (typeof data.baselineReady === 'boolean') setBaselineReady(data.baselineReady)
            setBehavior(data.behavior ?? '行为正常')
            setConnected(true)
            if (data.frame) onFrameRef.current?.(data.frame)
          }
        } catch {}
      }

      ws.onclose = () => {
        if (closed) return
        setConnected(false)
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (disconnectTimer) {
          clearInterval(disconnectTimer)
          disconnectTimer = null
        }
        scheduleReconnect()
      }

      ws.onerror = () => {
        try { ws?.close() } catch {}
      }
    }

    function scheduleReconnect() {
      if (closed) return
      reconnectTimer = setTimeout(() => {
        if (!closed) connect()
      }, RECONNECT_DELAY)
    }

    connect()

    return () => {
      closed = true
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (disconnectTimer) clearInterval(disconnectTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      try { ws?.close() } catch {}
      wsRef.current = null
    }
  }, [url])

  return { index, level, audioScore, baselineReady, connected, behavior }
}
