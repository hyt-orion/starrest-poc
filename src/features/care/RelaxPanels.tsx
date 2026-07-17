import { useState, useEffect, useRef } from 'react'
import { Heart } from 'lucide-react'
import { apiGetTreehole, apiPostTreehole } from '../../shared/apiClient'
import { speak, stopSpeak, isTTSAvailable } from '../../shared/tts'
import { logRelaxDuration } from '../rewards/rewardsStore'

// ===== 冥想面板 =====

/** 冥想面板：4-7-8 呼吸法引导 + TTS 语音 + 时长选择 */
export function MeditationPanel({ onClose }: { onClose: () => void }) {
  const [duration, setDuration] = useState<3 | 5 | 10>(3)
  const [voiceOn, setVoiceOn] = useState<boolean>(isTTSAvailable())
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale')
  const [elapsed, setElapsed] = useState(0)

  const ttsAvailable = isTTSAvailable()
  const voiceRef = useRef(voiceOn)
  const closedRef = useRef(false)
  const phaseTimerRef = useRef<number>(0)
  const startRef = useRef<number>(Date.now())
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { voiceRef.current = voiceOn; if (!voiceOn) stopSpeak() }, [voiceOn])

  // 呼吸节奏循环 + TTS 语音引导
  useEffect(() => {
    const phases = [
      { name: 'inhale' as const, d: 4, label: '吸气' },
      { name: 'hold' as const, d: 7, label: '屏住' },
      { name: 'exhale' as const, d: 8, label: '呼气' },
    ]
    let i = 0
    let cancelled = false
    function tick() {
      if (cancelled) return
      const cur = phases[i % 3]
      setPhase(cur.name)
      if (voiceRef.current) void speak(cur.label)
      phaseTimerRef.current = window.setTimeout(() => { i++; tick() }, cur.d * 1000)
    }
    async function start() {
      if (voiceRef.current) {
        // 开场白；最多等 4 秒就开始节奏，避免某些浏览器不触发 onend
        await Promise.race([
          speak('让我们开始深呼吸练习，跟随节奏放松'),
          new Promise<void>((r) => setTimeout(r, 4000)),
        ])
      }
      if (!cancelled) tick()
    }
    void start()
    return () => {
      cancelled = true
      clearTimeout(phaseTimerRef.current)
      stopSpeak()
    }
  }, [])

  // 总计时与达到时长自动结束
  useEffect(() => {
    const id = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      setElapsed(secs)
      if (secs >= duration * 60 && !closedRef.current) {
        closedRef.current = true
        stopSpeak()
        logRelaxDuration('meditation', secs)
        onCloseRef.current()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [duration])

  function handleClose() {
    if (closedRef.current) return
    closedRef.current = true
    stopSpeak()
    const secs = Math.floor((Date.now() - startRef.current) / 1000)
    logRelaxDuration('meditation', secs)
    onClose()
  }

  const label = phase === 'inhale' ? '吸气' : phase === 'hold' ? '屏息' : '呼气'
  const scale = phase === 'inhale' ? 1.4 : phase === 'exhale' ? 0.7 : 1.0
  const elapsedMin = Math.floor(elapsed / 60)
  const elapsedSec = elapsed % 60
  const totalMin = duration

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <div className="flex w-full items-center justify-between">
        <p className="text-sm text-white/60">正念冥想 · 4-7-8 呼吸法</p>
        <button
          onClick={() => setVoiceOn((v) => !v)}
          disabled={!ttsAvailable}
          className={`rounded-lg px-3 py-1 text-xs transition ${
            voiceOn
              ? 'bg-emerald-600/40 text-emerald-200 ring-1 ring-emerald-500/50'
              : 'bg-slate-800 text-white/50 ring-1 ring-slate-700'
          } ${!ttsAvailable ? 'opacity-40 cursor-not-allowed' : 'hover:bg-emerald-600/60'}`}
          title={ttsAvailable ? '开启/关闭语音引导' : '当前浏览器不支持语音'}
        >
          {voiceOn ? '🔊 语音开' : '🔇 语音关'}
        </button>
      </div>

      {/* 时长选择 */}
      <div className="flex gap-2">
        {[3, 5, 10].map((m) => (
          <button
            key={m}
            onClick={() => setDuration(m as 3 | 5 | 10)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              duration === m
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-white/50 hover:bg-slate-700'
            }`}
          >
            {m} 分钟
          </button>
        ))}
      </div>

      <div className="relative flex h-40 w-40 items-center justify-center">
        <div
          className="h-24 w-24 rounded-full bg-emerald-500/30 transition-transform ease-in-out"
          style={{ transform: `scale(${scale})`, transitionDuration: '4000ms' }}
        />
        <span className="absolute text-lg font-medium text-white">{label}</span>
      </div>

      <p className="text-xs text-white/40">吸气 4 秒 → 屏息 7 秒 → 呼气 8 秒</p>

      {/* 计时显示 */}
      <p className="text-xs text-white/50">
        已进行 {elapsedMin} 分 {elapsedSec} 秒 / 共 {totalMin} 分钟
      </p>

      <button onClick={handleClose} className="text-sm text-white/50 hover:text-white">← 返回</button>
    </div>
  )
}

// ===== 树洞面板 =====

interface TreeholePost {
  id: string
  text: string
  time: number
}

const NEGATIVE_KEYWORDS = ['累', '崩溃', '不想', '放弃', '绝望', '撑不住', '撑不下去', '想哭', '难过', '焦虑', '抑郁', '没意义', '想死', '痛苦', '烦']
const WARM_TIPS = [
  '你已经很努力了，允许自己休息一下',
  '难受的时候深呼吸，世界一直在你身边',
  '你的感受是被允许的，不必独自承受',
  '如果太累可以寻求帮助，你不是一个人',
  '今晚把烦恼交给树洞，先好好睡一觉',
]

/** 检测负面情绪，返回温暖提示（基于文本哈希，保持稳定） */
function detectNegative(text: string): string | null {
  if (!NEGATIVE_KEYWORDS.some((k) => text.includes(k))) return null
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return WARM_TIPS[Math.abs(h) % WARM_TIPS.length]
}

/** 树洞面板：后端 API 存取 + 本地降级 + 情感分析 + 拥抱 */
export function TreeHolePanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [posts, setPosts] = useState<TreeholePost[]>([])
  const [loading, setLoading] = useState(true)
  const [usingBackend, setUsingBackend] = useState(true)
  const [hugs, setHugs] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('starrest_treehole_hugs') || '{}') } catch { return {} }
  })
  const [submitting, setSubmitting] = useState(false)

  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const loggedRef = useRef(false)
  function handleClose() {
    if (loggedRef.current) return
    loggedRef.current = true
    const secs = Math.floor((Date.now() - startRef.current) / 1000)
    logRelaxDuration('treehole', secs)
    onCloseRef.current()
  }

  // 加载帖子
  async function loadPosts() {
    setLoading(true)
    const res = await apiGetTreehole()
    if (res.data) {
      setPosts(res.data.slice(0, 50))
      setUsingBackend(true)
    } else {
      // 后端不可达，降级到 localStorage
      try {
        const local: TreeholePost[] = JSON.parse(localStorage.getItem('starrest_treehole') || '[]')
        setPosts(local)
      } catch { setPosts([]) }
      setUsingBackend(false)
    }
    setLoading(false)
  }

  useEffect(() => { void loadPosts() }, [])

  async function handleSubmit() {
    const content = text.trim()
    if (!content || submitting) return
    setSubmitting(true)
    setText('')
    if (usingBackend) {
      const res = await apiPostTreehole(content)
      if (!res.error) {
        await loadPosts()
        setSubmitting(false)
        return
      }
      // 后端失败 → 降级
      setUsingBackend(false)
    }
    // 本地存储
    const post: TreeholePost = { id: crypto.randomUUID(), text: content, time: Date.now() }
    setPosts((prev) => [post, ...prev].slice(0, 50))
    try {
      const local: TreeholePost[] = JSON.parse(localStorage.getItem('starrest_treehole') || '[]')
      localStorage.setItem('starrest_treehole', JSON.stringify([post, ...local].slice(0, 50)))
    } catch { /* noop */ }
    setSubmitting(false)
  }

  function hug(id: string) {
    setHugs((prev) => {
      const next = { ...prev, [id]: (prev[id] || 0) + 1 }
      localStorage.setItem('starrest_treehole_hugs', JSON.stringify(next))
      return next
    })
  }

  const elapsedMin = Math.floor(elapsed / 60)

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">匿名树洞 {!usingBackend && <span className="text-amber-400/60">· 离线模式</span>}</p>
        <button onClick={handleClose} className="text-sm text-white/50 hover:text-white">← 返回</button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="不说话也可以，打字发泄一下..."
        className="h-20 w-full resize-none rounded-xl bg-slate-800 p-3 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-emerald-500"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || !text.trim()}
        className="self-end rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        {submitting ? '发送中…' : '发送'}
      </button>

      <p className="text-center text-xs text-white/40">已停留 {elapsedMin} 分钟</p>

      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto">
        {loading ? (
          <p className="py-4 text-center text-xs text-white/30">加载中…</p>
        ) : posts.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/30">还没有人倾诉，你可以是第一个</p>
        ) : (
          posts.map((p) => {
            const tip = detectNegative(p.text)
            return (
              <div key={p.id} className="rounded-lg bg-slate-800/50 p-3">
                <p className="text-sm text-white/70">{p.text}</p>
                <p className="mt-1 text-xs text-white/30">{new Date(p.time).toLocaleString()}</p>
                {tip && (
                  <p className="mt-2 rounded-md bg-pink-900/30 px-2 py-1 text-xs text-pink-200/80">
                    🤍 {tip}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={() => hug(p.id)}
                    className="flex items-center gap-1 rounded-full bg-pink-900/30 px-2 py-0.5 text-xs text-pink-200 transition hover:bg-pink-800/50"
                  >
                    <Heart className="h-3 w-3" />
                    拥抱 {hugs[p.id] || 0}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
      <p className="text-center text-xs text-white/30">完全匿名 · {usingBackend ? '共享给其他家长' : '仅存储在本地'}</p>
    </div>
  )
}

// ===== 手作面板 =====

interface CraftStep {
  title: string
  desc: string
  /** 建议用时（秒） */
  duration: number
}

interface CraftTutorial {
  id: string
  name: string
  emoji: string
  materials: string[]
  steps: CraftStep[]
}

const TUTORIALS: CraftTutorial[] = [
  {
    id: 'origami-star',
    name: '折纸星星',
    emoji: '⭐',
    materials: ['彩色方纸 5 张（10cm×10cm）', '一双干净的手'],
    steps: [
      { title: '准备方纸', desc: '取一张彩色方纸，正面朝上平铺', duration: 30 },
      { title: '对折三角形', desc: '将方纸沿对角线对折成三角形，压平折痕', duration: 60 },
      { title: '翻折一角', desc: '把三角形右下角向上翻折到斜边中点', duration: 60 },
      { title: '再折另一角', desc: '把左下角同样翻折过来，形成一个小菱形', duration: 60 },
      { title: '整形收尾', desc: '把多出的角塞进口袋，整理成五角星形状', duration: 90 },
    ],
  },
  {
    id: 'paper-plate-painting',
    name: '纸盘画',
    emoji: '🎨',
    materials: ['白色纸盘 1 个', '水彩或丙烯颜料', '画笔 1 支', '调色盘', '一杯清水'],
    steps: [
      { title: '构思画面', desc: '在脑中想一个让你放松的场景，比如星空、海洋', duration: 60 },
      { title: '铺底色', desc: '用大笔刷在纸盘上铺一层底色，可以横向晕染', duration: 120 },
      { title: '画主体', desc: '等底色半干，画上你想画的主角元素', duration: 180 },
      { title: '点缀细节', desc: '用细笔点星星、波纹或小花，让画面更生动', duration: 120 },
      { title: '晾干欣赏', desc: '放置晾干，仔细看看你创造的放松瞬间', duration: 90 },
    ],
  },
  {
    id: 'clay-animal',
    name: '黏土小动物',
    emoji: '🐾',
    materials: ['超轻黏土 3 色', '小塑料刀 1 把', '一块干净垫板'],
    steps: [
      { title: '选动物', desc: '想一个你喜欢的简单小动物，比如小猫、小兔', duration: 30 },
      { title: '揉身体', desc: '取一块黏土搓成椭圆作为身体', duration: 90 },
      { title: '做头部', desc: '再搓一个圆球作头，轻轻粘到身体上', duration: 90 },
      { title: '加四肢耳朵', desc: '捏出四条小腿和耳朵，粘到对应位置', duration: 120 },
      { title: '画表情', desc: '用塑料刀尖端戳出眼睛和嘴巴，让它有表情', duration: 90 },
    ],
  },
]

/** 手作面板：3 个教程 + 分步骤引导 + 步骤计时器 */
export function CraftPanel({ onClose }: { onClose: () => void }) {
  const [tutorialId, setTutorialId] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [stepElapsed, setStepElapsed] = useState(0)
  const [stepRunning, setStepRunning] = useState(false)

  const startRef = useRef(Date.now())
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const loggedRef = useRef(false)

  // 总计时
  const [totalElapsed, setTotalElapsed] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      setTotalElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // 步骤计时器
  const stepTimerRef = useRef<number>(0)
  useEffect(() => {
    if (stepRunning) {
      stepTimerRef.current = window.setInterval(() => {
        setStepElapsed((s) => s + 1)
      }, 1000)
      return () => clearInterval(stepTimerRef.current)
    }
  }, [stepRunning])

  // 切换步骤时重置计时
  useEffect(() => {
    setStepElapsed(0)
    setStepRunning(false)
  }, [stepIdx, tutorialId])

  function reportAndClose() {
    if (loggedRef.current) return
    loggedRef.current = true
    const secs = Math.floor((Date.now() - startRef.current) / 1000)
    logRelaxDuration('craft', secs)
    onCloseRef.current()
  }

  function handleBack() {
    if (tutorialId === null) {
      // 在教程列表 → 关闭
      reportAndClose()
    } else {
      // 在步骤中 → 返回列表
      setTutorialId(null)
      setStepIdx(0)
    }
  }

  // 教程列表
  if (tutorialId === null) {
    const totalMin = Math.floor(totalElapsed / 60)
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/60">艺术手作 · 选一个开始</p>
          <button onClick={handleBack} className="text-sm text-white/50 hover:text-white">← 返回</button>
        </div>
        <div className="flex flex-col gap-2">
          {TUTORIALS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTutorialId(t.id); setStepIdx(0) }}
              className="flex items-center gap-3 rounded-xl border border-purple-700/40 bg-purple-900/20 p-4 text-left transition hover:bg-purple-900/40"
            >
              <span className="text-3xl">{t.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-200">{t.name}</p>
                <p className="text-xs text-white/40">{t.steps.length} 步 · 约 {Math.round(t.steps.reduce((a, s) => a + s.duration, 0) / 60)} 分钟</p>
              </div>
              <span className="text-xs text-white/30">›</span>
            </button>
          ))}
        </div>
        <p className="mt-auto text-center text-xs text-white/30">已进行 {totalMin} 分钟</p>
      </div>
    )
  }

  // 步骤详情
  const tutorial = TUTORIALS.find((t) => t.id === tutorialId)!
  const step = tutorial.steps[stepIdx]
  const isLast = stepIdx === tutorial.steps.length - 1
  const stepMin = Math.floor(stepElapsed / 60)
  const stepSec = stepElapsed % 60
  const suggestMin = Math.floor(step.duration / 60)
  const suggestSec = step.duration % 60

  function nextOrFinish() {
    if (isLast) {
      reportAndClose()
    } else {
      setStepIdx((i) => i + 1)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{tutorial.emoji} {tutorial.name} · 第 {stepIdx + 1} / {tutorial.steps.length} 步</p>
        <button onClick={handleBack} className="text-sm text-white/50 hover:text-white">← 返回</button>
      </div>

      {/* 材料清单（仅第一步显示） */}
      {stepIdx === 0 && (
        <div className="rounded-lg bg-slate-800/50 p-3">
          <p className="mb-1 text-xs text-white/50">材料清单</p>
          <ul className="space-y-0.5">
            {tutorial.materials.map((m, i) => (
              <li key={i} className="text-xs text-white/70">· {m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 当前步骤 */}
      <div className="rounded-xl border border-purple-700/40 bg-purple-900/20 p-4">
        <p className="text-sm font-medium text-purple-200">{step.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/60">{step.desc}</p>
      </div>

      {/* 步骤计时器 */}
      <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
        <div>
          <p className="text-xs text-white/40">步骤计时</p>
          <p className="text-sm text-white/80">
            {String(stepMin).padStart(2, '0')}:{String(stepSec).padStart(2, '0')}
            <span className="ml-2 text-xs text-white/40">/ 建议 {suggestMin}:{String(suggestSec).padStart(2, '0')}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStepRunning((r) => !r)}
            className={`rounded-lg px-3 py-1 text-xs ${
              stepRunning ? 'bg-amber-600/40 text-amber-200' : 'bg-emerald-600/40 text-emerald-200'
            }`}
          >
            {stepRunning ? '暂停' : '开始'}
          </button>
          <button
            onClick={() => { setStepElapsed(0); setStepRunning(false) }}
            className="rounded-lg bg-slate-700 px-3 py-1 text-xs text-white/60"
          >
            重置
          </button>
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <p className="text-center text-xs text-white/30">
          已进行 {Math.floor(totalElapsed / 60)} 分钟
        </p>
        <button
          onClick={nextOrFinish}
          className="w-full rounded-xl bg-purple-600 py-3 text-sm font-medium text-white transition hover:bg-purple-500"
        >
          {isLast ? '完成手作 ✓' : '下一步 →'}
        </button>
      </div>
    </div>
  )
}
