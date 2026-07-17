/**
 * 看护报告组件
 * - 今日 / 本周 两个视图
 * - 活跃指数趋势图（SVG 折线图）
 * - 行为分类统计（SVG 条形图）
 * - 喘息时长汇总
 *
 * 数据来源：
 * - 活跃指数历史：IndexedDB baselineStore（getRecentIndices）
 * - 行为事件：localStorage starrest_event_log（EventLog.tsx）
 * - 喘息时长：localStorage starrest_relax_duration / starrest_rewards
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRecentIndices } from '../../infrastructure/ml/baselineStore'
import { getEvents, type CareEvent } from './EventLog'
import {
  getRelaxHistory,
  getRewards,
  getWeeklyRelaxMinutes,
} from '../rewards/rewardsStore'

type View = 'today' | 'week'

interface IndexPoint {
  timestamp: number
  value: number
}

export function CareReport() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('today')
  const [indices, setIndices] = useState<IndexPoint[]>([])
  const [events, setEvents] = useState<CareEvent[]>([])
  const [rewards, setRewards] = useState(getRewards())
  const [weeklyMinutes, setWeeklyMinutes] = useState(0)
  const [relaxHistory, setRelaxHistory] = useState<{ date: string; minutes: number }[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const all = await getRecentIndices(7)
      if (cancelled) return
      setIndices(all)
      setEvents(getEvents())
      setRewards(getRewards())
      setWeeklyMinutes(getWeeklyRelaxMinutes())
      setRelaxHistory(getRelaxHistory())
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredIndices = useMemo(() => {
    const now = Date.now()
    const cutoff = view === 'today'
      ? startOfToday()
      : now - 7 * 86400000
    return indices.filter((p) => p.timestamp >= cutoff)
  }, [indices, view])

  const filteredEvents = useMemo(() => {
    const cutoff = view === 'today' ? startOfToday() : Date.now() - 7 * 86400000
    return events.filter((e) => e.timestamp >= cutoff)
  }, [events, view])

  // 按事件类型统计
  const eventStats = useMemo(() => {
    const map: Record<string, number> = { alert: 0, act: 0, manual: 0, system: 0 }
    for (const e of filteredEvents) {
      map[e.type] = (map[e.type] ?? 0) + 1
    }
    return map
  }, [filteredEvents])

  // 活跃指数聚合：今日按小时分桶；本周按天分桶
  const trend = useMemo(() => buildTrend(filteredIndices, view), [filteredIndices, view])

  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="text-white/60 hover:text-white">
            ← 返回
          </button>
          <h1 className="text-lg font-medium">看护报告</h1>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
          <button
            onClick={() => setView('today')}
            className={`rounded-md px-3 py-1 text-xs ${view === 'today' ? 'bg-emerald-600 text-white' : 'text-white/60'}`}
          >
            今日
          </button>
          <button
            onClick={() => setView('week')}
            className={`rounded-md px-3 py-1 text-xs ${view === 'week' ? 'bg-emerald-600 text-white' : 'text-white/60'}`}
          >
            本周
          </button>
        </div>
      </div>

      <div className="space-y-6 p-4">
        {/* 活跃指数趋势图 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="mb-3 text-sm font-medium text-white/80">活跃指数趋势</h2>
          <TrendChart points={trend} view={view} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Stat label="平均" value={avg(trend.map((p) => p.value)).toFixed(0)} />
            <Stat label="最高" value={max(trend.map((p) => p.value)).toString()} />
            <Stat label="最低" value={min(trend.map((p) => p.value)).toString()} />
          </div>
        </section>

        {/* 行为分类统计 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="mb-3 text-sm font-medium text-white/80">行为分类统计</h2>
          <EventBarChart stats={eventStats} />
          <p className="mt-3 text-xs text-white/40">
            共 {filteredEvents.length} 条事件记录
          </p>
        </section>

        {/* 喘息时长汇总 */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="mb-3 text-sm font-medium text-white/80">喘息时长汇总</h2>
          {view === 'today' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">今日累计喘息</span>
                <span className="text-lg font-medium text-emerald-300">
                  {todayMinutes(relaxHistory)} 分钟
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">累计完成</span>
                <span className="text-sm text-white/80">{rewards.totalSessions} 次</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">连续打卡</span>
                <span className="text-sm text-white/80">{rewards.streak} 天</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">本周累计</span>
                <span className="text-lg font-medium text-emerald-300">
                  {weeklyMinutes} 分钟
                </span>
              </div>
              <RelaxBarChart data={relaxHistory} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
function max(arr: number[]): number {
  return arr.length === 0 ? 0 : Math.max(...arr)
}
function min(arr: number[]): number {
  return arr.length === 0 ? 0 : Math.min(...arr)
}

function todayMinutes(history: { date: string; minutes: number }[]): number {
  const today = new Date().toDateString()
  const found = history.find((h) => h.date === today)
  return found?.minutes ?? 0
}

interface TrendPoint {
  label: string
  value: number
}

/** 把指数序列按时间分桶聚合，返回每桶的平均值 */
function buildTrend(points: IndexPoint[], view: View): TrendPoint[] {
  if (points.length === 0) return []
  const buckets = new Map<string, number[]>()
  for (const p of points) {
    const d = new Date(p.timestamp)
    let key: string
    if (view === 'today') {
      // 按小时分桶 0..23
      key = d.getHours().toString().padStart(2, '0')
    } else {
      // 按天分桶 MM/DD
      key = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d
        .getDate()
        .toString()
        .padStart(2, '0')}`
    }
    const arr = buckets.get(key) ?? []
    arr.push(p.value)
    buckets.set(key, arr)
  }
  const result: TrendPoint[] = []
  for (const [key, arr] of buckets) {
    result.push({ label: key, value: Math.round(avg(arr)) })
  }
  return result.sort((a, b) => a.label.localeCompare(b.label))
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-2">
      <p className="text-xs text-white/40">{label}</p>
      <p className="text-sm font-medium text-white/90">{value}</p>
    </div>
  )
}

/** 活跃指数趋势折线图（SVG） */
function TrendChart({ points, view }: { points: TrendPoint[]; view: View }) {
  const w = 320
  const h = 120
  const padL = 24
  const padR = 8
  const padT = 8
  const padB = 18
  if (points.length === 0) {
    return <p className="py-6 text-center text-xs text-white/40">暂无数据</p>
  }
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const n = points.length
  const xs = points.map((_, i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW))
  const ys = points.map((p) => padT + innerH - (p.value / 100) * innerH)
  const path = points
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ')
  const areaPath = `${path} L ${xs[n - 1].toFixed(1)} ${padT + innerH} L ${xs[0].toFixed(1)} ${padT + innerH} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {/* 网格线 */}
      {[0, 25, 50, 75, 100].map((g) => {
        const y = padT + innerH - (g / 100) * innerH
        return (
          <g key={g}>
            <line
              x1={padL}
              y1={y}
              x2={w - padR}
              y2={y}
              stroke="#1e293b"
              strokeWidth="0.5"
            />
            <text x={2} y={y + 3} fontSize="8" fill="#64748b">
              {g}
            </text>
          </g>
        )
      })}
      {/* 区域填充 */}
      <path d={areaPath} fill="rgba(16,185,129,0.15)" />
      {/* 折线 */}
      <path d={path} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
      {/* 数据点 */}
      {points.map((_, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r="1.8" fill="#10b981" />
      ))}
      {/* x 轴标签：仅显示首/中/尾，避免拥挤 */}
      {points.length <= 12 ? (
        points.map((p, i) => {
          // 周视图：每天显示；今日视图：每 3 小时显示
          const show = view === 'today' ? i % 3 === 0 : true
          if (!show) return null
          return (
            <text
              key={`l-${i}`}
              x={xs[i]}
              y={h - 4}
              fontSize="7"
              fill="#64748b"
              textAnchor="middle"
            >
              {p.label}
            </text>
          )
        })
      ) : (
        <>
          <text x={xs[0]} y={h - 4} fontSize="7" fill="#64748b" textAnchor="start">
            {points[0].label}
          </text>
          <text x={xs[n - 1]} y={h - 4} fontSize="7" fill="#64748b" textAnchor="end">
            {points[n - 1].label}
          </text>
        </>
      )}
    </svg>
  )
}

/** 行为分类条形图（SVG） */
function EventBarChart({ stats }: { stats: Record<string, number> }) {
  const entries = Object.entries(stats).filter(([, v]) => v > 0)
  if (entries.length === 0) {
    return <p className="py-4 text-center text-xs text-white/40">暂无事件</p>
  }
  const labels: Record<string, string> = {
    alert: '预警',
    act: '干预',
    manual: '手动',
    system: '系统',
  }
  const colors: Record<string, string> = {
    alert: '#f97316',
    act: '#ef4444',
    manual: '#3b82f6',
    system: '#64748b',
  }
  const maxVal = Math.max(...entries.map(([, v]) => v), 1)
  const barH = 14
  const gap = 6
  const labelW = 36
  const valueW = 28
  const w = 320
  const h = entries.length * (barH + gap)
  const trackW = w - labelW - valueW - 8

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {entries.map(([key, val], i) => {
        const y = i * (barH + gap)
        const w2 = (val / maxVal) * trackW
        return (
          <g key={key}>
            <text x={0} y={y + barH - 3} fontSize="9" fill="#94a3b8">
              {labels[key] ?? key}
            </text>
            <rect x={labelW} y={y} width={trackW} height={barH} fill="#1e293b" rx="2" />
            <rect x={labelW} y={y} width={w2} height={barH} fill={colors[key] ?? '#64748b'} rx="2" />
            <text
              x={labelW + trackW + 4}
              y={y + barH - 3}
              fontSize="9"
              fill="#cbd5e1"
            >
              {val}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** 喘息时长按日条形图（SVG） */
function RelaxBarChart({ data }: { data: { date: string; minutes: number }[] }) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-xs text-white/40">暂无记录</p>
  }
  const maxVal = Math.max(...data.map((d) => d.minutes), 10)
  const w = 320
  const h = 80
  const padB = 16
  const innerH = h - padB
  const barW = (w - 8) / data.length - 4
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {data.map((d, i) => {
        const x = 4 + i * (barW + 4)
        const bh = (d.minutes / maxVal) * innerH
        const y = innerH - bh
        const label = d.date.slice(5) // MM/DD
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(bh, 0)} fill="#10b981" rx="2" />
            {d.minutes > 0 && (
              <text x={x + barW / 2} y={y - 2} fontSize="7" fill="#94a3b8" textAnchor="middle">
                {d.minutes}
              </text>
            )}
            <text x={x + barW / 2} y={h - 4} fontSize="7" fill="#64748b" textAnchor="middle">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
