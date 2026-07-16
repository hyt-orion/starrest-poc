import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCameraStream } from './useCameraStream'
import { getPoseDetector } from '../../infrastructure/ml/poseDetector'
import { AudioAnalyzer } from '../../infrastructure/ml/audioAnalyzer'
import { computeDisplacement, displacementToIndex, computeMultimodalIndex } from './activityIndex'
import { BaselineEngine } from './baselineEngine'
import { classifyAlert, LEVEL_LABELS, type AlertLevel } from './alertClassifier'
import { useCareSender } from '../../shared/useCareChannel'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function ChildPage() {
  const { videoRef, stream, error, ready } = useCameraStream()
  const navigate = useNavigate()
  const send = useCareSender()
  const [index, setIndex] = useState(0)
  const [level, setLevel] = useState<AlertLevel>('calm')
  const [baselineReady, setBaselineReady] = useState(false)
  const [status, setStatus] = useState('正在初始化…')
  const [audioScore, setAudioScore] = useState(0)

  const prevLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const baselineRef = useRef(new BaselineEngine(60))
  const lastDetectRef = useRef(0)
  const lastSendRef = useRef(0)
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const indexRef = useRef(0)
  const levelRef = useRef<AlertLevel>('calm')
  const audioScoreRef = useRef(0)
  const baselineReadyRef = useRef(false)

  useEffect(() => {
    if (!ready || !stream) return
    let cancelled = false
    let loopInterval: number | undefined

    const analyzer = new AudioAnalyzer()
    analyzer.start(stream)
    audioAnalyzerRef.current = analyzer

    canvasRef.current = document.createElement('canvas')
    canvasRef.current.width = 320
    canvasRef.current.height = 240

    void baselineRef.current.initWithHistory().then(() => {
      if (baselineRef.current.ready) {
        baselineReadyRef.current = true
        setBaselineReady(true)
      }
    })

    async function init() {
      setStatus('加载 AI 模型…')
      try {
        await Promise.race([
          getPoseDetector(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('超时')), 10000)),
        ])
        setStatus('看护中 · 传输中')
      } catch {
        setStatus('模型未加载 · 仅传输视频')
      }
      // setInterval 代替 requestAnimationFrame（后台标签页不暂停，只限流到1fps）
      loopInterval = window.setInterval(() => {
        if (cancelled) return
        const now = performance.now()
        if (now - lastDetectRef.current > 200) {
          lastDetectRef.current = now
          void detect(now)
        }
        if (now - lastSendRef.current > 200) {
          lastSendRef.current = now
          sendFrame()
        }
      }, 100)
    }

    async function detect(now: number) {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const detector = await getPoseDetector()
        const result = detector.detectForVideo(video, now)
        const af = audioAnalyzerRef.current?.getFeatures() ?? { audioScore: 0, isSilent: true }
        audioScoreRef.current = af.audioScore
        setAudioScore(af.audioScore)

        let idx: number
        if (result.landmarks && result.landmarks.length > 0) {
          const curr = result.landmarks[0]
          const prev = prevLandmarksRef.current
          if (prev) {
            idx = computeMultimodalIndex(displacementToIndex(computeDisplacement(curr, prev)), af.audioScore, af.isSilent)
          } else {
            idx = af.audioScore
          }
          prevLandmarksRef.current = curr
        } else {
          idx = af.audioScore
        }

        const bl = baselineRef.current
        bl.push(idx)
        indexRef.current = idx
        setIndex(idx)
        if (bl.ready) {
          baselineReadyRef.current = true
          setBaselineReady(true)
          const lv = classifyAlert(bl.zScore, idx, 'normal').level
          levelRef.current = lv
          setLevel(lv)
        }
      } catch {
        // 推理失败不影响发送
      }
    }

    function sendFrame() {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.getContext('2d')?.drawImage(video, 0, 0, 320, 240)
      send({
        index: indexRef.current,
        level: levelRef.current,
        audioScore: audioScoreRef.current,
        frame: canvas.toDataURL('image/jpeg', 0.5),
        baselineReady: baselineReadyRef.current,
      })
    }

    void init()
    return () => {
      cancelled = true
      if (loopInterval) clearInterval(loopInterval)
      analyzer.stop()
    }
  }, [ready, stream, send])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 p-8 text-center">
        <p className="text-lg font-semibold text-red-400">摄像头无法启动</p>
        <p className="text-sm text-slate-400">{error}</p>
        <p className="text-xs text-slate-500">请允许摄像头和麦克风权限</p>
        <button onClick={() => navigate('/role')} className="mt-4 text-sm text-white/50">← 返回</button>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <button onClick={() => navigate('/role')} className="rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm">
          <ArrowLeft className="h-4 w-4 text-white/80" />
        </button>
        <div className="rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm">
          <p className="text-xs font-medium text-white/80">星宝端 · {status}</p>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-lg bg-black/40 px-4 py-2 backdrop-blur-sm">
        <div className="space-y-0.5">
          <p className="text-sm text-white/80">{status}</p>
          {baselineReady && (
            <p className="text-xs text-white/50">{LEVEL_LABELS[level]} · 指数 {index} · 音频 {audioScore}</p>
          )}
        </div>
        <p className="text-[10px] text-white/40">视频+数字传输中</p>
      </div>
    </div>
  )
}
