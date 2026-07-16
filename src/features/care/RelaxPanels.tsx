import { useState, useEffect, useRef } from 'react'

/** 冥想面板：4-7-8 呼吸法引导 */
export function MeditationPanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale')
  const timerRef = useRef(0)

  useEffect(() => {
    const phases = [
      { name: 'inhale' as const, d: 4 },
      { name: 'hold' as const, d: 7 },
      { name: 'exhale' as const, d: 8 },
    ]
    let i = 0
    function tick() {
      setPhase(phases[i % 3].name)
      timerRef.current = window.setTimeout(() => { i++; tick() }, phases[i % 3].d * 1000)
    }
    tick()
    return () => clearTimeout(timerRef)
  }, [])

  const label = phase === 'inhale' ? '吸气' : phase === 'hold' ? '屏息' : '呼气'
  const scale = phase === 'inhale' ? 1.4 : phase === 'exhale' ? 0.7 : 1.0

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <p className="text-sm text-white/60">正念冥想 · 4-7-8 呼吸法</p>
      <div className="relative flex h-40 w-40 items-center justify-center">
        <div
          className="h-24 w-24 rounded-full bg-emerald-500/30 transition-transform ease-in-out"
          style={{ transform: `scale(${scale})`, transitionDuration: '4000ms' }}
        />
        <span className="absolute text-lg font-medium text-white">{label}</span>
      </div>
      <p className="text-xs text-white/40">吸气 4 秒 → 屏息 7 秒 → 呼气 8 秒</p>
      <button onClick={onClose} className="text-sm text-white/50 hover:text-white">← 返回</button>
    </div>
  )
}

/** 树洞面板：匿名倾诉，仅本地存储 */
export function TreeHolePanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [posts, setPosts] = useState<{ id: string; text: string; time: number }[]>(() => {
    try { return JSON.parse(localStorage.getItem('starrest_treehole') || '[]') } catch { return [] }
  })

  function handleSubmit() {
    if (!text.trim()) return
    const post = { id: crypto.randomUUID(), text: text.trim(), time: Date.now() }
    const next = [post, ...posts].slice(0, 50)
    setPosts(next)
    localStorage.setItem('starrest_treehole', JSON.stringify(next))
    setText('')
  }

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">匿名树洞</p>
        <button onClick={onClose} className="text-sm text-white/50 hover:text-white">← 返回</button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="不说话也可以，打字发泄一下..."
        className="h-20 w-full resize-none rounded-xl bg-slate-800 p-3 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-emerald-500"
      />
      <button onClick={handleSubmit} className="self-end rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500">
        发送
      </button>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto">
        {posts.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/30">还没有人倾诉，你可以是第一个</p>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="rounded-lg bg-slate-800/50 p-3">
              <p className="text-sm text-white/70">{p.text}</p>
              <p className="mt-1 text-xs text-white/30">{new Date(p.time).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
      <p className="text-center text-xs text-white/30">完全匿名 · 仅存储在本地</p>
    </div>
  )
}

/** 手作面板：即将上线占位 */
export function CraftPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <div className="text-5xl">🎨</div>
      <p className="text-sm text-white/60">艺术手作</p>
      <p className="text-center text-xs leading-relaxed text-white/40">
        即将上线<br />材料包按月寄到家<br />跟着 AI 视频做手工
      </p>
      <button onClick={onClose} className="text-sm text-white/50 hover:text-white">← 返回</button>
    </div>
  )
}
