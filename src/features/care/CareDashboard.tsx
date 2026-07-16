import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCameraStream } from './useCameraStream'
import { getPoseDetector } from '../../infrastructure/ml/poseDetector'
import { AudioAnalyzer } from '../../infrastructure/ml/audioAnalyzer'
import { computeDisplacement, displacementToIndex, computeMultimodalIndex } from './activityIndex'
import { BaselineEngine } from './baselineEngine'
import { classifyAlert, LEVEL_LABELS, type AlertLevel } from './alertClassifier'
import { FloatBall } from './FloatBall'
import { PrivacyScreen } from './PrivacyScreen'
import { MeditationPanel, TreeHolePanel, CraftPanel } from './RelaxPanels'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { getSettings } from '../settings/settingsStore'

type RelaxMode = 'none' | 'meditation' | 'craft' | 'treehole'

export function CareDashboard() {
  const { videoRef, stream, error, ready } = useCameraStream()
  const navigate = useNavigate()
  const settings = getSettings()
  const [index, setIndex] = useState(0)
  const [level, setLevel] = useState<AlertLevel>('calm')
  const [baselineReady, setBaselineReady] = useState(false)
  const [status, setStatus] = useState('正在初始化…')
  const [audioScore, setAudioScore] = useState(0)
  const [activeRelax, setActiveRelax] = useState<RelaxMode>('none')
  const [showPrivacy, setShowPrivacy] = useState(
    () => !localStorage.getItem('starrest_privacy_confirmed'),
  )

  const prevLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const baselineRef = useRef(new BaselineEngine(60))
  const rafRef = useRef(0)
  const lastDetectRef = useRef(0)
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null)

  useEffect(() => {
    if (!ready || !stream || showPrivacy) return
    let cancelled = false

    const analyzer = new AudioAnalyzer()
    const audioOk = analyzer.start(stream)
    audioAnalyzerRef.current = analyzer

    void baselineRef.current.initWithHistory().then(() => {
      if (baselineRef.current.ready) setBaselineReady(true)
    })

    async function init() {
      try {
        setStatus('加载 AI 模型…')
        await getPoseDetector()
        setStatus(audioOk ? '看护中（视频+音频）' : '看护中（仅视频）')
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
        const af = audioAnalyzerRef.current?.getFeatures() ?? { audioScore: 0, isSilent: true }
        setAudioScore(af.audioScore)

        let idx: number
        if (result.landmarks && result.landmarks.length > 0) {
          const curr = result.landmarks[0]
          const prev = prevLandmarksRef.current
          if (prev) {
            const vi = displacementToIndex(computeDisplacement(curr, prev))
            idx = computeMultimodalIndex(vi, af.audioScore, af.isSilent)
          } else {
            idx = af.audioScore
          }
          prevLandmarksRef.current = curr
        } else {
          idx = af.audioScore
        }

        const bl = baselineRef.current
        bl.push(idx)
        setIndex(idx)
        if (bl.ready) {
          setBaselineReady(true)
          setLevel(classifyAlert(bl.zScore, idx, settings.alertSensitivity).level)
        }
      } catch {
        // 推理失败静默跳过
      }
    }

    void init()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      analyzer.stop()
    }
  }, [ready, stream, showPrivacy])

  function handlePrivacyConfirm() {
    localStorage.setItem('starrest_privacy_confirmed', '1')
    setShowPrivacy(false)
  }

  if (showPrivacy) return <PrivacyScreen onConfirm={handlePrivacyConfirm} />

  if (error) {
    return (
      <div className="flex h-full w-full overflow-hidden bg-slate-950">
        <div className="flex w-1/2 flex-col items-center justify-center gap-3 border-r border-slate-800 p-8 text-center">
          <FloatBall index={0} level="calm" baselineReady={false} pushEnabled={settings.pushEnabled} />
          <p className="text-lg font-semibold text-red-400">摄像头无法启动</p>
          <p className="text-sm text-slate-400">{error}</p>
          <p className="text-xs text-slate-500">请允许摄像头和麦克风权限。数据仅本地处理。</p>
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
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-sm font-medium text-white/70">星憩时刻</span>
          <button onClick={() => navigate('/settings')} className="text-white/40 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-center pt-4 pb-2">
          <FloatBall index={index} level={level} baselineReady={baselineReady} pushEnabled={settings.pushEnabled} />
        </div>
        <p className="pb-2 text-center text-xs text-white/50">孩子状态 · 活跃指数</p>

        {activeRelax === 'none' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
            <p className="mb-2 text-sm font-medium text-white/70">家长喘息活动</p>
            <button onClick={() => setActiveRelax('meditation')} className="w-full max-w-xs rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-4 text-left transition hover:bg-emerald-900/50">
              <span className="text-sm font-medium text-emerald-300">正念冥想引导</span>
              <span className="block text-xs text-white/40">4-7-8 呼吸法 · 跟随节奏</span>
            </button>
            <button onClick={() => setActiveRelax('craft')} className="w-full max-w-xs rounded-xl border border-purple-700/40 bg-purple-900/30 p-4 text-left transition hover:bg-purple-900/50">
              <span className="text-sm font-medium text-purple-300">艺术手作</span>
              <span className="block text-xs text-white/40">即将上线</span>
            </button>
            <button onClick={() => setActiveRelax('treehole')} className="w-full max-w-xs rounded-xl border border-blue-700/40 bg-blue-900/30 p-4 text-left transition hover:bg-blue-900/50">
              <span className="text-sm font-medium text-blue-300">匿名树洞</span>
              <span className="block text-xs text-white/40">打字发泄 · 完全匿名</span>
            </button>
          </div>
        ) : activeRelax === 'meditation' ? (
          <MeditationPanel onClose={() => setActiveRelax('none')} />
        ) : activeRelax === 'craft' ? (
          <CraftPanel onClose={() => setActiveRelax('none')} />
        ) : (
          <TreeHolePanel onClose={() => setActiveRelax('none')} />
        )}

        <div className="p-4 text-center">
          <p className="text-xs text-white/50">
            {baselineReady
              ? `μ=${baselineRef.current.mean.toFixed(1)} σ=${baselineRef.current.std.toFixed(1)} · 综合${index} 音频${audioScore}`
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
              <p className="text-xs text-white/50">{LEVEL_LABELS[level]} · 综合{index} · 音频{audioScore}</p>
            )}
          </div>
          <p className="text-[10px] text-white/40">视频+音频仅本地处理</p>
        </div>
      </div>
    </div>
  )
}
