import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCameraStream } from './useCameraStream'
import { getPoseDetector } from '../../infrastructure/ml/poseDetector'
import { computeDisplacement, displacementToIndex } from './activityIndex'
import { BaselineEngine } from './baselineEngine'
import { classifyAlert, LEVEL_LABELS, type AlertLevel } from './alertClassifier'
import { FloatBall } from './FloatBall'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { getSettings } from '../settings/settingsStore'

/**
 * 看护主流程：摄像头 → MediaPipe Pose → 活跃指数 → 基线 z-score → 分级 → 悬浮球
 * 对应文档调用链 1：CareDashboard → useCameraStream → inferenceEngine → alertClassifier → FloatBall
 */
export function CareDashboard() {
  const { videoRef, error, ready } = useCameraStream()
  const navigate = useNavigate()
  const settings = getSettings()
  const [index, setIndex] = useState(0)
  const [level, setLevel] = useState<AlertLevel>('calm')
  const [baselineReady, setBaselineReady] = useState(false)
  const [status, setStatus] = useState('正在初始化…')

  const prevLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const baselineRef = useRef(new BaselineEngine(60))
  const rafRef = useRef(0)
  const lastDetectRef = useRef(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function init() {
      try {
        setStatus('加载 AI 模型…')
        await getPoseDetector()
        setStatus('看护中')
        rafRef.current = requestAnimationFrame(loop)
      } catch (e) {
        setStatus('模型加载失败：' + String(e))
      }
    }

    function loop() {
      if (cancelled) return
      const now = performance.now()
      if (now - lastDetectRef.current > 200) {
        lastDetectRef.current = now
        void detect(now)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    async function detect(now: number) {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const detector = await getPoseDetector()
        const result = detector.detectForVideo(video, now)
        if (result.landmarks && result.landmarks.length > 0) {
          const curr = result.landmarks[0]
          const prev = prevLandmarksRef.current
          if (prev) {
            const disp = computeDisplacement(curr, prev)
            const idx = displacementToIndex(disp)
            const bl = baselineRef.current
            bl.push(idx)
            setIndex(idx)
            if (bl.ready) {
              setBaselineReady(true)
              const state = classifyAlert(bl.zScore, idx, settings.alertSensitivity)
              setLevel(state.level)
            }
          }
          prevLandmarksRef.current = curr
        } else {
          baselineRef.current.push(0)
          setIndex(0)
        }
      } catch {
        // 推理失败静默跳过
      }
    }

    void init()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
    }
  }, [ready])

  if (error) {
    return (
      <div className="flex h-full w-full overflow-hidden bg-slate-950">
        <div className="flex w-1/2 flex-col items-center justify-center gap-3 border-r border-slate-800 p-8 text-center">
          <FloatBall index={0} level="calm" baselineReady={false} pushEnabled={settings.pushEnabled} />
          <p className="text-lg font-semibold text-red-400">摄像头无法启动</p>
          <p className="text-sm text-slate-400">{error}</p>
          <p className="text-xs text-slate-500">请允许摄像头权限。视频仅本地处理，不上传。</p>
        </div>
        <div className="flex w-1/2 items-center justify-center p-8 text-center">
          <p className="text-sm text-slate-500">星宝看护画面待摄像头就绪</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950">
      {/* ── 左半：家长端 ── */}
      <div className="flex w-1/2 flex-col border-r border-slate-800">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-sm font-medium text-white/70">星憩时刻</span>
          <button onClick={() => navigate('/settings')} className="text-white/40 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>
        {/* 悬浮球 */}
        <div className="flex items-center justify-center pt-4 pb-2">
          <FloatBall index={index} level={level} baselineReady={baselineReady} pushEnabled={settings.pushEnabled} />
        </div>
        <p className="pb-2 text-center text-xs text-white/50">孩子状态 · 活跃指数</p>

        {/* 喘息活动 */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="mb-2 text-sm font-medium text-white/70">家长喘息活动</p>
          <button className="w-full max-w-xs rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-4 text-left transition hover:bg-emerald-900/50">
            <span className="text-sm font-medium text-emerald-300">正念冥想引导</span>
            <span className="block text-xs text-white/40">15 分钟 · 纯语音，闭眼跟着 AI 做</span>
          </button>
          <button className="w-full max-w-xs rounded-xl border border-purple-700/40 bg-purple-900/30 p-4 text-left transition hover:bg-purple-900/50">
            <span className="text-sm font-medium text-purple-300">艺术手作</span>
            <span className="block text-xs text-white/40">30 分钟 · 跟着 AI 视频做手工</span>
          </button>
          <button className="w-full max-w-xs rounded-xl border border-blue-700/40 bg-blue-900/30 p-4 text-left transition hover:bg-blue-900/50">
            <span className="text-sm font-medium text-blue-300">匿名树洞</span>
            <span className="block text-xs text-white/40">不限 · 只看或自己打字发泄</span>
          </button>
        </div>

        {/* 底部状态 */}
        <div className="p-4 text-center">
          <p className="text-xs text-white/50">
            {baselineReady
              ? `基线 μ=${baselineRef.current.mean.toFixed(1)} σ=${baselineRef.current.std.toFixed(1)} · 样本 ${baselineRef.current.size}`
              : status}
          </p>
        </div>
      </div>

      {/* ── 右半：星宝端 ── */}
      <div className="relative h-full w-1/2">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="absolute left-4 top-4 rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm">
          <p className="text-xs font-medium text-white/80">星宝看护</p>
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-lg bg-black/40 px-4 py-2 backdrop-blur-sm">
          <div className="space-y-0.5">
            <p className="text-sm text-white/80">{status}</p>
            {baselineReady && (
              <p className="text-xs text-white/50">{LEVEL_LABELS[level]} · 指数 {index}</p>
            )}
          </div>
          <p className="text-[10px] text-white/40">视频仅本地处理 · 不上传</p>
        </div>
      </div>
    </div>
  )
}
