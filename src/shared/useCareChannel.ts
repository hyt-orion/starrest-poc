import { useEffect, useRef, useState, useCallback } from 'react'
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

const CHANNEL_NAME = 'starrest-care'

/** 星宝端：广播状态（视频截帧+数字） */
export function useCareSender() {
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME)
    return () => channelRef.current?.close()
  }, [])

  return useCallback((data: Omit<CareStatus, 'type' | 'timestamp'>) => {
    channelRef.current?.postMessage({ ...data, type: 'status' as const, timestamp: Date.now() })
  }, [])
}

/** 家长端：接收状态 */
export function useCareReceiver() {
  const [status, setStatus] = useState<CareStatus | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'status') {
        setStatus(e.data)
        setConnected(true)
      }
    }
    return () => channel.close()
  }, [])

  return { status, connected }
}
