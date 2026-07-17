import { useEffect, useRef, useState } from 'react'
import { useCameraStream } from './useCameraStream'
import { AudioAnalyzer, type AudioFeatures } from '../../infrastructure/ml/audioAnalyzer'
import { detectPosesMulti, type NormalizedPoint } from '../../infrastructure/ml/moveNetDetector'
import { pushKeypoints, classifyBehavior } from '../../infrastructure/ml/behaviorClassifier'
import { computeDisplacement, displacementToIndex, computeMultimodalIndex } from './activityIndex'
import { BaselineEngine } from './baselineEngine'
import { classifyAlert, LEVEL_LABELS, type AlertLevel } from './alertClassifier'
import { useCareSender } from '../../shared/useCareChannel'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Link2 } from 'lucide-react'
import { acquireWakeLock, releaseWakeLock, isWakeLockSupported } from '../../shared/wakeLock'

const ROOM_CODE_KEY = 'starrest_room_code'

// 自适应帧率区间（毫秒）
// 活跃指数 < 20 → 500ms（2fps）
// 活跃指数 20-60 → 200ms（5fps）
// 活跃指数 > 60 → 125ms（8fps）
function intervalForIndex(idx: number): number {
  if (idx < 20) return 500
  if (idx > 60) return 125
  return 200
}

// 音频特征空值（用于 fallback）
const EMPTY_AUDIO: AudioFeatures = {
  audioScore: 0,
  isSilent: true,
  energy: 0,
  frequencyBands: { low: 0, mid: 0, high: 0 },
  audioType: 'silent',
}

/** 计算一组关键点的包围盒面积（归一化坐标，0-1） */
function boundingBoxArea(keypoints: NormalizedPoint[]): number {
  if (keypoints.length === 0) return 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const kp of keypoints) {
    if (kp.x < minX) minX = kp.x
    if (kp.x > maxX) maxX = kp.x
    if (kp.y < minY) minY = kp.y
    if (kp.y > maxY) maxY = kp.y
  }
  return (maxX - minX) * (maxY - minY)
}

/**
 * 从多人关键点中选择"主要人物"。
 * 策略：取包围盒面积最大者（最靠近镜头/占画面比例最大的人）。
 */
function pickPrimaryPerson(poses: NormalizedPoint[][]): NormalizedPoint[] | null {
  if (poses.length === 0) return null
  if (poses.length === 1) return poses[0]
  let bestIdx = 0
  let bestArea = -1
  for (let i = 0; i < poses.length; i++) {
    const area = boundingBoxArea(poses[i])
    if (area > bestArea) {
      bestArea = area
      bestIdx = i
    }
  }
  return poses[bestIdx]
}

export function ChildPage() {
  const { videoRef, stream, error, ready } = useCameraStream()
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem(ROOM_CODE_KEY) || '')
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const send = useCareSender(roomCode || undefined)
  const [index, setIndex] = useState(0)
  const [level, setLevel] = useState<AlertLevel>('calm')
  const [baselineReady, setBaselineReady] = useState(false)
  const [status, setStatus] = useState('正在初始化…')
  const [audioScore, setAudioScore] = useState(0)
  const [personCount, setPersonCount] = useState(0)

  const prevLandmarksRef = useRef<NormalizedPoint[] | null>(null)
  const baselineRef = useRef(new BaselineEngine(60))
  const lastDetectRef = useRef(0)
  const lastSendRef = useRef(0)
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const indexRef = useRef(0)
  const levelRef = useRef<AlertLevel>('calm')
  const audioScoreRef = useRef(0)
  const baselineReadyRef = useRef(false)
  const behaviorRef = useRef('行为正常')
  // 自适应帧率：当前检测/发送间隔（ms），通过 ref 动态调整 setInterval 触发频率
  const adaptiveIntervalRef = useRef(200)

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
      // 用 50ms 轮询 + adaptiveIntervalRef 阈值实现可变间隔的 setInterval
      loopInterval = window.setInterval(() => {
        if (cancelled) return
        const now = performance.now()
        const interval = adaptiveIntervalRef.current
        if (now - lastDetectRef.current > interval) {
          lastDetectRef.current = now
          void detect()
        }
        if (now - lastSendRef.current > interval) {
          lastSendRef.current = now
          sendFrame()
        }
      }, 50)
      setStatus('加载MoveNet模型...')
      try {
        const video = videoRef.current
        // 预热多人检测器（与 detect 循环使用同一个 detector）
        if (video) {
          await detectPosesMulti(video)
          setStatus('看护中 · 传输中')
        }
      } catch (e) {
        setStatus('模型失败: ' + (e instanceof Error ? e.message : String(e)).slice(0, 60))
      }
    }

    async function detect() {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        // 多人检测：返回所有人关键点，由 pickPrimaryPerson 选择主要人物做行为分析
        const allPoses = await detectPosesMulti(video)
        const af = audioAnalyzerRef.current?.getFeatures() ?? EMPTY_AUDIO
        audioScoreRef.current = af.audioScore
        setAudioScore(af.audioScore)

        let keypoints: NormalizedPoint[] | null = null
        const count = allPoses?.length ?? 0
        setPersonCount(count)
        if (allPoses && allPoses.length > 0) {
          keypoints = pickPrimaryPerson(allPoses)
        }

        let idx: number
        if (keypoints && keypoints.length > 0) {
          pushKeypoints(keypoints)
          const beh = classifyBehavior()
          behaviorRef.current = beh.message
          const prev = prevLandmarksRef.current
          if (prev) {
            const vi = displacementToIndex(computeDisplacement(keypoints, prev))
            idx = computeMultimodalIndex(vi, af.audioScore, af.isSilent)
            if (beh.type !== 'normal' && beh.type !== 'stillness') idx = Math.min(idx + 20, 100)
          } else {
            idx = af.audioScore
          }
          prevLandmarksRef.current = keypoints
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
        // 根据活跃指数动态调整下一帧的检测/发送间隔
        adaptiveIntervalRef.current = intervalForIndex(idx)
      } catch {
        // 单帧检测失败不影响后续循环
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
        behavior: behaviorRef.current,
      })
    }

    void init()
    return () => {
      cancelled = true
      if (loopInterval) clearInterval(loopInterval)
      analyzer.stop()
    }
  }, [ready, stream, send])

  // 屏幕常亮（星宝端长时间运行不被杀）
  useEffect(() => {
    if (!isWakeLockSupported()) return
    void acquireWakeLock()
    return () => { void releaseWakeLock() }
  }, [])

  function handleJoinRoom() {
    const code = roomCodeInput.trim()
    if (!/^\d{4}$/.test(code)) return
    setRoomCode(code)
    localStorage.setItem(ROOM_CODE_KEY, code)
    setRoomCodeInput('')
  }

  function handleClearRoom() {
    setRoomCode('')
    localStorage.removeItem(ROOM_CODE_KEY)
  }

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
        <button onClick={() => navigate('/role')} aria-label="返回" className="rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm">
          <ArrowLeft className="h-4 w-4 text-white/80" />
        </button>
        <div className="rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm" aria-live="polite">
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
        <div className="flex items-center gap-2">
          {personCount > 1 && (
            <p className="text-[10px] font-medium text-yellow-300/90">检测到 {personCount} 人</p>
          )}
          <p className="text-[10px] text-white/40">{roomCode ? `房间 ${roomCode}` : '本地模式'} · 传输中</p>
        </div>
      </div>

      {/* 房间码配对 */}
      {!roomCode && (
        <div className="absolute right-4 top-16 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm">
          <Link2 className="h-3 w-3 text-emerald-400" />
          <input
            type="text"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="输入家长端房间码"
            className="w-28 rounded bg-slate-800 px-2 py-1 text-xs text-white outline-none ring-1 ring-slate-700 focus:ring-emerald-500"
          />
          <button onClick={handleJoinRoom} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500">配对</button>
        </div>
      )}
      {roomCode && (
        <button
          onClick={handleClearRoom}
          className="absolute right-4 top-16 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm hover:text-white"
        >
          房间 {roomCode} · 点击断开
        </button>
      )}
    </div>
  )
}
