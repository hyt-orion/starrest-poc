/**
 * Wake Lock API 封装：保持屏幕常亮
 * 自动在页面隐藏时释放、可见时重新获取（仅当用户曾主动获取过）。
 */

interface WakeLockSentinelLike {
  release: () => Promise<void>
  addEventListener: (type: string, listener: () => void) => void
  released?: boolean
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

let wakeLockSentinel: WakeLockSentinelLike | null = null
/** 用户是否曾主动请求过 wake lock（用于决定可见时是否自动重获取） */
let userRequested = false

function getWakeLock(): WakeLockLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  const nav = navigator as Navigator & { wakeLock?: WakeLockLike }
  return nav.wakeLock
}

export function isWakeLockSupported(): boolean {
  return !!getWakeLock()?.request
}

/** 获取屏幕常亮锁，成功返回 true */
export async function acquireWakeLock(): Promise<boolean> {
  const wl = getWakeLock()
  if (!wl) return false
  userRequested = true
  try {
    const sentinel = await wl.request('screen')
    wakeLockSentinel = sentinel
    sentinel.addEventListener('release', () => {
      wakeLockSentinel = null
    })
    return true
  } catch {
    return false
  }
}

/** 主动释放屏幕常亮锁，并清除用户意图 */
export async function releaseWakeLock(): Promise<void> {
  userRequested = false
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release()
    } catch {
      /* 静默 */
    }
    wakeLockSentinel = null
  }
}

/**
 * 自动在页面隐藏时释放、可见时重新获取。
 * 仅在用户曾主动 acquire 过的情况下生效，避免静默获取权限。
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!userRequested) return
    if (document.visibilityState === 'visible') {
      void acquireWakeLock()
    } else if (wakeLockSentinel) {
      try {
        void wakeLockSentinel.release()
      } catch {
        /* 静默 */
      }
      wakeLockSentinel = null
    }
  })
}
