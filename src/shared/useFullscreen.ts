/**
 * 全屏 Hook
 * 用法：
 *   const { isFullscreen, toggleFullscreen, fullscreenRef } = useFullscreen()
 *   <div ref={fullscreenRef}>...</div>
 *   <button onClick={toggleFullscreen}>全屏</button>
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseFullscreenReturn {
  isFullscreen: boolean
  toggleFullscreen: () => Promise<void>
  fullscreenRef: React.RefObject<HTMLDivElement>
}

export function useFullscreen(): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const toggleFullscreen = useCallback(async () => {
    const el = fullscreenRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      /* 全屏 API 不可用或被拒绝时静默 */
    }
  }, [])

  useEffect(() => {
    function handler() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return { isFullscreen, toggleFullscreen, fullscreenRef }
}
