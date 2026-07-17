import { useRef, useState, useCallback, useEffect } from 'react'
import { useCareReceiver } from '../../shared/useCareChannel'
import { FloatBall } from './FloatBall'
import { MeditationPanel, TreeHolePanel, CraftPanel } from './RelaxPanels'
import { BlindBox } from '../rewards/BlindBox'
import { getRewards, completeSession, getWeeklyRelaxMinutes, type Reward } from '../rewards/rewardsStore'
import { useNavigate } from 'react-router-dom'
import { Settings, WifiOff, ExternalLink, Maximize, Minimize, Link2, Unlink } from 'lucide-react'
import { getSettings } from '../settings/settingsStore'
import { LEVEL_LABELS } from './alertClassifier'
import { useFullscreen } from '../../shared/useFullscreen'
import { sendNotification, isNotificationSupported, requestNotificationPermission } from '../../shared/notifications'
import { logEvent } from './EventLog'
import { acquireWakeLock, releaseWakeLock, isWakeLockSupported } from '../../shared/wakeLock'

type RelaxMode = 'none' | 'meditation' | 'craft' | 'treehole'
type Tab = 'relax' | 'video'

const ROOM_CODE_KEY = 'starrest_room_code'

export function CareDashboard() {
  const navigate = useNavigate()
  const settings = getSettings()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('relax')
  const [activeRelax, setActiveRelax] = useState<RelaxMode>('none')
  const [recvCount, setRecvCount] = useState(0)
  const [rewardState, setRewardState] = useState(getRewards())
  const [showBlindBox, setShowBlindBox] = useState(false)
  const [currentReward, setCurrentReward] = useState<Reward | null>(null)
  const [roomCode, setRoomCode] = useState<string>(() => localStorage.getItem(ROOM_CODE_KEY) || '')

  const [indexHistory, setIndexHistory] = useState<number[]>([])
  const indexHistoryRef = useRef<number[]>([])
  const { isFullscreen, toggleFullscreen, fullscreenRef } = useFullscreen()
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

  const { index, level, audioScore, baselineReady, connected, behavior } = useCareReceiver(handleFrame, roomCode || undefined)

  useEffect(() => {
    if (!baselineReady) return
    const next = [...indexHistoryRef.current, index].slice(-60)
    indexHistoryRef.current = next
    setIndexHistory(next)
  }, [index, baselineReady])

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

  useEffect(() => {
    if (settings.pushEnabled && isNotificationSupported() && Notification.permission === 'default') {
      requestNotificationPermission()
    }
  }, [settings.pushEnabled])

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

  function handleCreateRoom() {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    setRoomCode(code)
    localStorage.setItem(ROOM_CODE_KEY, code)
  }

  function handleDisconnect() {
    setRoomCode('')
    localStorage.removeItem(ROOM_CODE_KEY)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
          <button
            onClick={() => setActiveTab('relax')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${activeTab === 'relax' ? 'bg-emerald-600 text-white' : 'text-white/50 hover:text-white'}`}
          >
            家长喘息
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${activeTab === 'video' ? 'bg-emerald-600 text-white' : 'text-white/50 hover:text-white'}`}
          >
            星宝视频
          </button>
        </div>
        <div className="flex items-center gap-2">
          {roomCode ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-900/40 px-3 py-1.5">
              <span className="text-xs font-medium text-emerald-300">房间 {roomCode}</span>
              <button onClick={handleDisconnect} aria-label="断开房间" className="text-white/40 hover:text-white">
                <Unlink className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={handleCreateRoom} className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white/60 hover:text-white">
              <Link2 className="h-3.5 w-3.5" /> 创建房间
            </button>
          )}
          <button onClick={() => navigate('/settings')} aria-label="设置" className="text-white/40 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
      {roomCode && (
        <p className="px-4 pb-1 text-center text-xs text-emerald-400/60">
          在星宝端输入房间码 <span className="font-bold text-emerald-300">{roomCode}</span> 进行配对
        </p>
      )}

      {/* 喘息页面 */}
      {activeTab === 'relax' && (
        <div className="flex h-full w-full flex-col">
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
      )}

      {/* 视频页面 */}
      {activeTab === 'video' && (
        <div ref={fullscreenRef} className="relative flex-1 overflow-hidden bg-black">
          <canvas ref={canvasRef} width={320} height={240} className="h-full w-full object-contain" />
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
              <p className="text-[10px] text-white/40">接收{recvCount}帧 · 音频{audioScore}</p>
            </div>
          )}
        </div>
      )}

      {/* 隐藏 canvas：视频页面未显示时仍接收帧数据（保持连接状态更新） */}
      {activeTab !== 'video' && (
        <canvas ref={canvasRef} width={320} height={240} className="hidden" />
      )}

      {showBlindBox && currentReward && (
        <BlindBox reward={currentReward} onClose={() => setShowBlindBox(false)} />
      )}
    </div>
  )
}
