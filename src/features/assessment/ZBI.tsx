/**
 * ZBI 量表（Zarit Burden Interview）12 题简化版
 * 每题 0-4 分（从不/偶尔/有时/经常/总是）
 * 总分 0-48，分级：
 *   0-10 轻度
 *   11-20 中度
 *   21-35 重度
 *   36-48 极重度
 *
 * 历史得分记录在 localStorage 'starrest_zbi_history'
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Score = 0 | 1 | 2 | 3 | 4

interface ZbiRecord {
  timestamp: number
  total: number
  answers: Score[]
}

const KEY = 'starrest_zbi_history'

const QUESTIONS: string[] = [
  '您觉得照顾孩子给您带来了经济困难吗？',
  '您觉得因为照顾孩子，自己的时间不够用吗？',
  '您觉得因为照顾孩子，感到筋疲力尽吗？',
  '您觉得因为照顾孩子，个人生活受到了影响吗？',
  '您觉得因为照顾孩子，和家人的关系紧张了吗？',
  '您觉得因为照顾孩子，社交活动减少了吗？',
  '您觉得自己无法照顾孩子更长时间了吗？',
  '您觉得因为照顾孩子，健康受到了影响吗？',
  '您觉得自己没有能力照顾好孩子吗？',
  '您觉得因为照顾孩子，失去了对生活的控制感吗？',
  '您觉得因为照顾孩子，隐私受到了影响吗？',
  '您觉得自己应该为孩子做更多吗？',
]

const OPTIONS: { value: Score; label: string }[] = [
  { value: 0, label: '从不' },
  { value: 1, label: '偶尔' },
  { value: 2, label: '有时' },
  { value: 3, label: '经常' },
  { value: 4, label: '总是' },
]

function readHistory(): ZbiRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? (JSON.parse(raw) as ZbiRecord[]) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeHistory(records: ZbiRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records))
  } catch {
    /* 静默 */
  }
}

function getLevel(total: number): { label: string; color: string; advice: string } {
  if (total <= 10) {
    return {
      label: '轻度负担',
      color: '#22c55e',
      advice: '继续保持自我照顾，必要时寻求亲友支持。',
    }
  }
  if (total <= 20) {
    return {
      label: '中度负担',
      color: '#eab308',
      advice: '建议增加喘息时间，尝试正念冥想等放松活动。',
    }
  }
  if (total <= 35) {
    return {
      label: '重度负担',
      color: '#f97316',
      advice: '建议寻求专业心理支持，联系社区或专业机构。',
    }
  }
  return {
    label: '极重度负担',
    color: '#ef4444',
    advice: '请尽快寻求专业帮助，您不必独自承担。',
  }
}

export function ZBI() {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Score[]>(() => QUESTIONS.map(() => 0))
  const [submitted, setSubmitted] = useState<ZbiRecord | null>(null)
  const [history, setHistory] = useState<ZbiRecord[]>(() => readHistory())

  // 同步其他标签页的更新
  useEffect(() => {
    function handler(e: StorageEvent) {
      if (e.key === KEY) setHistory(readHistory())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const total = useMemo(() => answers.reduce<number>((a, b) => a + b, 0), [answers])

  function handleSelect(qi: number, score: Score) {
    setAnswers((prev) => {
      const next = [...prev]
      next[qi] = score
      return next
    })
  }

  function handleSubmit() {
    const record: ZbiRecord = {
      timestamp: Date.now(),
      total,
      answers,
    }
    const next = [...readHistory(), record].slice(-20) // 保留最近 20 次
    writeHistory(next)
    setHistory(next)
    setSubmitted(record)
  }

  function handleReset() {
    setAnswers(QUESTIONS.map(() => 0))
    setSubmitted(null)
  }

  const level = submitted ? getLevel(submitted.total) : getLevel(total)

  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-slate-800 p-4">
        <button onClick={() => navigate('/settings')} className="text-white/60 hover:text-white">
          ← 返回
        </button>
        <h1 className="text-lg font-medium">压力评估 · ZBI 量表</h1>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-white/70">
          <p>
            Zarit Burden Interview（ZBI）是经典的家庭照顾者负担量表，以下为 12 题简化版。请根据<strong className="text-white">最近一周</strong>的真实感受作答。
          </p>
        </div>

        {/* 题目 */}
        <ol className="space-y-4">
          {QUESTIONS.map((q, qi) => (
            <li
              key={qi}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <p className="mb-3 text-sm font-medium text-white/90">
                <span className="mr-2 text-emerald-400">{qi + 1}.</span>
                {q}
              </p>
              <div className="grid grid-cols-5 gap-1">
                {OPTIONS.map((opt) => {
                  const selected = answers[qi] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(qi, opt.value)}
                      className={`rounded-lg py-2 text-xs transition ${
                        selected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-white/60 hover:bg-slate-700'
                      }`}
                    >
                      <span className="block">{opt.label}</span>
                      <span className="block text-[10px] opacity-60">{opt.value}分</span>
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ol>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={submitted !== null}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitted ? '已提交' : '提交评估'}
        </button>

        {/* 结果 */}
        {submitted && (
          <div
            className="rounded-2xl border-2 p-4"
            style={{ borderColor: level.color }}
          >
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-white/50">本次总分</p>
                <p className="text-3xl font-bold" style={{ color: level.color }}>
                  {submitted.total}
                  <span className="ml-1 text-sm text-white/40">/ 48</span>
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-sm font-medium"
                style={{ backgroundColor: `${level.color}22`, color: level.color }}
              >
                {level.label}
              </span>
            </div>
            <p className="mt-3 text-sm text-white/70">{level.advice}</p>
            <button
              onClick={handleReset}
              className="mt-4 w-full rounded-xl bg-slate-800 py-2 text-sm text-white/80 hover:bg-slate-700"
            >
              重新评估
            </button>
          </div>
        )}

        {/* 历史对比 */}
        {history.length > 1 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-3 text-sm font-medium text-white/80">历史趋势</h2>
            <HistoryChart records={history} />
          </div>
        )}
      </div>
    </div>
  )
}

/** 历史得分折线图（SVG） */
function HistoryChart({ records }: { records: ZbiRecord[] }) {
  const w = 320
  const h = 120
  const padL = 20
  const padR = 8
  const padT = 8
  const padB = 18
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const n = records.length
  if (n < 2) return null
  const xs = records.map((_, i) =>
    padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
  )
  const ys = records.map((r) => padT + innerH - (r.total / 48) * innerH)
  const path = records
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {/* 网格 */}
      {[0, 12, 24, 36, 48].map((g) => {
        const y = padT + innerH - (g / 48) * innerH
        return (
          <g key={g}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" />
            <text x={2} y={y + 3} fontSize="8" fill="#64748b">
              {g}
            </text>
          </g>
        )
      })}
      <path d={path} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
      {records.map((r, i) => (
        <circle
          key={i}
          cx={xs[i]}
          cy={ys[i]}
          r="2"
          fill={getLevel(r.total).color}
        />
      ))}
    </svg>
  )
}
