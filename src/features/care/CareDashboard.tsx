import { useRef, useState, useCallback, useEffect } from 'react'
import { useCareReceiver } from '../../shared/useCareChannel'
import { FloatBall } from './FloatBall'
import { MeditationPanel, TreeHolePanel, CraftPanel } from './RelaxPanels'
import { BlindBox } from '../rewards/BlindBox'
import { getRewards, completeSession, getWeeklyRelaxMinutes, type Reward } from '../rewards/rewardsStore'
import { useNavigate } from 'react-router-dom'
import { Settings, WifiOff, ExternalLink, Maximize, Minimize } from 'lucide-react'
import { getSettings } from '../settings/settingsStore'
import { LEVEL_LABELS } from './alertClassifier'
import { useFullscreen } from '../../shared/useFullscreen'
import { sendNotification, isNotificationSupported, requestNotificationPermission } from '../../shared/notifications'
import { logEvent } from './EventLog'
import { acquireWakeLock, releaseWakeLock, isWakeLockSupported } from '../../shared/wakeLock'

type RelaxMode = 'none' | 'meditation' | 'craft' | 'treehole'

export function CareDashboard() {
  const navigate = useNavigate()
  const settings = getSettings()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [activeRelax, setActiveRelax] = useState<RelaxMode>('none')
  const [recvCount, setRecvCount] = useState(0)
  const [rewardState, setRewardState] = useState(getRewards())
  const [showBlindBox, setShowBlindBox] = useState(false)
  const [currentReward, setCurrentReward] = useState<Reward | null>(null)

  // 活跃指数历史（最近 60 个值，用于迷你折线图）
  const [indexHistory, setIndexHistory] = useState<number[]>([])
  const indexHistoryRef = useRef<number[]>([])

  // 全屏
  const { isFullscreen, toggleFullscreen, fullscreenRef } = useFullscreen()

  // 周喘息时长
  const weeklyMinutes = getWeeklyRelaxMinutes()

  const handleFrame = useCallback((frame: string) => {
    setRecvCount((c) => c + 1)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    img.src = frame
  }, [])

  const { index, level, audioScore, baselineReady, connected, behavior } = useCareReceiver(handleFrame)

  // 记录活跃指数历史
  useEffect(() => {
    if (!baselineReady) return
    const next = [...indexHistoryRef.current, index].slice(-60)
    indexHistoryRef.current = next
    setIndexHistory(next)
  }, [index, baselineReady])

  // 干预级提醒：桌面通知 + 事件记录
  const lastAlertRef = useRef(0)
  useEffect(() => {
    if (level !== 'act' || !baselineReady) return
    const now = Date.now()
    if (now - lastAlertRef.current < 30000) return
    lastAlertRef.current = now
    if (isNotificationSupported() && Notification.permission === 'granted') {
      sendNotification('星憩时刻 · 需要关注', `活跃指数 ${index} · ${behavior}`)
    }
    logEvent('alert', `指数${index} · ${behavior} · 音频${audioScore}`)
  }, [level, baselineReady, index, behavior, audioScore])

  // 请求通知权限（首次）
  useEffect(() => {
    if (settings.pushEnabled && isNotificationSupported() && Notification.permission === 'default') {
      requestNotificationPermission()
    }
  }, [settings.pushEnabled])

  // 屏幕常亮（Wake Lock）
  useEffect(() => {
    if (!isWakeLockSupported()) return
    void acquireWakeLock()
    return () => { void releaseWakeLock() }
  }, [])

  async function handleRelaxClose() {
    setActiveRelax('none')
    const { state, newReward } = await completeSession()
    setRewardState(state)
    setCurrentReward(newReward)
    setShowBlindBox(true)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950">
      {/* 上半：悬浮球 + 喘息活动 */}
      <div className="flex flex-1 flex-col border-b border-slate-800">
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-sm font-medium text-white/70">星憩时刻 · 家长端</span>
          <button onClick={() => navigate('/settings')} aria-label="设置" className="text-white/40 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-center pt-4 pb-2">
          <FloatBall
            index={index}
            level={level}
            baselineReady={baselineReady}
            pushEnabled={settings.pushEnabled}
            history={indexHistory}
            behavior={behavior}
          />
        </div>
        <p className="pb-2 text-center text-xs text-white/50">
          {connected ? `综合${index} 音频${audioScore} · 接收${recvCount}帧` : '等待星宝端连接…'}
        </p>

        {activeRelax === 'none' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
            <p className="mb-2 text-sm font-medium text-white/70">家长喘息活动</p>
            <button onClick={() => setActiveRelax('meditation')} className="w-full max-w-xs rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-4 text-left transition hover:bg-emerald-900/50">
              <span className="text-sm font-medium text-emerald-300">正念冥想引导</span>
              <span className="block text-xs text-white/40">4-7-8 呼吸法 · 语音引导 · 3/5/10分钟</span>
            </button>
            <button onClick={() => setActiveRelax('craft')} className="w-full max-w-xs rounded-xl border border-purple-700/40 bg-purple-900/30 p-4 text-left transition hover:bg-purple-900/50">
              <span className="text-sm font-medium text-purple-300">艺术手作</span>
              <span className="block text-xs text-white/40">折纸 · 纸盘画 · 黏土 · 步骤计时</span>
            </button>
            <button onClick={() => setActiveRelax('treehole')} className="w-full max-w-xs rounded-xl border border-blue-700/40 bg-blue-900/30 p-4 text-left transition hover:bg-blue-900/50">
              <span className="text-sm font-medium text-blue-300">匿名树洞</span>
              <span className="block text-xs text-white/40">打字发泄 · 拥抱互动 · 完全匿名</span>
            </button>
          </div>
        ) : activeRelax === 'meditation' ? (
          <MeditationPanel onClose={handleRelaxClose} />
        ) : activeRelax === 'craft' ? (
          <CraftPanel onClose={handleRelaxClose} />
        ) : (
          <TreeHolePanel onClose={handleRelaxClose} />
        )}

        <div className="p-4 text-center">
          <p className="text-xs text-white/50">
            {connected ? `${LEVEL_LABELS[level]} · 综合${index}` : '等待连接…'}
          </p>
          {rewardState.totalSessions > 0 && (
            <p className="mt-1 text-xs text-emerald-400/60">
              累计{rewardState.totalSessions}次 · 连续{rewardState.streak}天
              {weeklyMinutes > 0 && ` · 本周喘息${weeklyMinutes}分钟`}
            </p>
          )}
        </div>
      </div>

      {/* 下半：星宝端视频 */}
      <div ref={fullscreenRef} className="relative h-[40%] w-full bg-slate-950">
        <canvas ref={canvasRef} width={320} height={240} className="h-full w-full object-cover" />
        {!connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-center">
            <WifiOff className="h-12 w-12 text-white/20" />
            <p className="text-sm text-white/40">星宝端未连接</p>
            <p className="text-xs text-white/30">在星宝的设备上打开星宝端</p>
            <a href="#/child" target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white">
              <ExternalLink className="h-4 w-4" /> 打开星宝端
            </a>
          </div>
        )}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <div className="rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm">
            <p className="text-xs font-medium text-white/80">{connected ? '星宝看护 · 实时' : '星宝看护 · 离线'}</p>
          </div>
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '退出全屏' : '全屏'}
            className="rounded-lg bg-black/40 p-1.5 backdrop-blur-sm text-white/60 hover:text-white"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
        {connected && (
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-lg bg-black/40 px-4 py-2 backdrop-blur-sm">
            <div className="space-y-0.5">
              <p className="text-sm text-white/80">{LEVEL_LABELS[level]} · 指数 {index}</p>
              <p className="text-xs text-white/50">{behavior}</p>
            </div>
            <p className="text-[10px] text-white/40">接收{recvCount}帧</p>
          </div>
        )}
      </div>

      {showBlindBox && currentReward && (
        <BlindBox reward={currentReward} onClose={() => setShowBlindBox(false)} />
      )}
    </div>
  )
}
